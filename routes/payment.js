const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");
const { protect } = require("../middleware/auth");
const Payment = require("../models/Payment");

// Create payment
router.post("/create", protect, paymentController.createPayment);

// Get payment history
router.get("/history", protect, paymentController.getPaymentHistory);

// MoMo payment endpoints
router.get("/momo/callback", paymentController.handleMoMoCallback);
router.post("/momo/ipn", paymentController.handleMoMoCallback);

// VNPay payment endpoints
router.get("/vnpay/callback", paymentController.handleVNPayCallback);
router.post("/vnpay/ipn", paymentController.handleVNPayCallback);

router.get("/usage/check", protect, paymentController.checkUsage);
router.post("/usage/update", protect, paymentController.updateUsage);
router.get("/usage/current", protect, paymentController.getCurrentUsage);

// Get payment status
router.get("/status/:orderId", protect, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { provider } = req.query;

    const payment = await Payment.findOne({
      _id: orderId,
      userId: req.user.id,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error getting payment status",
      error: error.message,
    });
  }
});

// Get payment statistics
router.get("/stats", protect, async (req, res) => {
  try {
    const { year, status } = req.query;
    const stats = await paymentController.getMonthlyPaymentTotal(
      year ? parseInt(year) : new Date().getFullYear(),
      status
    );

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error getting payment statistics",
      error: error.message,
    });
  }
});

module.exports = router;