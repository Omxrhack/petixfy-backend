const { z } = require('zod');

const signupSchema = z.object({
  email: z.string().email('email must be a valid email address'),
  password: z.string().min(8, 'password must be at least 8 characters long'),
  full_name: z.string().min(1, 'full_name is required'),
  phone: z.string().min(1, 'phone is required'),
  role: z.enum(['client', 'vet']),
});

const loginSchema = z.object({
  email: z.string().email('email must be a valid email address'),
  password: z.string().min(1, 'password is required'),
});

const logoutSchema = z.object({
  refresh_token: z.string().min(1, 'refresh_token is required'),
});

module.exports = { signupSchema, loginSchema, logoutSchema };
