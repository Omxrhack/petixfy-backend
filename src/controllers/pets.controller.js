/**
 * Mascotas: creación y listado por dueño (RLS en Supabase + comprobación de id).
 */

async function createPet(req, res) {
  try {
    const { name, species, breed, birth_date, weight } = req.body;

    if (!name || !species) {
      return res.status(400).json({ error: 'name and species are required' });
    }

    const ownerId = req.user.id;
    const row = {
      owner_id: ownerId,
      name,
      species,
      breed: breed ?? null,
      birth_date: birth_date ?? null,
      weight: weight != null ? Number(weight) : null,
    };

    const { data, error } = await req.supabase.from('pets').insert(row).select().single();

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create pet', details: err.message });
  }
}

async function listPetsByOwner(req, res) {
  try {
    const { ownerId } = req.params;

    if (ownerId !== req.user.id) {
      return res.status(403).json({ error: 'You can only list your own pets' });
    }

    const { data, error } = await req.supabase
      .from('pets')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    return res.json(data ?? []);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list pets', details: err.message });
  }
}

module.exports = { createPet, listPetsByOwner };
