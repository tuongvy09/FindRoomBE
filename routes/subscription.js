const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const { protect } = require('../middleware/auth');

// Lấy tất cả gói đăng ký (public)
router.get('/', subscriptionController.getAllSubscriptions);

// Các route cần authentication
router.use(protect);

// Lấy gói đăng ký hiện tại của user
router.get('/current', subscriptionController.getUserSubscription);

// Kiểm tra khả năng sử dụng tính năng
router.get('/check-feature/:feature', subscriptionController.checkFeatureUsage);

// Cập nhật usage
router.post('/update-usage', subscriptionController.updateFeatureUsage);

module.exports = router;
