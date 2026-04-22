/**
 * Emergencias 24/7 (coordenadas + síntomas).
 */

async function createEmergency(req, res) {
  try {
    const { pet_id, symptoms, latitude, longitude, status } = req.body;

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

    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create emergency', details: err.message });
  }
}

module.exports = { createEmergency };
