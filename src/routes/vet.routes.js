const { Router } = require('express');
const { uploadPetPhotoMiddleware } = require('../middleware/uploadPetPhoto');
const { validateSchema } = require('../middleware/validateSchema');
const { availabilitySchema, emergencyRespondSchema } = require('../schemas/vet.schema');
const {
  patchAvailability,
  getDashboard,
  getSchedule,
  getPetSummary,
  listActiveEmergencies,
  respondEmergency,
  uploadPetPhotoAsVet,
} = require('../controllers/vet.controller');

const router = Router();

router.patch('/availability', validateSchema(availabilitySchema), patchAvailability);
router.get('/dashboard', getDashboard);
router.get('/schedule', getSchedule);
router.get('/pets/:id/summary', getPetSummary);
router.post('/pets/:id/upload-photo', uploadPetPhotoMiddleware, uploadPetPhotoAsVet);
router.get('/emergencies/active', listActiveEmergencies);
router.post('/emergencies/:id/respond', validateSchema(emergencyRespondSchema), respondEmergency);

module.exports = router;
