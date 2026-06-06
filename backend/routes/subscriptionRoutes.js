/*
 * Roman Urdu comments:
 * Ye file subscription aur payment routes define karti hai.
 * Plans, status, checkout/manual payment aur admin approval endpoints yahan map hotay hain.
 */
const express = require('express');
const {
  confirmStripe,
  createSubscriptionOrder,
  listPayments,
  status,
  webhook
} = require('../controllers/subscriptionController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/webhook', webhook);
router.use(protect);
router.get('/status', status);
router.post('/create-order', createSubscriptionOrder);
router.post('/confirm-stripe', confirmStripe);
router.get('/payments', listPayments);

module.exports = router;
