/**
 * Mascotas: creación y listado por dueño (RLS en Supabase + comprobación de id).
 */

function safeBasename(originalname) {
  const base = (originalname || 'photo').split(/[/\\]/).pop() || 'photo';
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_');
  return (cleaned || 'photo').slice(0, 120);
}

/**
 * Sube la imagen a Storage (bucket vetgo-images) y guarda la URL pública en pets.photo_url.
 */
async function uploadPetPhoto(req, res) {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'photo file is required (multipart field name: photo)' });
    }

    const petId = req.params.id;
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
      return res.status(403).json({ error: 'You can only upload a photo for your own pet' });
    }

    const objectPath = `${ownerId}/${petId}/${Date.now()}-${safeBasename(req.file.originalname)}`;

    const { error: uploadError } = await req.supabase.storage
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
    } = req.supabase.storage.from('vetgo-images').getPublicUrl(objectPath);

    const { data, error } = await req.supabase
      .from('pets')
      .update({ photo_url: publicUrl })
      .eq('id', petId)
      .eq('owner_id', ownerId)
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

async function createPet(req, res) {
  try {
    const { name, species, breed, birth_date, weight } = req.body;

    const ownerId = req.user.id;
    const row = {
      owner_id: ownerId,
      name,
      species,
      breed: breed ?? null,
      birth_date: birth_date ?? null,
      weight: weight != null ? weight : null,
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

module.exports = { createPet, listPetsByOwner, uploadPetPhoto };
