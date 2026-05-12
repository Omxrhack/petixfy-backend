const { createSupabaseServiceRoleClient } = require('../lib/supabaseServiceRole');

const STORE_ORDER_SELECT = `
  id,
  owner_id,
  status,
  fulfillment_method,
  delivery_address_text,
  contact_name,
  contact_phone,
  notes,
  subtotal_mxn,
  total_mxn,
  created_at,
  updated_at,
  cancelled_at,
  confirmed_at,
  fulfilled_at,
  items:store_order_items(
    id,
    product_id,
    product_name,
    product_category,
    unit_price_mxn,
    quantity,
    line_total_mxn
  )
`;

async function restoreOrderStock(admin, orderId) {
  const { data: items, error } = await admin
    .from('store_order_items')
    .select('product_id, quantity')
    .eq('order_id', orderId)
    .not('product_id', 'is', null);

  if (error) {
    throw error;
  }

  for (const item of items ?? []) {
    const { data: product, error: productError } = await admin
      .from('products')
      .select('id, stock')
      .eq('id', item.product_id)
      .maybeSingle();

    if (productError) {
      throw productError;
    }
    if (!product) continue;

    const nextStock = (Number(product.stock) || 0) + (Number(item.quantity) || 0);
    const { error: updateError } = await admin.from('products').update({ stock: nextStock }).eq('id', item.product_id);
    if (updateError) {
      throw updateError;
    }
  }
}

async function createOrder(req, res) {
  try {
    const {
      fulfillment_method: fulfillmentMethod,
      items,
      delivery_address_text: deliveryAddressText,
      contact_name: contactName,
      contact_phone: contactPhone,
      notes,
    } = req.body;

    const { data, error } = await req.supabase.rpc('create_store_order', {
      p_fulfillment_method: fulfillmentMethod,
      p_items: items,
      p_delivery_address_text: deliveryAddressText ?? null,
      p_contact_name: contactName ?? null,
      p_contact_phone: contactPhone ?? null,
      p_notes: notes ?? null,
    });

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    return res.status(201).json({ order: data });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create store order', details: err.message });
  }
}

async function listMyOrders(req, res) {
  try {
    const ownerId = req.user.id;
    const { data, error } = await req.supabase
      .from('store_orders')
      .select(STORE_ORDER_SELECT)
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(80);

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    return res.json({ orders: data ?? [] });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list store orders', details: err.message });
  }
}

async function getMyOrder(req, res) {
  try {
    const ownerId = req.user.id;
    const { id } = req.params;

    const { data, error } = await req.supabase
      .from('store_orders')
      .select(STORE_ORDER_SELECT)
      .eq('id', id)
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    if (!data) {
      return res.status(404).json({ error: 'Store order not found' });
    }

    return res.json({ order: data });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get store order', details: err.message });
  }
}

async function cancelMyOrder(req, res) {
  try {
    const { id } = req.params;
    const { data, error } = await req.supabase.rpc('cancel_store_order', {
      p_order_id: id,
    });

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    return res.json({ order: data });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to cancel store order', details: err.message });
  }
}

async function listVetStoreOrders(req, res) {
  try {
    const admin = createSupabaseServiceRoleClient();
    const status = req.query.status?.toString().trim();
    let query = admin
      .from('store_orders')
      .select(STORE_ORDER_SELECT)
      .order('created_at', { ascending: false })
      .limit(120);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    return res.json({ orders: data ?? [] });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list vet store orders', details: err.message });
  }
}

async function updateVetStoreOrderStatus(req, res) {
  try {
    const admin = createSupabaseServiceRoleClient();
    const { id } = req.params;
    const { status } = req.body;

    const { data: current, error: fetchError } = await admin
      .from('store_orders')
      .select('id, status, confirmed_at')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      return res.status(400).json({ error: fetchError.message, details: fetchError });
    }
    if (!current) {
      return res.status(404).json({ error: 'Store order not found' });
    }
    if (current.status === 'cancelled' || current.status === 'fulfilled') {
      return res.status(409).json({ error: 'Finalized orders cannot be updated' });
    }

    const patch = { status };
    if (status === 'confirmed') {
      patch.confirmed_at = new Date().toISOString();
    }
    if (status === 'fulfilled') {
      patch.fulfilled_at = new Date().toISOString();
      if (!current.confirmed_at) {
        patch.confirmed_at = new Date().toISOString();
      }
    }
    if (status === 'cancelled') {
      patch.cancelled_at = new Date().toISOString();
      await restoreOrderStock(admin, id);
    }

    const { data, error } = await admin
      .from('store_orders')
      .update(patch)
      .eq('id', id)
      .select(STORE_ORDER_SELECT)
      .single();

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    return res.json({ order: data });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update store order', details: err.message });
  }
}

module.exports = {
  createOrder,
  listMyOrders,
  getMyOrder,
  cancelMyOrder,
  listVetStoreOrders,
  updateVetStoreOrderStatus,
};
