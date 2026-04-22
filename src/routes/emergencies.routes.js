const { Router } = require('express');
const { createEmergency } = require('../controllers/emergencies.controller');

const router = Router();

router.post('/', createEmergency);

module.exports = router;
