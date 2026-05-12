const { Router } = require('express');
const { uploadPetPhotoMiddleware } = require('../middleware/uploadPetPhoto');
const { validateSchema } = require('../middleware/validateSchema');
const {
  availabilitySchema,
  emergencyRespondSchema,
  createVetAppointmentSchema,
  vetAppointmentStatusSchema,
} = require('../schemas/vet.schema');
const {
  patchAvailability,
  getDashboard,
  getSchedule,
  getPetSummary,
  listActiveEmergencies,
  respondEmergency,
  closeEmergency,
  uploadPetPhotoAsVet,
  claimAppointment,
  updateAssignedAppointmentStatus,
  createVetAppointment,
} = require('../controllers/vet.controller');

const router = Router();

router.patch('/availability', validateSchema(availabilitySchema), patchAvailability);
router.patch('/appointments/:id/claim', claimAppointment);
router.patch('/appointments/:id/status', validateSchema(vetAppointmentStatusSchema), updateAssignedAppointmentStatus);
router.post('/appointments', validateSchema(createVetAppointmentSchema), createVetAppointment);
router.get('/dashboard', getDashboard);
router.get('/schedule', getSchedule);
router.get('/pets/:id/summary', getPetSummary);
router.post('/pets/:id/upload-photo', uploadPetPhotoMiddleware, uploadPetPhotoAsVet);
router.get('/emergencies/active', listActiveEmergencies);
router.post('/emergencies/:id/respond', validateSchema(emergencyRespondSchema), respondEmergency);
router.patch('/emergencies/:id/close', closeEmergency);

module.exports = router;
