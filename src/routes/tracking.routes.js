const { Router } = require('express');
const { validateSchema } = require('../middleware/validateSchema');
const { createTrackingSessionSchema } = require('../schemas/tracking.schema');
const { getTrackingSession, patchVetLocation, createTrackingSession } = require('../controllers/tracking.controller');

const router = Router();

router.post('/sessions', validateSchema(createTrackingSessionSchema), createTrackingSession);
router.patch('/:id/location', patchVetLocation);
router.get('/:id', getTrackingSession);

module.exports = router;
