const { supabaseAnon } = require('../lib/supabaseAnon');

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

module.exports = { listProducts };
