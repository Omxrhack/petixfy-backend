const { Router } = require('express');
const { listProducts } = require('../controllers/products.controller');

const router = Router();

router.get('/', listProducts);

module.exports = router;
