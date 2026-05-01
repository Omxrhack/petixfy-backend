/**
 * Catalogo de veterinarios para clientes (service role; sin datos sensibles).
 */

const { createSupabaseServiceRoleClient } = require('../lib/supabaseServiceRole');

async function listVetsCatalog(req, res) {
  try {
    let admin;
    try {
      admin = createSupabaseServiceRoleClient();
    } catch (e) {
      return res.status(503).json({ error: 'Catalog unavailable', details: e.message });
    }

    const { data: profiles, error: pErr } = await admin
      .from('profiles')
      .select('id, full_name, avatar_url, phone')
      .eq('role', 'vet');

    if (pErr) {
      return res.status(400).json({ error: pErr.message, details: pErr });
    }

    const list = profiles ?? [];
    const ids = list.map((p) => p.id).filter(Boolean);
    if (!ids.length) {
      return res.json({ vets: [] });
    }

    const { data: details } = await admin
      .from('vet_details')
      .select('profile_id, base_latitude, base_longitude, coverage_radius_km')
      .in('profile_id', ids);

    const { data: services } = await admin
      .from('vet_services')
      .select('profile_id, specialty, accepts_emergencies, on_duty')
      .in('profile_id', ids);

    const detailMap = Object.fromEntries((details ?? []).map((d) => [d.profile_id, d]));
    const svcMap = Object.fromEntries((services ?? []).map((s) => [s.profile_id, s]));

    const vets = list
      .filter((p) => svcMap[p.id])
      .map((p) => {
        const d = detailMap[p.id];
        const s = svcMap[p.id];
        return {
          id: p.id,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          phone: p.phone,
          specialty: s?.specialty ?? null,
          accepts_emergencies: s?.accepts_emergencies === true,
          on_duty: s?.on_duty === true,
          base_latitude: d?.base_latitude != null ? Number(d.base_latitude) : null,
          base_longitude: d?.base_longitude != null ? Number(d.base_longitude) : null,
          coverage_radius_km: d?.coverage_radius_km != null ? Number(d.coverage_radius_km) : null,
        };
      });

    return res.json({ vets });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list veterinarians', details: err.message });
  }
}

module.exports = { listVetsCatalog };
