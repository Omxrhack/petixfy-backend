const { createSupabaseServiceRoleClient } = require('../lib/supabaseServiceRole');

/**
 * Perfil existe, role vet y tiene fila en vet_services (onboarding).
 */
async function isValidAssignableVet(vetId) {
  if (!vetId || typeof vetId !== 'string') return false;

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch {
    return false;
  }

  const { data: profile, error: pErr } = await admin.from('profiles').select('id, role').eq('id', vetId).maybeSingle();

  if (pErr || !profile || profile.role !== 'vet') {
    return false;
  }

  const { data: svc } = await admin.from('vet_services').select('profile_id').eq('profile_id', vetId).maybeSingle();

  return Boolean(svc);
}

module.exports = { isValidAssignableVet };
