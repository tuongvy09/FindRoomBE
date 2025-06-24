// routes/userSubscriptionRoutes.js
const express = require('express');
const router = express.Router();
const { 
  getUserTransactionHistory, 
  getCurrentSubscription 
} = require('../controllers/userSubscriptionController');
const { verifyToken } = require('../controllers/middlewareControllers');

// Lấy lịch sử giao dịch của user
router.get('/history/:userId', verifyToken, getUserTransactionHistory);

// Lấy subscription hiện tại
router.get('/current/:userId', verifyToken, getCurrentSubscription);

module.exports = router;