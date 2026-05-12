const { z } = require('zod');

const createAppointmentSchema = z.object({
  pet_id: z.string().uuid(),
  scheduled_at: z.string().trim().min(1),
  notes: z.string().trim().max(2000).optional().nullable(),
  vet_id: z.string().uuid().optional().nullable(),
  visit_latitude: z.coerce.number().finite().optional(),
  visit_longitude: z.coerce.number().finite().optional(),
});

const ownerAppointmentStatusSchema = z.object({
  status: z.literal('cancelled'),
});

module.exports = { createAppointmentSchema, ownerAppointmentStatusSchema };
