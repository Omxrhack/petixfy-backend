const { Router } = require('express');
const { createAppointment } = require('../controllers/appointments.controller');

const router = Router();

router.post('/', createAppointment);

module.exports = router;
