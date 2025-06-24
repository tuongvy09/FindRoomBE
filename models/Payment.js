const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    required: true
  },
  userSubscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserSubscription'
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'VND'
  },
  paymentMethod: {
    type: String,
    enum: ['momo', 'vnpay', 'zalopay', 'bank_transfer', 'manual'],
    required: true
  },
  paymentGatewayId: {
    type: String // ID từ cổng thanh toán
  },
  transactionId: {
    type: String,
    unique: true,
    sparse: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  paymentDate: {
    type: Date
  },
  description: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed // Lưu thông tin thêm từ payment gateway
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index cho query
paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ transactionId: 1 });
paymentSchema.index({ paymentGatewayId: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
