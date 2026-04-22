const { supabaseAnon } = require('../lib/supabaseAnon');

/**
 * Catálogo de tienda. Lectura pública (anon + RLS); no requiere JWT.
 */
async function listProducts(req, res) {
  try {
    const { category } = req.query;

    let query = supabaseAnon.from('products').select('*').order('name', { ascending: true });

    if (category != null && String(category).trim() !== '') {
      query = query.eq('category', String(category).trim());
    }

    const { data, error } = await query;

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    return res.json(data ?? []);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list products', details: err.message });
  }
}

module.exports = { listProducts };
