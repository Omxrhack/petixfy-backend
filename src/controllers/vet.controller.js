/**
 * Dashboard, agenda, disponibilidad, emergencias asignadas y expediente (vet).
 */

const { dashboardQuerySchema, scheduleQuerySchema } = require('../schemas/vet.schema');

function utcDayBounds(dateStr) {
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function todayUtcDateString() {
  return new Date().toISOString().slice(0, 10);
}

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

async function patchAvailability(req, res) {
  try {
    const vetId = req.user.id;
    const { on_duty: onDuty } = req.body;

    const { data, error } = await req.supabase
      .from('vet_services')
      .update({ on_duty: onDuty })
      .eq('profile_id', vetId)
      .select('on_duty')
      .maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    if (!data) {
      return res.status(404).json({ error: 'vet_services row not found; complete onboarding first' });
    }

    return res.json({ on_duty: data.on_duty });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update availability', details: err.message });
  }
}

async function getDashboard(req, res) {
  try {
    const vetId = req.user.id;
    const parsed = dashboardQuerySchema.safeParse({ date: req.query.date ?? undefined });
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const dateStr = parsed.data.date ?? todayUtcDateString();
    const { startIso, endIso } = utcDayBounds(dateStr);

    const { data: vsRow, error: vsErr } = await req.supabase
      .from('vet_services')
      .select('on_duty')
      .eq('profile_id', vetId)
      .maybeSingle();

    if (vsErr) {
      return res.status(400).json({ error: vsErr.message, details: vsErr });
    }

    const { data: vetBaseRow } = await req.supabase
      .from('vet_details')
      .select('base_latitude, base_longitude')
      .eq('profile_id', vetId)
      .maybeSingle();

    const { data: appts, error: apptErr } = await req.supabase
      .from('appointments')
      .select(
        'id, scheduled_at, status, notes, fee_mxn, owner_id, pet_id, pets(id, name, species, breed, photo_url)',
      )
      .eq('vet_id', vetId)
      .gte('scheduled_at', startIso)
      .lt('scheduled_at', endIso)
      .order('scheduled_at', { ascending: true });

    if (apptErr) {
      return res.status(400).json({ error: apptErr.message, details: apptErr });
    }

    const list = appts ?? [];
    const ownerIds = [...new Set(list.map((a) => a.owner_id).filter(Boolean))];
    let detailsMap = {};
    if (ownerIds.length > 0) {
      const { data: cdRows, error: cdErr } = await req.supabase
        .from('client_details')
        .select('profile_id, address_text')
        .in('profile_id', ownerIds);

      if (cdErr) {
        return res.status(400).json({ error: cdErr.message, details: cdErr });
      }
      detailsMap = Object.fromEntries((cdRows ?? []).map((d) => [d.profile_id, d]));
    }

    const pendingStatuses = new Set(['pending', 'confirmed']);
    const pending_count = list.filter((a) => pendingStatuses.has(a.status)).length;
    const earnings_mxn_today = list
      .filter((a) => a.status === 'completed')
      .reduce((sum, a) => sum + (Number(a.fee_mxn) || 0), 0);

    const visits = list
      .filter((a) => pendingStatuses.has(a.status))
      .slice(0, 24)
      .map((a) => ({
        appointment_id: a.id,
        scheduled_at: a.scheduled_at,
        status: a.status,
        pet_name: a.pets?.name ?? '',
        species: a.pets?.species ?? '',
        neighborhood: detailsMap[a.owner_id]?.address_text ?? '',
      }));

    return res.json({
      date: dateStr,
      on_duty: vsRow?.on_duty ?? false,
      vet_base_latitude: vetBaseRow?.base_latitude ?? null,
      vet_base_longitude: vetBaseRow?.base_longitude ?? null,
      pending_count,
      earnings_mxn_today,
      visits,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load dashboard', details: err.message });
  }
}

async function getSchedule(req, res) {
  try {
    const vetId = req.user.id;
    const parsed = scheduleQuerySchema.safeParse({ date: req.query.date ?? undefined });
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const dateStr = parsed.data.date ?? todayUtcDateString();
    const { startIso, endIso } = utcDayBounds(dateStr);

    const { data: appts, error } = await req.supabase
      .from('appointments')
      .select(
        'id, scheduled_at, status, notes, fee_mxn, owner_id, pet_id, pets(id, name, species, breed, photo_url)',
      )
      .eq('vet_id', vetId)
      .gte('scheduled_at', startIso)
      .lt('scheduled_at', endIso)
      .order('scheduled_at', { ascending: true });

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    const list = appts ?? [];
    const ownerIds = [...new Set(list.map((a) => a.owner_id).filter(Boolean))];
    let detailsMap = {};
    if (ownerIds.length > 0) {
      const { data: cdRows, error: cdErr } = await req.supabase
        .from('client_details')
        .select('profile_id, address_text, address_notes')
        .in('profile_id', ownerIds);

      if (cdErr) {
        return res.status(400).json({ error: cdErr.message, details: cdErr });
      }
      detailsMap = Object.fromEntries((cdRows ?? []).map((d) => [d.profile_id, d]));
    }

    const appointments = list.map((a) => ({
      id: a.id,
      scheduled_at: a.scheduled_at,
      status: a.status,
      notes: a.notes,
      fee_mxn: a.fee_mxn,
      owner_id: a.owner_id,
      pet: a.pets,
      client_address: detailsMap[a.owner_id] ?? null,
    }));

    return res.json({ date: dateStr, appointments });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load schedule', details: err.message });
  }
}

async function getPetSummary(req, res) {
  try {
    const vetId = req.user.id;
    const petId = req.params.id;

    const { data: pet, error: petError } = await req.supabase.from('pets').select('*').eq('id', petId).maybeSingle();

    if (petError) {
      return res.status(400).json({ error: petError.message, details: petError });
    }

    if (!pet) {
      return res.status(404).json({ error: 'Pet not found or not accessible' });
    }

    const { data: apptLink } = await req.supabase
      .from('appointments')
      .select('id')
      .eq('pet_id', petId)
      .eq('vet_id', vetId)
      .limit(1)
      .maybeSingle();

    const { data: emergLink } = await req.supabase
      .from('emergencies')
      .select('id')
      .eq('pet_id', petId)
      .eq('assigned_vet_id', vetId)
      .limit(1)
      .maybeSingle();

    if (!apptLink && !emergLink) {
      return res.status(403).json({ error: 'No active assignment links you to this pet' });
    }

    const { data: owner, error: ownerErr } = await req.supabase
      .from('profiles')
      .select('id, full_name, phone')
      .eq('id', pet.owner_id)
      .maybeSingle();

    if (ownerErr) {
      return res.status(400).json({ error: ownerErr.message, details: ownerErr });
    }

    const { data: client_details, error: cdErr } = await req.supabase
      .from('client_details')
      .select('address_text, address_notes, latitude, longitude')
      .eq('profile_id', pet.owner_id)
      .maybeSingle();

    if (cdErr) {
      return res.status(400).json({ error: cdErr.message, details: cdErr });
    }

    return res.json({
      pet,
      owner,
      client_details,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load pet summary', details: err.message });
  }
}

async function listActiveEmergencies(req, res) {
  try {
    const vetId = req.user.id;

    const { data: vetBase, error: vbErr } = await req.supabase
      .from('vet_details')
      .select('base_latitude, base_longitude')
      .eq('profile_id', vetId)
      .maybeSingle();

    if (vbErr) {
      return res.status(400).json({ error: vbErr.message, details: vbErr });
    }

    const baseLat = vetBase?.base_latitude != null ? Number(vetBase.base_latitude) : null;
    const baseLng = vetBase?.base_longitude != null ? Number(vetBase.base_longitude) : null;
    const hasBase = Number.isFinite(baseLat) && Number.isFinite(baseLng);

    const { data: rows, error } = await req.supabase
      .from('emergencies')
      .select('id, pet_id, symptoms, latitude, longitude, status, created_at, pets(id, name, species)')
      .eq('assigned_vet_id', vetId)
      .in('status', ['open', 'dispatched']);

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    const emergencies = (rows ?? []).map((e) => {
      let distance_km = null;
      if (hasBase && e.latitude != null && e.longitude != null) {
        distance_km =
          Math.round(haversineKm(baseLat, baseLng, Number(e.latitude), Number(e.longitude)) * 10) / 10;
      }
      return {
        id: e.id,
        pet_id: e.pet_id,
        symptoms: e.symptoms,
        latitude: e.latitude,
        longitude: e.longitude,
        status: e.status,
        created_at: e.created_at,
        pet: e.pets,
        distance_km,
      };
    });

    return res.json({ emergencies });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list emergencies', details: err.message });
  }
}

async function respondEmergency(req, res) {
  try {
    const vetId = req.user.id;
    const emergencyId = req.params.id;
    const { accept } = req.body;

    const { data: row, error: fetchErr } = await req.supabase
      .from('emergencies')
      .select('id, status, assigned_vet_id')
      .eq('id', emergencyId)
      .maybeSingle();

    if (fetchErr) {
      return res.status(400).json({ error: fetchErr.message, details: fetchErr });
    }

    if (!row) {
      return res.status(404).json({ error: 'Emergency not found' });
    }

    if (row.assigned_vet_id !== vetId) {
      return res.status(403).json({ error: 'This emergency is not assigned to you' });
    }

    if (row.status !== 'open') {
      return res.status(400).json({ error: 'Emergency can only be responded to while status is open' });
    }

    if (accept) {
      const { data: updated, error: upErr } = await req.supabase
        .from('emergencies')
        .update({ status: 'dispatched' })
        .eq('id', emergencyId)
        .eq('assigned_vet_id', vetId)
        .select()
        .single();

      if (upErr) {
        return res.status(400).json({ error: upErr.message, details: upErr });
      }

      return res.json({ emergency: updated, accepted: true });
    }

    const { data: updated, error: upErr } = await req.supabase
      .from('emergencies')
      .update({ assigned_vet_id: null, status: 'open' })
      .eq('id', emergencyId)
      .eq('assigned_vet_id', vetId)
      .select()
      .single();

    if (upErr) {
      return res.status(400).json({ error: upErr.message, details: upErr });
    }

    return res.json({ emergency: updated, accepted: false });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to respond to emergency', details: err.message });
  }
}

module.exports = {
  patchAvailability,
  getDashboard,
  getSchedule,
  getPetSummary,
  listActiveEmergencies,
  respondEmergency,
};
