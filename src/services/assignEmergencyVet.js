/**
 * Assigns an on-duty vet to a new emergency (nearest within coverage radius when possible).
 */

const { createSupabaseServiceRoleClient } = require('../lib/supabaseServiceRole');

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * @param {string} emergencyId
 * @param {number} clientLat
 * @param {number} clientLng
 * @returns {Promise<string|null>} profile_id del vet asignado, o null
 */
async function assignNearestOnDutyVet(emergencyId, clientLat, clientLng) {
  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch {
    return null;
  }

  const { data: profiles, error: pErr } = await admin
    .from('profiles')
    .select('id, role')
    .eq('role', 'vet');

  if (pErr || !profiles?.length) {
    return null;
  }

  const vetIds = profiles.map((p) => p.id);

  const { data: services, error: sErr } = await admin
    .from('vet_services')
    .select('profile_id, on_duty, accepts_emergencies')
    .in('profile_id', vetIds);

  if (sErr || !services?.length) {
    return null;
  }

  const onDutyEmergency = services.filter((s) => s.on_duty === true && s.accepts_emergencies === true);
  const acceptsOnly = services.filter((s) => s.accepts_emergencies === true);
  const primarySet = new Set((onDutyEmergency.length ? onDutyEmergency : acceptsOnly).map((s) => s.profile_id));

  if (!primarySet.size) {
    return null;
  }

  const candidateIds = [...primarySet];

  const { data: details, error: dErr } = await admin
    .from('vet_details')
    .select('profile_id, base_latitude, base_longitude, coverage_radius_km')
    .in('profile_id', candidateIds);

  if (dErr || !details?.length) {
    return null;
  }

  let bestInRadius = null;
  let bestDistInRadius = Infinity;
  let bestAny = null;
  let bestDistAny = Infinity;

  for (const d of details) {
    const vid = d.profile_id;
    if (!primarySet.has(vid)) continue;

    const vLat = d.base_latitude != null ? Number(d.base_latitude) : NaN;
    const vLng = d.base_longitude != null ? Number(d.base_longitude) : NaN;
    const radius = d.coverage_radius_km != null ? Number(d.coverage_radius_km) : NaN;

    if (!Number.isFinite(vLat) || !Number.isFinite(vLng)) {
      continue;
    }

    const dist = haversineKm(clientLat, clientLng, vLat, vLng);

    if (dist < bestDistAny) {
      bestDistAny = dist;
      bestAny = vid;
    }

    if (Number.isFinite(radius) && dist <= radius && dist < bestDistInRadius) {
      bestDistInRadius = dist;
      bestInRadius = vid;
    }
  }

  const chosen = bestInRadius ?? bestAny;

  if (!chosen) {
    return null;
  }

  const { error: upErr } = await admin
    .from('emergencies')
    .update({ assigned_vet_id: chosen })
    .eq('id', emergencyId);

  if (upErr) {
    console.warn('[assignEmergencyVet] update failed', upErr.message);
    return null;
  }

  return chosen;
}

module.exports = { assignNearestOnDutyVet, haversineKm };
