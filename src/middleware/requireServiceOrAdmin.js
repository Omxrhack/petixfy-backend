const { requireAuth } = require('./requireAuth');
const { createSupabaseServiceRoleClient } = require('../lib/supabaseServiceRole');

/**
 * POST /rewards/add: acepta
 * - Cabecera `X-Vetgo-Internal-Key` igual a VETGO_INTERNAL_API_KEY (usa service role, sin JWT), o
 * - JWT de usuario con profiles.role = 'admin'.
 */
async function requireServiceOrAdmin(req, res, next) {
  const provided = req.headers['x-vetgo-internal-key'];
  const expected = process.env.VETGO_INTERNAL_API_KEY;

  if (expected && provided && provided === expected) {
    try {
      req.supabase = createSupabaseServiceRoleClient();
      req.rewardsCaller = 'service';
      return next();
    } catch (err) {
      return res.status(500).json({
        error: 'Service client is not configured',
        details: err.message,
      });
    }
  }

  return requireAuth(req, res, async () => {
    try {
      const { data: profile, error } = await req.supabase
        .from('profiles')
        .select('role')
        .eq('id', req.user.id)
        .maybeSingle();

      if (error) {
        return res.status(400).json({ error: error.message, details: error });
      }

      if (!profile || profile.role !== 'admin') {
        return res.status(403).json({ error: 'Admin or internal key required' });
      }

      req.rewardsCaller = 'admin';
      return next();
    } catch (err) {
      return res.status(500).json({ error: 'Authorization failed', details: err.message });
    }
  });
}

module.exports = { requireServiceOrAdmin };
