/**
 * Citas a domicilio.
 */

const { isValidAssignableVet } = require('../services/vetValidation');

async function createAppointment(req, res) {
  try {
    const { pet_id, scheduled_at, notes, status, vet_id } = req.body;

    if (!pet_id || !scheduled_at) {
      return res.status(400).json({ error: 'pet_id and scheduled_at are required' });
    }

    const ownerId = req.user.id;

    const { data: pet, error: petError } = await req.supabase
      .from('pets')
      .select('id, owner_id')
      .eq('id', pet_id)
      .maybeSingle();

    if (petError) {
      return res.status(400).json({ error: petError.message, details: petError });
    }

    if (!pet || pet.owner_id !== ownerId) {
      return res.status(403).json({ error: 'pet_id does not belong to the authenticated user' });
    }

    const row = {
      pet_id,
      owner_id: ownerId,
      scheduled_at,
      notes: notes ?? null,
      status: status ?? 'pending',
    };

    if (vet_id) {
      const ok = await isValidAssignableVet(vet_id);
      if (ok) {
        row.vet_id = vet_id;
      }
    }

    const { data, error } = await req.supabase.from('appointments').insert(row).select().single();

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create appointment', details: err.message });
  }
}

async function listMyAppointments(req, res) {
  try {
    const ownerId = req.user.id;

    const { data, error } = await req.supabase
      .from('appointments')
      .select(
        'id, vet_id, scheduled_at, status, notes, pet_id, pets(id, name, species, breed, photo_url), vet:profiles!appointments_vet_id_fkey(id, full_name, avatar_url, phone)',
      )
      .eq('owner_id', ownerId)
      .order('scheduled_at', { ascending: true })
      .limit(80);

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    const appointments = (data ?? []).map((a) => ({
      id: a.id,
      vet_id: a.vet_id,
      scheduled_at: a.scheduled_at,
      status: a.status,
      notes: a.notes,
      pet: a.pets,
      vet: a.vet ?? null,
    }));

    return res.json({ appointments });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list appointments', details: err.message });
  }
}

module.exports = { createAppointment, listMyAppointments };
