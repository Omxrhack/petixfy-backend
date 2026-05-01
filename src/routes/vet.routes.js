const { Router } = require('express');
const { validateSchema } = require('../middleware/validateSchema');
const { availabilitySchema, emergencyRespondSchema } = require('../schemas/vet.schema');
const {
  patchAvailability,
  getDashboard,
  getSchedule,
  getPetSummary,
  listActiveEmergencies,
  respondEmergency,
} = require('../controllers/vet.controller');

const router = Router();

router.patch('/availability', validateSchema(availabilitySchema), patchAvailability);
router.get('/dashboard', getDashboard);
router.get('/schedule', getSchedule);
router.get('/pets/:id/summary', getPetSummary);
router.get('/emergencies/active', listActiveEmergencies);
router.post('/emergencies/:id/respond', validateSchema(emergencyRespondSchema), respondEmergency);

module.exports = router;
