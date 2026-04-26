const { z } = require('zod');

const registerSchema = z.object({
  email: z.string().trim().email('email must be a valid email address'),
  password: z.string().min(8, 'password must be at least 8 characters long'),
});

const verifyOtpSchema = z.object({
  email: z.string().trim().email('email must be a valid email address'),
  token: z.string().trim().regex(/^\d{6,10}$/, 'token must be a 6-10 digit code'),
});

const resendOtpSchema = z.object({
  email: z.string().trim().email('email must be a valid email address'),
});

const mobilePhoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{8,15}$/, 'phone must be a valid mobile number');

const clientOnboardingSchema = z.object({
  role: z.literal('client'),
  full_name: z.string().trim().min(1, 'full_name is required'),
  phone: mobilePhoneSchema,
  avatar_url: z.string().trim().url('avatar_url must be a valid URL').optional().or(z.literal('')),
  client_details: z.object({
    address_text: z.string().trim().min(5, 'address_text is required'),
    address_notes: z.string().trim().max(500).optional().or(z.literal('')),
    latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
    longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
  }),
  pet_profile: z.object({
    name: z.string().trim().min(1, 'pet_profile.name is required'),
    species: z.string().trim().min(1, 'pet_profile.species is required'),
    breed: z.string().trim().optional().or(z.literal('')),
    sex: z.enum(['male', 'female']),
    birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'birth_date must be YYYY-MM-DD').optional(),
    weight_kg: z.coerce.number().positive().optional(),
    is_neutered: z.boolean(),
    vaccines_up_to_date: z.enum(['yes', 'no', 'unsure']),
    medical_notes: z.string().trim().max(1000).optional().or(z.literal('')),
    temperament: z.enum(['friendly', 'nervous', 'aggressive']),
  }),
});

const vetOnboardingSchema = z.object({
  role: z.literal('vet'),
  full_name: z.string().trim().min(1, 'full_name is required'),
  phone: mobilePhoneSchema,
  avatar_url: z.string().trim().url('avatar_url must be a valid URL'),
  vet_details: z.object({
    cedula: z.string().trim().min(5, 'cedula is required'),
    university: z.string().trim().optional().or(z.literal('')),
    experience_years: z.enum(['1-3', '4-7', '8+']),
    base_latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
    base_longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
    coverage_radius_km: z.coerce.number().min(1).max(100),
    has_vehicle: z.boolean(),
  }),
  vet_services: z.object({
    specialty: z.enum(['medicina_general', 'urgencias', 'exoticos', 'nutricion', 'fisioterapia']),
    offered_services: z.array(z.string().trim().min(1)).min(1, 'offered_services must have at least one item'),
    accepts_emergencies: z.boolean(),
    schedule_json: z.object({
      label: z.string().trim().min(1, 'schedule_json.label is required'),
    }),
  }),
  vet_finances: z.object({
    clabe: z.string().trim().regex(/^\d{18}$/, 'clabe must be 18 digits'),
    bank_name: z.string().trim().min(2, 'bank_name is required'),
    rfc: z.string().trim().max(13).optional().or(z.literal('')),
  }),
});

const onboardingSchema = z.discriminatedUnion('role', [clientOnboardingSchema, vetOnboardingSchema]);

const loginSchema = z.object({
  email: z.string().trim().email('email must be a valid email address'),
  password: z.string().min(1, 'password is required'),
});

module.exports = { registerSchema, verifyOtpSchema, resendOtpSchema, onboardingSchema, loginSchema };
