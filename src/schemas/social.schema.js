const { z } = require('zod');

const followSchema = z.object({
  following_id: z.string().uuid('following_id must be a valid UUID'),
});

const createPostSchema = z.object({
  body: z.string().trim().min(1, 'body is required').max(2000),
  image_urls: z.array(z.string().url()).optional().default([]),
});

const createRepostSchema = z.object({
  quote_body: z
    .string()
    .max(1000)
    .optional()
    .transform((s) => (s === undefined || s.trim() === '' ? undefined : s.trim())),
});

const createReviewSchema = z.object({
  reviewee_id: z.string().uuid(),
  appointment_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

const updateProfileSchema = z.object({
  bio: z.string().trim().max(500).optional(),
  location: z.string().trim().max(200).optional(),
  years_experience: z.number().int().min(0).max(60).optional(),
});

const createPostCommentSchema = z.object({
  body: z.string().trim().min(1, 'El comentario no puede estar vacío').max(2000),
});

module.exports = {
  followSchema,
  createPostSchema,
  createRepostSchema,
  createReviewSchema,
  updateProfileSchema,
  createPostCommentSchema,
};
