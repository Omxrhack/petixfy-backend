const { z } = require('zod');

const createTrackingSessionSchema = z
  .object({
    appointment_id: z.string().uuid().optional(),
    emergency_id: z.string().uuid().optional(),
    vet_lat: z.coerce.number().finite(),
    vet_lng: z.coerce.number().finite(),
    eta_minutes: z.coerce.number().int().min(0).optional(),
  })
  .superRefine((data, ctx) => {
    const hasAppt = Boolean(data.appointment_id);
    const hasEmer = Boolean(data.emergency_id);
    if (hasAppt === hasEmer) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Exactly one of appointment_id or emergency_id is required',
      });
    }
  });

module.exports = { createTrackingSessionSchema };
