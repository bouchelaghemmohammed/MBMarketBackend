const express = require('express');
const router = express.Router();
const { getOrders, getOrderById, createOrder, updateOrderStatus, deleteOrder, getSellerOrders } = require('../controllers/orderController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, getOrders)
  .post(protect, createOrder);

router.get('/seller', protect, getSellerOrders);

router.route('/:id')
  .get(protect, getOrderById)
  .put(protect, updateOrderStatus)
  .delete(protect, deleteOrder);

module.exports = router;
