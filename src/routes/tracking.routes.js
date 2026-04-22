const { Router } = require('express');
const { getTrackingSession, patchVetLocation } = require('../controllers/tracking.controller');

const router = Router();

router.patch('/:id/location', patchVetLocation);
router.get('/:id', getTrackingSession);

module.exports = router;
