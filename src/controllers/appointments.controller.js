/**
 * Citas a domicilio.
 */

async function createAppointment(req, res) {
  try {
    const { pet_id, scheduled_at, notes, status } = req.body;

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

    const { data, error } = await req.supabase.from('appointments').insert(row).select().single();

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create appointment', details: err.message });
  }
}

module.exports = { createAppointment };
