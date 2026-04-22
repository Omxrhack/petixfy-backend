const { Router } = require('express');
const { createTriage } = require('../controllers/triage.controller');

const router = Router();

router.post('/', createTriage);

module.exports = router;
