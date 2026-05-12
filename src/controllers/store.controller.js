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

module.exports = { createOrder, listMyOrders, getMyOrder, cancelMyOrder };
