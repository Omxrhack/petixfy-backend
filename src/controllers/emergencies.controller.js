/**
 * Emergencias 24/7 (coordenadas + síntomas).
 */

const { createSupabaseServiceRoleClient } = require('../lib/supabaseServiceRole');
const { assignNearestOnDutyVet } = require('../services/assignEmergencyVet');
const { isValidAssignableVet } = require('../services/vetValidation');

async function createEmergency(req, res) {
  try {
    const { pet_id, symptoms, latitude, longitude, status, preferred_vet_id } = req.body;

    if (
      !pet_id ||
      symptoms == null ||
      symptoms === '' ||
      latitude == null ||
      longitude == null
    ) {
      return res.status(400).json({
        error: 'pet_id, symptoms, latitude, and longitude are required',
      });
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: 'latitude and longitude must be numbers' });
    }

    const row = {
      pet_id,
      symptoms,
      latitude: lat,
      longitude: lng,
      status: status ?? 'open',
    };

    const { data, error } = await req.supabase.from('emergencies').insert(row).select().single();

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    let assignedId = null;

    if (preferred_vet_id) {
      const ok = await isValidAssignableVet(preferred_vet_id);
      if (ok) {
        let admin;
        try {
          admin = createSupabaseServiceRoleClient();
        } catch (e) {
          console.warn('[createEmergency] service role unavailable:', e?.message ?? e);
        }
        if (admin) {
          const { error: uErr } = await admin
            .from('emergencies')
            .update({ assigned_vet_id: preferred_vet_id })
            .eq('id', data.id);
          if (!uErr) {
            assignedId = preferred_vet_id;
          }
        }
      }
    }

    if (!assignedId) {
      assignedId = await assignNearestOnDutyVet(data.id, lat, lng);
    }

    const merged = { ...data, assigned_vet_id: assignedId ?? data.assigned_vet_id };
    return res.status(201).json(merged);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create emergency', details: err.message });
  }
}

module.exports = { createEmergency };
