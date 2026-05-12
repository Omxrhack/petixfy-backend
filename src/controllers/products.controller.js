const { supabaseAnon } = require('../lib/supabaseAnon');
const { createSupabaseServiceRoleClient } = require('../lib/supabaseServiceRole');

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

/**
 * Escapa comodines de ILIKE para que el término de búsqueda sea literal.
 */
function escapeIlikePattern(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/** Valor en filtros `.or()` / PostgREST cuando incluye `%` u otros caracteres especiales. */
function quotePostgrestValue(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '""')}"`;
}

/**
 * Catálogo e-commerce: paginación, búsqueda por nombre/descripción y filtro opcional por categoría.
 * Lectura pública (anon + RLS); no requiere JWT.
 */
async function listProducts(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || DEFAULT_PAGE);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT),
    );
    const searchRaw = req.query.search;
    const category = req.query.category;

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAnon
      .from('products')
      .select('*', { count: 'exact', head: false })
      .eq('active', true)
      .order('name', { ascending: true });

    if (category != null && String(category).trim() !== '') {
      query = query.eq('category', String(category).trim());
    }

    if (searchRaw != null && String(searchRaw).trim() !== '') {
      const term = escapeIlikePattern(String(searchRaw).trim());
      const pattern = `%${term}%`;
      const q = quotePostgrestValue(pattern);
      query = query.or(`name.ilike.${q},description.ilike.${q}`);
    }

    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return res.json({
      data: data ?? [],
      page,
      limit,
      total,
      totalPages,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list products', details: err.message });
  }
}

async function getProduct(req, res) {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAnon
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('active', true)
      .maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    if (!data) {
      return res.status(404).json({ error: 'Product not found' });
    }

    return res.json({ product: data });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get product', details: err.message });
  }
}

function productPayload(body) {
  const row = {};
  for (const key of ['name', 'description', 'category', 'price', 'stock', 'image_url', 'active']) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      row[key] = body[key];
    }
  }
  return row;
}

async function createVetProduct(req, res) {
  try {
    const admin = createSupabaseServiceRoleClient();
    const row = productPayload(req.body);
    const { data, error } = await admin.from('products').insert(row).select().single();

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    return res.status(201).json({ product: data });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create product', details: err.message });
  }
}

async function updateVetProduct(req, res) {
  try {
    const admin = createSupabaseServiceRoleClient();
    const row = productPayload(req.body);
    const { data, error } = await admin
      .from('products')
      .update(row)
      .eq('id', req.params.id)
      .select()
      .maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    if (!data) {
      return res.status(404).json({ error: 'Product not found' });
    }

    return res.json({ product: data });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update product', details: err.message });
  }
}

async function deleteVetProduct(req, res) {
  try {
    const admin = createSupabaseServiceRoleClient();
    const { data, error } = await admin
      .from('products')
      .update({ active: false })
      .eq('id', req.params.id)
      .select('id, active')
      .maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    if (!data) {
      return res.status(404).json({ error: 'Product not found' });
    }

    return res.json({ product: data });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to disable product', details: err.message });
  }
}

module.exports = {
  listProducts,
  getProduct,
  createVetProduct,
  updateVetProduct,
  deleteVetProduct,
};
