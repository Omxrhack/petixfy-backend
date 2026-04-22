const { Router } = require('express');
const { validateSchema } = require('../middleware/validateSchema');
const { signupSchema, loginSchema, logoutSchema } = require('../schemas/auth.schema');
const { signup, login, logout } = require('../controllers/auth.controller');

const router = Router();

router.post('/signup', validateSchema(signupSchema), signup);
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
router.post('/logout', validateSchema(logoutSchema), logout);

module.exports = router;
