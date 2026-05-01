/**
 * Assigns a veterinarian to a new emergency so GET /vet/emergencies/active returns rows.
 * Uses service_role (RLS bypass). Multiple fallbacks so dev DBs with defaults still work.
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
 * Orden de preferencia de candidatos (cada paso solo si el anterior quedo vacio):
 * 1) on_duty + accepts_emergencies
 * 2) accepts_emergencies
 * 3) on_duty
 * 4) cualquier fila en vet_services (vet registrado en onboarding)
 *
 * @returns {Promise<string|null>}
 */
async function assignNearestOnDutyVet(emergencyId, clientLat, clientLng) {
  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    console.warn('[assignEmergencyVet] no service role client:', e?.message ?? e);
    return null;
  }

  const { data: profiles, error: pErr } = await admin
    .from('profiles')
    .select('id, role')
    .eq('role', 'vet');

  if (pErr || !profiles?.length) {
    console.warn('[assignEmergencyVet] no vet profiles:', pErr?.message ?? 'empty');
    return null;
  }

  const vetIds = profiles.map((p) => p.id);

  const { data: services, error: sErr } = await admin
    .from('vet_services')
    .select('profile_id, on_duty, accepts_emergencies')
    .in('profile_id', vetIds);

  if (sErr || !services?.length) {
    console.warn('[assignEmergencyVet] no vet_services rows:', sErr?.message ?? 'empty');
    return null;
  }

  const dutyAndAccept = services.filter((s) => s.on_duty === true && s.accepts_emergencies === true);
  const acceptOnly = services.filter((s) => s.accepts_emergencies === true);
  const dutyOnly = services.filter((s) => s.on_duty === true);

  let orderedIds = [];
  if (dutyAndAccept.length) {
    orderedIds = dutyAndAccept.map((s) => s.profile_id);
  } else if (acceptOnly.length) {
    orderedIds = acceptOnly.map((s) => s.profile_id);
  } else if (dutyOnly.length) {
    orderedIds = dutyOnly.map((s) => s.profile_id);
    console.warn('[assignEmergencyVet] falling back to on_duty vets (no accepts_emergencies)');
  } else {
    orderedIds = [...new Set(services.map((s) => s.profile_id))];
    console.warn('[assignEmergencyVet] falling back to any vet_services row (set accepts_emergencies / on_duty)');
  }

  const candidateIds = [...new Set(orderedIds)];
  if (!candidateIds.length) {
    return null;
  }

  const { data: details, error: dErr } = await admin
    .from('vet_details')
    .select('profile_id, base_latitude, base_longitude, coverage_radius_km')
    .in('profile_id', candidateIds);

  if (dErr) {
    console.warn('[assignEmergencyVet] vet_details query:', dErr.message);
  }

  const detailRows = details ?? [];
  const detailById = Object.fromEntries(detailRows.map((d) => [d.profile_id, d]));

  let bestInRadius = null;
  let bestDistInRadius = Infinity;
  let bestAny = null;
  let bestDistAny = Infinity;

  for (const vid of candidateIds) {
    const d = detailById[vid];
    if (!d) continue;

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

  let chosen = bestInRadius ?? bestAny ?? candidateIds[0];

  if (!detailRows.length || (!bestInRadius && !bestAny)) {
    console.warn(
      '[assignEmergencyVet] assigning without geo match (add vet_details base_latitude/base_longitude for distance)',
    );
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
