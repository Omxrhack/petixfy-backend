const { Router } = require('express');
const { createAppointment, listMyAppointments, getMyVet } = require('../controllers/appointments.controller');

const router = Router();

router.get('/my-vet', getMyVet);
router.get('/', listMyAppointments);
router.post('/', createAppointment);

module.exports = router;
