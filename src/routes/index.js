const { Router } = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const petsRoutes = require('./pets.routes');
const appointmentsRoutes = require('./appointments.routes');
const emergenciesRoutes = require('./emergencies.routes');
const productsRoutes = require('./products.routes');
const rewardsRoutes = require('./rewards.routes');
const triageRoutes = require('./triage.routes');
const trackingRoutes = require('./tracking.routes');
const vetRoutes = require('./vet.routes');
const authRoutes = require('./authRoutes');
const { requireVet } = require('../middleware/requireVet');

const router = Router();

router.use('/auth', authRoutes);
router.use('/pets', requireAuth, petsRoutes);
router.use('/appointments', requireAuth, appointmentsRoutes);
router.use('/emergencies', requireAuth, emergenciesRoutes);
router.use('/products', productsRoutes);
router.use('/rewards', requireAuth, rewardsRoutes);
router.use('/triage', requireAuth, triageRoutes);
router.use('/tracking', requireAuth, trackingRoutes);
router.use('/vet', requireAuth, requireVet, vetRoutes);

module.exports = router;
