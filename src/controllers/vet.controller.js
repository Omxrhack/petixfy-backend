/**
 * Dashboard, agenda, disponibilidad, emergencias asignadas y expediente (vet).
 */

const { createSupabaseServiceRoleClient } = require('../lib/supabaseServiceRole');
const { safeBasename } = require('../lib/safeBasename');
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

/** Citas asignadas a este vet o en pool (sin vet_id, pendientes/confirmadas). */
function filterAssignedAndPoolAppointments(rows, vetId) {
  return (rows ?? []).filter((a) => {
    if (a.vet_id === vetId) return true;
    if (a.vet_id == null && (a.status === 'pending' || a.status === 'confirmed')) return true;
    return false;
  });
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

    const appointmentSelect =
      'id, vet_id, scheduled_at, status, notes, fee_mxn, owner_id, pet_id, pets(id, name, species, breed, photo_url), vet:profiles!appointments_vet_id_fkey(id, full_name, avatar_url, phone)';

    const { data: rawAppts, error: apptErr } = await req.supabase
      .from('appointments')
      .select(appointmentSelect)
      .gte('scheduled_at', startIso)
      .lt('scheduled_at', endIso)
      .order('scheduled_at', { ascending: true })
      .or(`vet_id.eq.${vetId},vet_id.is.null`);

    if (apptErr) {
      return res.status(400).json({ error: apptErr.message, details: apptErr });
    }

    const list = filterAssignedAndPoolAppointments(rawAppts, vetId);
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
        pet_id: a.pet_id,
        vet_id: a.vet_id,
        vet_name: a.vet?.full_name ?? '',
        vet_avatar_url: a.vet?.avatar_url ?? null,
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

    const appointmentSelect =
      'id, vet_id, scheduled_at, status, notes, fee_mxn, owner_id, pet_id, pets(id, name, species, breed, photo_url), vet:profiles!appointments_vet_id_fkey(id, full_name, avatar_url, phone)';

    const { data: rawAppts, error } = await req.supabase
      .from('appointments')
      .select(appointmentSelect)
      .gte('scheduled_at', startIso)
      .lt('scheduled_at', endIso)
      .order('scheduled_at', { ascending: true })
      .or(`vet_id.eq.${vetId},vet_id.is.null`);

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    const list = filterAssignedAndPoolAppointments(rawAppts, vetId);
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
      vet_id: a.vet_id,
      scheduled_at: a.scheduled_at,
      status: a.status,
      notes: a.notes,
      fee_mxn: a.fee_mxn,
      owner_id: a.owner_id,
      pet: a.pets,
      vet: a.vet ?? null,
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

    const { data: apptAssigned } = await req.supabase
      .from('appointments')
      .select('id')
      .eq('pet_id', petId)
      .eq('vet_id', vetId)
      .limit(1)
      .maybeSingle();

    const { data: apptPool } = await req.supabase
      .from('appointments')
      .select('id')
      .eq('pet_id', petId)
      .is('vet_id', null)
      .in('status', ['pending', 'confirmed'])
      .limit(1)
      .maybeSingle();

    const { data: emergLink } = await req.supabase
      .from('emergencies')
      .select('id')
      .eq('pet_id', petId)
      .eq('assigned_vet_id', vetId)
      .limit(1)
      .maybeSingle();

    if (!apptAssigned && !apptPool && !emergLink) {
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

/** Veterinario asigna a si mismo una cita del pool (vet_id null). */
async function claimAppointment(req, res) {
  try {
    const vetId = req.user.id;
    const appointmentId = req.params.id;

    const { data: updated, error } = await req.supabase
      .from('appointments')
      .update({ vet_id: vetId })
      .eq('id', appointmentId)
      .is('vet_id', null)
      .in('status', ['pending', 'confirmed'])
      .select()
      .maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    if (!updated) {
      return res.status(409).json({
        error: 'La cita no esta disponible para asignacion (ya asignada o estado no valido).',
      });
    }

    return res.json({ appointment: updated });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to claim appointment', details: err.message });
  }
}

/** Nueva cita confirmada; insert con service role si hay vinculo con la mascota (cita/emergencia). */
async function createVetAppointment(req, res) {
  try {
    const vetId = req.user.id;
    const { pet_id: petId, scheduled_at: scheduledAt, notes } = req.body;

    const { data: pet, error: petError } = await req.supabase
      .from('pets')
      .select('id, owner_id')
      .eq('id', petId)
      .maybeSingle();

    if (petError) {
      return res.status(400).json({ error: petError.message, details: petError });
    }
    if (!pet) {
      return res.status(404).json({ error: 'Pet not found or not accessible' });
    }

    const { data: apptAssigned } = await req.supabase
      .from('appointments')
      .select('id')
      .eq('pet_id', petId)
      .eq('vet_id', vetId)
      .limit(1)
      .maybeSingle();

    const { data: apptPool } = await req.supabase
      .from('appointments')
      .select('id')
      .eq('pet_id', petId)
      .is('vet_id', null)
      .in('status', ['pending', 'confirmed'])
      .limit(1)
      .maybeSingle();

    const { data: emergLink } = await req.supabase
      .from('emergencies')
      .select('id')
      .eq('pet_id', petId)
      .eq('assigned_vet_id', vetId)
      .limit(1)
      .maybeSingle();

    if (!apptAssigned && !apptPool && !emergLink) {
      return res.status(403).json({ error: 'No active assignment links you to this pet' });
    }

    let admin;
    try {
      admin = createSupabaseServiceRoleClient();
    } catch (e) {
      return res.status(503).json({ error: 'Scheduling unavailable', details: e.message });
    }

    const row = {
      pet_id: petId,
      owner_id: pet.owner_id,
      scheduled_at: scheduledAt,
      notes: notes ?? null,
      status: 'confirmed',
      vet_id: vetId,
    };

    const { data, error } = await admin.from('appointments').insert(row).select().single();

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create appointment', details: err.message });
  }
}

/**
 * Misma regla de acceso que GET /vet/pets/:id/summary. Sube con service role (carpeta Storage = owner_id).
 */
async function uploadPetPhotoAsVet(req, res) {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'photo file is required (multipart field name: photo)' });
    }

    const vetId = req.user.id;
    const petId = req.params.id;

    const { data: pet, error: petError } = await req.supabase
      .from('pets')
      .select('id, owner_id')
      .eq('id', petId)
      .maybeSingle();

    if (petError) {
      return res.status(400).json({ error: petError.message, details: petError });
    }
    if (!pet) {
      return res.status(404).json({ error: 'Pet not found' });
    }

    const { data: apptAssigned } = await req.supabase
      .from('appointments')
      .select('id')
      .eq('pet_id', petId)
      .eq('vet_id', vetId)
      .limit(1)
      .maybeSingle();

    const { data: apptPool } = await req.supabase
      .from('appointments')
      .select('id')
      .eq('pet_id', petId)
      .is('vet_id', null)
      .in('status', ['pending', 'confirmed'])
      .limit(1)
      .maybeSingle();

    const { data: emergLink } = await req.supabase
      .from('emergencies')
      .select('id')
      .eq('pet_id', petId)
      .eq('assigned_vet_id', vetId)
      .limit(1)
      .maybeSingle();

    if (!apptAssigned && !apptPool && !emergLink) {
      return res.status(403).json({ error: 'No assignment links you to this pet' });
    }

    const ownerId = pet.owner_id;
    const objectPath = `${ownerId}/${petId}/${Date.now()}-${safeBasename(req.file.originalname)}`;

    let admin;
    try {
      admin = createSupabaseServiceRoleClient();
    } catch (e) {
      return res.status(503).json({ error: 'Upload unavailable', details: e.message });
    }

    const { error: uploadError } = await admin.storage
      .from('vetgo-images')
      .upload(objectPath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      return res.status(400).json({ error: uploadError.message, details: uploadError });
    }

    const {
      data: { publicUrl },
    } = admin.storage.from('vetgo-images').getPublicUrl(objectPath);

    const { data, error } = await admin
      .from('pets')
      .update({ photo_url: publicUrl })
      .eq('id', petId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to upload pet photo', details: err.message });
  }
}

module.exports = {
  patchAvailability,
  getDashboard,
  getSchedule,
  getPetSummary,
  listActiveEmergencies,
  respondEmergency,
  uploadPetPhotoAsVet,
  claimAppointment,
  createVetAppointment,
};
