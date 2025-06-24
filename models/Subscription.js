const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    enum: ['free', 'pro', 'plus']
  },
  displayName: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    default: 0
  },
  duration: {
    type: Number, // số ngày
    required: true,
    default: 30
  },
  features: {
    maxPosts: {
      type: Number,
      default: 3 // Free: 3, Pro & Plus: unlimited (-1)
    },
    postDuration: {
      type: Number,
      default: 7 // Free: 7 ngày, Pro & Plus: 30 ngày
    },
    vipPosts: {
      type: Number,
      default: 0 // Pro: 5, Plus: unlimited (-1)
    },
    canViewHiddenPhone: {
      type: Boolean,
      default: false
    },
    depositFeeDiscount: {
      type: Number,
      default: 0 // Pro: 50%, Plus: 100%
    },
    prioritySupport: {
      type: Boolean,
      default: false
    },
    fastApproval: {
      type: Number,
      default: 48 // giờ - Free: 48h, Pro: 24h, Plus: 2h
    },
    analytics: {
      type: Boolean,
      default: false
    },
    customBranding: {
      type: Boolean,
      default: false
    },
    alwaysOnTop: {
      type: Boolean,
      default: false
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
