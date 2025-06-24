const mongoose = require('mongoose');

const userSubscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  userEmail: {
    type: String,
    required: true
  },
  
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    required: true
  },
  planType: {
    type: String,
    enum: ['free', 'pro', 'plus'],
    required: true
  },
  planName: {
    type: String,
    required: true // "Gói Pro", "Gói Plus"
  },
  
  // Thời gian subscription
  startDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  autoRenew: {
    type: Boolean,
    default: false
  },
  
  // Chi tiết features theo gói
  features: {
    // Posting features
    posting: {
      monthlyPostLimit: {
        type: Number,
        default: 3, // free: 3, pro/plus: unlimited (-1)
      },
      isUnlimitedPosts: {
        type: Boolean,
        default: false
      }
    },
    
    // VIP features  
    vipFeatures: {
      vipPostsPerMonth: {
        type: Number,
        default: 0 // free: 0, pro: 5, plus: unlimited (-1)
      },
      isUnlimitedVipPosts: {
        type: Boolean,
        default: false
      }
    },
    
    // Contact features
    contactFeatures: {
      canViewHiddenPhone: {
        type: Boolean,
        default: false
      },
      hiddenPhoneViewsPerMonth: {
        type: Number,
        default: 0 // có thể limit số lần xem/tháng
      }
    },
    
    // Processing features
    processingFeatures: {
      approvalTimeHours: {
        type: Number,
        default: 72 // free: 72h, pro: 24h, plus: 2h
      },
      prioritySupport: {
        type: Boolean,
        default: false
      }
    },
    
    // Premium features (chỉ Plus)
    premiumFeatures: {
      hasDetailedReports: {
        type: Boolean,
        default: false
      },
      hasBrandLogo: {
        type: Boolean,
        default: false
      },
      alwaysShowFirst: {
        type: Boolean,
        default: false
      }
    }
  },
  
  // Usage tracking trong chu kỳ hiện tại
  currentUsage: {
    // Reset mỗi tháng
    periodStartDate: {
      type: Date,
      default: Date.now
    },
    periodEndDate: {
      type: Date,
      default: function() {
        const date = new Date();
        return new Date(date.getFullYear(), date.getMonth() + 1, date.getDate());
      }
    },
    
    // Tracking usage
    usage: {
      postsCreated: {
        type: Number,
        default: 0
      },
      vipPostsUsed: {
        type: Number,
        default: 0
      },
      hiddenPhoneViews: {
        type: Number,
        default: 0
      }
    },
    
    lastResetDate: {
      type: Date,
      default: Date.now
    }
  },
  
  // Payment info
  paymentInfo: {
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment'
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
      enum: ['momo', 'vnpay', 'zalopay', 'bank_transfer', 'manual']
    },
    transactionId: {
      type: String
    }
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

// Middleware để auto-update khi save
userSubscriptionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// ✅ CẬP NHẬT: Index bao gồm userName để search
userSubscriptionSchema.index({ userId: 1, isActive: 1 });
userSubscriptionSchema.index({ userName: 1, isActive: 1 });
userSubscriptionSchema.index({ userEmail: 1, isActive: 1 });
userSubscriptionSchema.index({ endDate: 1, isActive: 1 });
userSubscriptionSchema.index({ planType: 1, isActive: 1 });

// Method để check hết hạn
userSubscriptionSchema.methods.isExpired = function() {
  return new Date() > this.endDate;
};

// Method để reset usage hàng tháng
userSubscriptionSchema.methods.resetMonthlyUsage = function() {
  const now = new Date();
  this.currentUsage.periodStartDate = now;
  this.currentUsage.periodEndDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
  this.currentUsage.usage = {
    postsCreated: 0,
    vipPostsUsed: 0,
    hiddenPhoneViews: 0
  };
  this.currentUsage.lastResetDate = now;
};

// ✅ THÊM: Method để get user display info
userSubscriptionSchema.methods.getUserDisplayInfo = function() {
  return {
    userId: this.userId,
    userName: this.userName,
    userEmail: this.userEmail,
    planType: this.planType,
    planName: this.planName,
    isActive: this.isActive,
    endDate: this.endDate
  };
};

// ✅ THÊM: Static method để tìm subscription theo user info
userSubscriptionSchema.statics.findByUserInfo = function(searchTerm) {
  const searchRegex = new RegExp(searchTerm, 'i');
  return this.find({
    $or: [
      { userName: searchRegex },
      { userEmail: searchRegex }
    ],
    isActive: true
  });
};

module.exports = mongoose.model('UserSubscription', userSubscriptionSchema);
