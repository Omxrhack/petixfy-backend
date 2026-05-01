const { Router } = require('express');
const { createAppointment, listMyAppointments } = require('../controllers/appointments.controller');

const router = Router();

router.get('/', listMyAppointments);
router.post('/', createAppointment);

module.exports = router;
