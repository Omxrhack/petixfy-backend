const { Router } = require('express');
const { getMyRewards, addRewardsPoints } = require('../controllers/rewards.controller');
const { requireServiceOrAdmin } = require('../middleware/requireServiceOrAdmin');

const router = Router();

router.get('/me', getMyRewards);
router.post('/add', requireServiceOrAdmin, addRewardsPoints);

module.exports = router;
