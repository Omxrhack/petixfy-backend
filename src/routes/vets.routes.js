const { Router } = require('express');
const { listVetsCatalog } = require('../controllers/vetsCatalog.controller');

const router = Router();

router.get('/', listVetsCatalog);

module.exports = router;
