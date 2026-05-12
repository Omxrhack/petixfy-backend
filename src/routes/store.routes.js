const { Router } = require('express');
const { validateSchema } = require('../middleware/validateSchema');
const { createStoreOrderSchema } = require('../schemas/store.schema');
const {
  createOrder,
  listMyOrders,
  getMyOrder,
  cancelMyOrder,
} = require('../controllers/store.controller');

const router = Router();

router.get('/orders', listMyOrders);
router.post('/orders', validateSchema(createStoreOrderSchema), createOrder);
router.get('/orders/:id', getMyOrder);
router.patch('/orders/:id/cancel', cancelMyOrder);

module.exports = router;
