const mongoose = require("mongoose");

const PostSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: [
        "Căn hộ/chung cư",
        "Nhà ở",
        "Đất",
        "Văn phòng, mặt bằng kinh doanh",
        "phòng trọ",
      ],
      required: true,
    },
    transactionType: {
      type: String,
      enum: ["Cho thuê", "Cần bán"],
      required: true,
    },
    address: {
      exactaddress: {
        type: String,
        required: true,
      },
      province: {
        type: String,
        required: true,
      },
      district: {
        type: String,
        required: true,
      },
      ward: {
        type: String,
        required: true,
      },
    },
    projectName: {
      type: String, // Tên dự án đất nền hoặc tòa nhà
    },
    locationDetails: {
      apartmentCode: { type: String }, // Mã căn
      block: { type: String }, // Block, Tháp
      floor: { type: String }, // Tầng số
      subArea: { type: String }, // Tên phân khu/lô
    },
    propertyDetails: {
      propertyCategory: { type: String }, // Loại hình nhà ở, đất, văn phòng
      apartmentType: { type: String }, // Loại hình căn hộ
      bedroomCount: { type: String }, // Số phòng ngủ
      bathroomCount: { type: String }, // Số phòng vệ sinh
      floorCount: { type: Number }, // Tổng số tầng
      balconyDirection: { type: String }, // Hướng ban công
      mainDoorDirection: { type: String }, // Hướng cửa chính
      landDirection: { type: String }, // Hướng đất
    },
    features: {
      type: [String], // Các đặc điểm như "Hẻm xe hơi", "Nhà tóp hậu", v.v.
    },
    legalContract: {
      type: String, // Giấy tờ pháp lý
    },
    furnitureStatus: {
      type: String, // Tình trạng nội thất
    },
    areaUse: {
      type: Number, // Diện tích đất sử dụng
    },
    area: {
      type: Number, // Diện tích đất
    },
    typeArea: {
      type: String,
      enum: ["m²", "hecta"],
      default: "m²",
    },
    dimensions: {
      width: { type: Number }, // Chiều ngang
      length: { type: Number }, // Chiều dài
    },
    price: {
      type: Number, // Giá bán hoặc giá thuê
      required: true,
    },
    deposit: {
      type: Number, // Tiền cọc (nếu có)
    },
    userType: {
      type: String,
      enum: ["Cá nhân", "Mô giới"],
      required: true,
    },
    images: {
      type: [String], // Danh sách URL hình ảnh
    },
    videoUrl: {
      type: String,
    },
    contactInfo: {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      username: {
        type: String,
        required: true,
      },
      phoneNumber: {
        type: String,
        required: false,
      },
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "update"],
      default: "pending",
    },
    visibility: {
      type: String,
      enum: ["visible", "hidden"],
      default: "hidden",
    },
    expiryDate: {
      type: Date,
      required: false,
    },
    daysRemaining: {
      type: Number,
      default: 0,
    },
    hoursRemaining: {
      type: Number,
      default: 0,
    },
    defaultDaysToShow: {
      type: Number,
      default: 7,
    },
    views: {
      type: Number,
      default: 0,
    },
    latitude: {
      type: Number,
      required: false,
    },
    longitude: {
      type: Number,
      required: false,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    report_count: {
      type: Number,
      default: 0,
    },
    is_flagged: {
      type: Boolean,
      default: false,
    },
    is_priority: {
      type: Boolean,
      default: false,
    },

    // ✅ THÊM MỚI: Subscription & VIP Features
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true // Index để query hiệu quả
    },
    
    // VIP Post Features
    isVip: {
      type: Boolean,
      default: false,
      index: true // Index để filter VIP posts
    },
    
    // Priority system cho hiển thị
    priorityLevel: {
      type: Number,
      default: 0, // 0: normal, 1: vip, 2: super vip, etc.
      index: true
    },
    
    // Approval time tracking theo gói
    approvalTracking: {
      submittedAt: {
        type: Date,
        default: Date.now
      },
      approvalDeadline: {
        type: Date, // Calculated based on user's plan
      },
      expectedApprovalHours: {
        type: Number,
        default: 72 // free: 72h, pro: 24h, plus: 2h
      },
      actualApprovalTime: {
        type: Date // Khi nào được approve
      }
    },
    
    // Plus/Premium features
    premiumFeatures: {
      isHighlighted: {
        type: Boolean,
        default: false // Plus feature: post được highlight
      },
      alwaysShowFirst: {
        type: Boolean,
        default: false // Plus feature: luôn hiện đầu tiên
      },
      showDetailedStats: {
        type: Boolean,
        default: false // Plus feature: hiện thống kê chi tiết
      },
      hasCustomBadge: {
        type: Boolean,
        default: false // Plus feature: có badge đặc biệt
      }
    },
    
    // User plan at time of creation (for historical tracking)
    createdWithPlan: {
      planType: {
        type: String,
        enum: ['free', 'pro', 'plus'],
        default: 'free'
      },
      subscriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserSubscription'
      }
    },
    
    // Contact visibility controls
    contactVisibility: {
      phoneAlwaysVisible: {
        type: Boolean,
        default: false // Plus users có thể set phone luôn visible
      },
      requirePlanToViewPhone: {
        type: Boolean,
        default: true // Free users phải có plan để xem phone
      }
    },
    
    // Enhanced analytics (Plus feature)
    analytics: {
      detailedViews: [{
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        viewedAt: {
          type: Date,
          default: Date.now
        },
        userPlan: {
          type: String,
          enum: ['free', 'pro', 'plus']
        },
        source: {
          type: String,
          enum: ['search', 'category', 'direct', 'featured']
        }
      }],
      phoneViews: [{
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        viewedAt: {
          type: Date,
          default: Date.now
        },
        userPlan: {
          type: String,
          enum: ['free', 'pro', 'plus']
        }
      }],
      totalUniqueViews: {
        type: Number,
        default: 0
      },
      totalPhoneViews: {
        type: Number,
        default: 0
      }
    }
  },
  { 
    timestamps: true,
    // Add virtual for calculating post age
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// ✅ INDEXES for performance
PostSchema.index({ userId: 1, createdAt: -1 });
PostSchema.index({ category: 1, transactionType: 1, isVip: -1, priorityLevel: -1 });
PostSchema.index({ status: 1, visibility: 1 });
PostSchema.index({ 'address.province': 1, 'address.district': 1 });
PostSchema.index({ isVip: 1, priorityLevel: -1, createdAt: -1 });
PostSchema.index({ 'approvalTracking.approvalDeadline': 1, status: 1 });

// ✅ VIRTUAL: Calculate if post is overdue for approval
PostSchema.virtual('isApprovalOverdue').get(function() {
  if (this.status !== 'pending') return false;
  return new Date() > this.approvalTracking.approvalDeadline;
});

// ✅ VIRTUAL: Calculate priority score for sorting
PostSchema.virtual('priorityScore').get(function() {
  let score = 0;
  
  // VIP posts get higher priority
  if (this.isVip) score += 1000;
  
  // Plus features add to priority
  if (this.premiumFeatures.alwaysShowFirst) score += 2000;
  if (this.premiumFeatures.isHighlighted) score += 500;
  
  // Priority level multiplier
  score += this.priorityLevel * 100;
  
  // Recent posts get slight boost
  const ageInHours = (Date.now() - this.createdAt) / (1000 * 60 * 60);
  score += Math.max(0, 100 - ageInHours);
  
  return score;
});

// ✅ METHOD: Check if user can view phone number
PostSchema.methods.canUserViewPhone = function(viewerUserId, viewerPlan) {
  // Owner can always see
  if (this.userId.toString() === viewerUserId.toString()) return true;
  
  // Plus posts with always visible phone
  if (this.contactVisibility.phoneAlwaysVisible) return true;
  
  // Free posts require viewer to have plan
  if (this.createdWithPlan.planType === 'free' && this.contactVisibility.requirePlanToViewPhone) {
    return viewerPlan !== 'free';
  }
  
  return true;
};

// ✅ METHOD: Track phone view
PostSchema.methods.trackPhoneView = async function(viewerUserId, viewerPlan) {
  // Only track if analytics are enabled (Plus feature)
  if (this.createdWithPlan.planType === 'plus') {
    this.analytics.phoneViews.push({
      userId: viewerUserId,
      userPlan: viewerPlan,
      viewedAt: new Date()
    });
    this.analytics.totalPhoneViews += 1;
    await this.save();
  }
};

// ✅ METHOD: Track detailed view
PostSchema.methods.trackDetailedView = async function(viewerUserId, viewerPlan, source = 'direct') {
  // Always track basic view count
  this.views += 1;
  
  // Track detailed analytics for Plus users
  if (this.createdWithPlan.planType === 'plus') {
    // Check if already viewed by this user today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const existingView = this.analytics.detailedViews.find(view => 
      view.userId.toString() === viewerUserId.toString() && 
      view.viewedAt >= today
    );
    
    if (!existingView) {
      this.analytics.detailedViews.push({
        userId: viewerUserId,
        userPlan: viewerPlan,
        source: source,
        viewedAt: new Date()
      });
      this.analytics.totalUniqueViews += 1;
    }
  }
  
  await this.save();
};

// ✅ PRE SAVE: Set approval deadline based on plan
PostSchema.pre('save', function(next) {
  if (this.isNew && this.status === 'pending') {
    const deadlineHours = this.approvalTracking.expectedApprovalHours;
    this.approvalTracking.approvalDeadline = new Date(
      Date.now() + deadlineHours * 60 * 60 * 1000
    );
  }
  next();
});

// ✅ PRE SAVE: Update approval time when status changes to approved
PostSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'approved' && !this.approvalTracking.actualApprovalTime) {
    this.approvalTracking.actualApprovalTime = new Date();
  }
  next();
});

module.exports = mongoose.model("Post", PostSchema);