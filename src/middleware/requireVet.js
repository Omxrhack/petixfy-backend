/**
 * Debe ir después de requireAuth. Exige perfil con role vet.
 */

async function requireVet(req, res, next) {
  try {
    const { data, error } = await req.supabase.from('profiles').select('role').eq('id', req.user.id).maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    if (data?.role !== 'vet') {
      return res.status(403).json({ error: 'Only veterinarians can access this resource' });
    }

    return next();
  } catch (err) {
    return res.status(500).json({ error: 'Failed to verify veterinarian role', details: err.message });
  }
}

module.exports = { requireVet };
