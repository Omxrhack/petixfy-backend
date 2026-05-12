const { Router } = require('express');
const { validateSchema } = require('../middleware/validateSchema');
const {
  createAppointmentSchema,
  ownerAppointmentStatusSchema,
} = require('../schemas/appointment.schema');
const {
  createAppointment,
  updateMyAppointmentStatus,
  listMyAppointments,
  getMyVet,
} = require('../controllers/appointments.controller');

const router = Router();

router.get('/my-vet', getMyVet);
router.get('/', listMyAppointments);
router.post('/', validateSchema(createAppointmentSchema), createAppointment);
router.patch('/:id/status', validateSchema(ownerAppointmentStatusSchema), updateMyAppointmentStatus);

module.exports = router;
