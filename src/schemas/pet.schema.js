const { z } = require('zod');

const createPetSchema = z.object({
  name: z.string().min(1, 'name is required'),
  species: z.enum(['Perro', 'Gato', 'Otro']),
  breed: z.string().optional().nullable(),
  birth_date: z.string().optional().nullable(),
  weight: z.union([z.coerce.number().positive(), z.null()]).optional(),
});

module.exports = { createPetSchema };
