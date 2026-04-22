const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
}

/** Cliente con anon key (sin JWT). Útil para lecturas públicas con RLS (p. ej. catálogo). */
const supabaseAnon = createClient(url, anonKey);

module.exports = { supabaseAnon };
