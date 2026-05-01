const { Router } = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const { validateSchema } = require('../middleware/validateSchema');
const {
  registerSchema,
  verifyOtpSchema,
  resendOtpSchema,
  onboardingSchema,
  loginSchema,
  refreshSessionSchema,
} = require('../schemas/auth.schema');
const {
  register,
  verifyOtp,
  resendOtp,
  completeOnboarding,
  login,
  refreshSession,
  me,
} = require('../controllers/auth.controller');

const router = Router();

router.post('/register', validateSchema(registerSchema), register);
router.post('/verify-otp', validateSchema(verifyOtpSchema), verifyOtp);
router.post('/resend-otp', validateSchema(resendOtpSchema), resendOtp);
router.post('/onboarding', requireAuth, validateSchema(onboardingSchema), completeOnboarding);
router.post('/refresh', validateSchema(refreshSessionSchema), refreshSession);
router.get('/me', requireAuth, me);
/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Login user with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: owner@vetgo.app
 *               password:
 *                 type: string
 *                 example: secret123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 access_token:
 *                   type: string
 *                 refresh_token:
 *                   type: string
 *                 expires_in:
 *                   type: integer
 *                 token_type:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     email:
 *                       type: string
 *                     phone:
 *                       type: string
 *                       nullable: true
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', validateSchema(loginSchema), login);

module.exports = router;
