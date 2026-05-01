const { z } = require('zod');

const availabilitySchema = z.object({
  on_duty: z.boolean(),
});

const emergencyRespondSchema = z.object({
  accept: z.boolean(),
});

const isoDateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD');

const scheduleQuerySchema = z.object({
  date: isoDateString.optional(),
});

const dashboardQuerySchema = z.object({
  date: isoDateString.optional(),
});

module.exports = {
  availabilitySchema,
  emergencyRespondSchema,
  scheduleQuerySchema,
  dashboardQuerySchema,
};
