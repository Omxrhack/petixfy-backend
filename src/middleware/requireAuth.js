const { createSupabaseClientWithJwt } = require('../lib/supabaseUserClient');

/**
 * Exige Authorization: Bearer <access_token>, valida el JWT con Supabase
 * y adjunta req.supabase y req.user.
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization Bearer token is required' });
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    return res.status(401).json({ error: 'Authorization Bearer token is required' });
  }

  try {
    const supabase = createSupabaseClientWithJwt(token);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return res.status(401).json({ error: error?.message || 'Invalid or expired token' });
    }

    req.supabase = supabase;
    req.user = user;
    return next();
  } catch (err) {
    return res.status(500).json({ error: 'Authentication failed', details: err.message });
  }
}

module.exports = { requireAuth };
