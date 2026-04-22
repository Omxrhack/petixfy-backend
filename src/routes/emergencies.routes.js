const { Router } = require('express');
const { createEmergency } = require('../controllers/emergencies.controller');

const router = Router();

/**
 * @openapi
 * /api/emergencies:
 *   post:
 *     tags:
 *       - Emergencies
 *     summary: Create a new emergency
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pet_id
 *               - symptoms
 *               - latitude
 *               - longitude
 *             properties:
 *               pet_id:
 *                 type: string
 *                 format: uuid
 *               symptoms:
 *                 type: string
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               status:
 *                 type: string
 *                 example: open
 *     responses:
 *       201:
 *         description: Emergency created
 *       400:
 *         description: Validation or database error
 *       401:
 *         description: Authentication required or token invalid
 */
router.post('/', createEmergency);

module.exports = router;
