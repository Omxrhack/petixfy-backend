/**
 * Live tracking: sesiones ligadas a cita o emergencia.
 */

async function loadProfileRole(req) {
  const { data, error } = await req.supabase.from('profiles').select('role').eq('id', req.user.id).maybeSingle();
  if (error) {
    return { error };
  }
  return { role: data?.role ?? null };
}

async function getTrackingSession(req, res) {
  try {
    const { id } = req.params;

    const { data: session, error } = await req.supabase.from('tracking_sessions').select('*').eq('id', id).maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    if (!session) {
      return res.status(404).json({ error: 'Tracking session not found' });
    }

    return res.json(session);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load tracking session', details: err.message });
  }
}

async function patchVetLocation(req, res) {
  try {
    const { id } = req.params;
    const { vet_lat: vetLat, vet_lng: vetLng, eta_minutes: etaMinutes } = req.body;

    const { error: profileError, role } = await loadProfileRole(req);
    if (profileError) {
      return res.status(400).json({ error: profileError.message, details: profileError });
    }

    if (role !== 'vet') {
      return res.status(403).json({ error: 'Only veterinarians can update live location' });
    }

    if (vetLat == null || vetLng == null) {
      return res.status(400).json({ error: 'vet_lat and vet_lng are required' });
    }

    const lat = Number(vetLat);
    const lng = Number(vetLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'vet_lat and vet_lng must be numbers' });
    }

    let eta = null;
    if (etaMinutes !== undefined && etaMinutes !== null) {
      eta = Number(etaMinutes);
      if (!Number.isFinite(eta) || eta < 0 || !Number.isInteger(eta)) {
        return res.status(400).json({ error: 'eta_minutes must be a non-negative integer' });
      }
    }

    const updates = { vet_lat: lat, vet_lng: lng };
    if (eta !== null) {
      updates.eta_minutes = eta;
    }

    const { data, error } = await req.supabase.from('tracking_sessions').update(updates).eq('id', id).select().single();

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    if (!data) {
      return res.status(404).json({ error: 'Tracking session not found' });
    }

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update tracking location', details: err.message });
  }
}

async function createTrackingSession(req, res) {
  try {
    const { error: profileError, role } = await loadProfileRole(req);
    if (profileError) {
      return res.status(400).json({ error: profileError.message, details: profileError });
    }

    if (role !== 'vet') {
      return res.status(403).json({ error: 'Only veterinarians can create tracking sessions' });
    }

    const vetId = req.user.id;
    const { appointment_id: appointmentId, emergency_id: emergencyId, vet_lat: vetLat, vet_lng: vetLng, eta_minutes: etaMinutes } =
      req.body;

    const lat = Number(vetLat);
    const lng = Number(vetLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'vet_lat and vet_lng must be finite numbers' });
    }

    let eta = null;
    if (etaMinutes !== undefined && etaMinutes !== null) {
      eta = Number(etaMinutes);
      if (!Number.isFinite(eta) || eta < 0 || !Number.isInteger(eta)) {
        return res.status(400).json({ error: 'eta_minutes must be a non-negative integer' });
      }
    }

    if (appointmentId) {
      const { data: appt, error: apptErr } = await req.supabase
        .from('appointments')
        .select('id, vet_id')
        .eq('id', appointmentId)
        .maybeSingle();

      if (apptErr) {
        return res.status(400).json({ error: apptErr.message, details: apptErr });
      }

      if (!appt) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      if (appt.vet_id !== vetId) {
        return res.status(403).json({ error: 'Not assigned to this appointment' });
      }

      const { data: existing, error: exErr } = await req.supabase
        .from('tracking_sessions')
        .select('*')
        .eq('appointment_id', appointmentId)
        .maybeSingle();

      if (exErr) {
        return res.status(400).json({ error: exErr.message, details: exErr });
      }

      if (existing) {
        return res.status(200).json(existing);
      }

      const insertRow = {
        appointment_id: appointmentId,
        emergency_id: null,
        vet_lat: lat,
        vet_lng: lng,
        eta_minutes: eta,
      };

      const { data, error } = await req.supabase.from('tracking_sessions').insert(insertRow).select().single();

      if (error) {
        return res.status(400).json({ error: error.message, details: error });
      }

      return res.status(201).json(data);
    }

    const { data: emerg, error: emErr } = await req.supabase
      .from('emergencies')
      .select('id, assigned_vet_id')
      .eq('id', emergencyId)
      .maybeSingle();

    if (emErr) {
      return res.status(400).json({ error: emErr.message, details: emErr });
    }

    if (!emerg) {
      return res.status(404).json({ error: 'Emergency not found' });
    }

    if (emerg.assigned_vet_id !== vetId) {
      return res.status(403).json({ error: 'This emergency is not assigned to you' });
    }

    const { data: existingEmerg, error: exEmErr } = await req.supabase
      .from('tracking_sessions')
      .select('*')
      .eq('emergency_id', emergencyId)
      .maybeSingle();

    if (exEmErr) {
      return res.status(400).json({ error: exEmErr.message, details: exEmErr });
    }

    if (existingEmerg) {
      return res.status(200).json(existingEmerg);
    }

    const insertEmergRow = {
      appointment_id: null,
      emergency_id: emergencyId,
      vet_lat: lat,
      vet_lng: lng,
      eta_minutes: eta,
    };

    const { data: created, error: insErr } = await req.supabase
      .from('tracking_sessions')
      .insert(insertEmergRow)
      .select()
      .single();

    if (insErr) {
      return res.status(400).json({ error: insErr.message, details: insErr });
    }

    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create tracking session', details: err.message });
  }
}

module.exports = { getTrackingSession, patchVetLocation, createTrackingSession };
