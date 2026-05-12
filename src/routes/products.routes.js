const { Router } = require('express');
const { listProducts, getProduct } = require('../controllers/products.controller');

const router = Router();

router.get('/', listProducts);
router.get('/:id', getProduct);

module.exports = router;
