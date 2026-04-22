/**
 * Triage IA: guarda respuestas y devuelve recomendación según urgencia.
 */

const ALLOWED_URGENCY = new Set(['bajo', 'medio', 'alto']);

function recommendationForUrgency(urgency) {
  switch (urgency) {
    case 'alto':
      return 'Pasa a urgencias 24/7';
    case 'medio':
      return 'Agenda cita prioritaria en las próximas 24 horas';
    case 'bajo':
    default:
      return 'Agenda cita normal';
  }
}

async function createTriage(req, res) {
  try {
    const { pet_id: petId, answers, urgency_level: urgencyLevel } = req.body;

    if (!petId) {
      return res.status(400).json({ error: 'pet_id is required' });
    }

    if (answers == null || typeof answers !== 'object' || Array.isArray(answers)) {
      return res.status(400).json({ error: 'answers must be a JSON object' });
    }

    if (!urgencyLevel || !ALLOWED_URGENCY.has(urgencyLevel)) {
      return res.status(400).json({ error: 'urgency_level must be one of: bajo, medio, alto' });
    }

    const ownerId = req.user.id;

    const { data: pet, error: petError } = await req.supabase
      .from('pets')
      .select('id, owner_id')
      .eq('id', petId)
      .maybeSingle();

    if (petError) {
      return res.status(400).json({ error: petError.message, details: petError });
    }

    if (!pet || pet.owner_id !== ownerId) {
      return res.status(403).json({ error: 'pet_id does not belong to the authenticated user' });
    }

    const recommendation = recommendationForUrgency(urgencyLevel);

    const row = {
      pet_id: petId,
      answers,
      urgency_level: urgencyLevel,
      recommendation,
    };

    const { data, error } = await req.supabase.from('triage_logs').insert(row).select().single();

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    return res.status(201).json({
      log: data,
      recommendation,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save triage', details: err.message });
  }
}

module.exports = { createTriage };
