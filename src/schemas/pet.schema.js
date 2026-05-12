const { z } = require('zod');

const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => {
      if (value == null) return null;
      return value.length > 0 ? value : null;
    });

const petPayloadSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(120),
  species: z.string().trim().min(1, 'species is required').max(80),
  breed: optionalText(120),
  birth_date: optionalText(20),
  weight: z.union([z.coerce.number().positive(), z.null()]).optional(),
  sex: optionalText(40),
  weight_kg: z.union([z.coerce.number().positive(), z.null()]).optional(),
  is_neutered: z.boolean().optional().nullable(),
  vaccines_up_to_date: optionalText(80),
  medical_notes: optionalText(1000),
  temperament: optionalText(300),
});

const createPetSchema = petPayloadSchema;

const updatePetSchema = petPayloadSchema.partial().refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field is required',
});

module.exports = { createPetSchema, updatePetSchema };
