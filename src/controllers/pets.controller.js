/**
 * Mascotas: creación y listado por dueño (RLS en Supabase + comprobación de id).
 */

const { safeBasename } = require('../lib/safeBasename');

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

function petPayloadToRow(payload) {
  const row = {};
  const fields = [
    'name',
    'species',
    'breed',
    'birth_date',
    'sex',
    'is_neutered',
    'vaccines_up_to_date',
    'medical_notes',
    'temperament',
  ];

  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      row[field] = payload[field] ?? null;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'weight')) {
    row.weight = payload.weight != null ? payload.weight : null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'weight_kg')) {
    row.weight_kg = payload.weight_kg != null ? payload.weight_kg : null;
    if (!Object.prototype.hasOwnProperty.call(payload, 'weight')) {
      row.weight = payload.weight_kg != null ? payload.weight_kg : null;
    }
  }

  return row;
}

async function createPet(req, res) {
  try {
    const ownerId = req.user.id;
    const row = {
      ...petPayloadToRow(req.body),
      owner_id: ownerId,
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

async function updatePet(req, res) {
  try {
    const petId = req.params.id;
    const ownerId = req.user.id;
    const updates = petPayloadToRow(req.body);

    const { data, error } = await req.supabase
      .from('pets')
      .update(updates)
      .eq('id', petId)
      .eq('owner_id', ownerId)
      .select()
      .maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    if (!data) {
      return res.status(404).json({ error: 'Pet not found or not owned by user' });
    }

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update pet', details: err.message });
  }
}

async function deletePet(req, res) {
  try {
    const petId = req.params.id;
    const ownerId = req.user.id;

    const { data, error } = await req.supabase
      .from('pets')
      .delete()
      .eq('id', petId)
      .eq('owner_id', ownerId)
      .select('id')
      .maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    if (!data) {
      return res.status(404).json({ error: 'Pet not found or not owned by user' });
    }

    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete pet', details: err.message });
  }
}

async function getPetRecord(req, res) {
  try {
    const petId = req.params.id;
    const ownerId = req.user.id;

    const { data: pet, error: petError } = await req.supabase
      .from('pets')
      .select('*')
      .eq('id', petId)
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (petError) {
      return res.status(400).json({ error: petError.message, details: petError });
    }
    if (!pet) {
      return res.status(404).json({ error: 'Pet not found or not owned by user' });
    }

    const [appointments, emergencies, triageLogs] = await Promise.all([
      req.supabase
        .from('appointments')
        .select('id, scheduled_at, status, notes, vet_id, vet:profiles!appointments_vet_id_fkey(id, full_name, avatar_url)')
        .eq('pet_id', petId)
        .eq('owner_id', ownerId)
        .order('scheduled_at', { ascending: false })
        .limit(40),
      req.supabase
        .from('emergencies')
        .select('id, symptoms, status, created_at, assigned_vet_id, vet:profiles!emergencies_assigned_vet_id_fkey(id, full_name, avatar_url)')
        .eq('pet_id', petId)
        .order('created_at', { ascending: false })
        .limit(40),
      req.supabase
        .from('triage_logs')
        .select('id, answers, urgency_level, recommendation, created_at')
        .eq('pet_id', petId)
        .order('created_at', { ascending: false })
        .limit(40),
    ]);

    for (const result of [appointments, emergencies, triageLogs]) {
      if (result.error) {
        return res.status(400).json({ error: result.error.message, details: result.error });
      }
    }

    return res.json({
      pet,
      appointments: appointments.data ?? [],
      emergencies: emergencies.data ?? [],
      triage_logs: triageLogs.data ?? [],
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load pet record', details: err.message });
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

module.exports = { createPet, updatePet, deletePet, getPetRecord, listPetsByOwner, uploadPetPhoto };
