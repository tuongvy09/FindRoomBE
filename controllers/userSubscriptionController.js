// controllers/userSubscriptionController.js
const UserSubscription = require('../models/UserSubscription');
const mongoose = require('mongoose');

// Lấy lịch sử giao dịch của user
const getUserTransactionHistory = async (req, res) => {
  try {
    const { userId } = req.params;    
    // Validate userId
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'UserId không hợp lệ'
      });
    }
    
    // Lấy tất cả subscription history của user, sắp xếp theo ngày tạo mới nhất
    const subscriptions = await UserSubscription
      .find({ userId: mongoose.Types.ObjectId(userId) })
      .sort({ createdAt: -1 });
    // Map data từ database sang format frontend
    const transactions = subscriptions.map(sub => {
      // ⭐ SIMPLIFIED: Tất cả records đều là "completed" vì đã lưu vào DB
      const status = 'completed';

      // Map features dựa trên planType
      const features = getFeaturesByPlanType(sub.planType, sub.features);

      return {
        id: sub._id,
        packageType: sub.planType,
        packageName: sub.planName,
        amount: sub.paymentInfo?.amount || 0,
        currency: sub.paymentInfo?.currency || 'VND',
        status: status, // ⭐ Always completed
        paymentMethod: sub.paymentInfo?.paymentMethod || 'momo',
        transactionDate: sub.createdAt,
        expiryDate: sub.endDate,
        description: `Nâng cấp ${sub.planName} - 30 ngày`,
        invoiceNumber: sub.paymentInfo?.transactionId ? 
          `INV-${sub.paymentInfo.transactionId}` : 
          `INV-${sub._id.toString().slice(-8).toUpperCase()}`,
        features: features,
        
        // Thêm thông tin usage hiện tại
        currentUsage: sub.currentUsage,
        isActive: sub.isActive,
        autoRenew: sub.autoRenew,
        
        // User info for invoice
        userName: sub.userName,
        userEmail: sub.userEmail,
        
        // Payment details
        paymentDetails: {
          paymentId: sub.paymentInfo?.paymentId,
          transactionId: sub.paymentInfo?.transactionId,
          paymentMethod: sub.paymentInfo?.paymentMethod
        }
      };
    });

    // ⭐ SIMPLIFIED: Thống kê đơn giản
    const stats = {
      totalTransactions: transactions.length,
      totalSpent: transactions.reduce((sum, t) => sum + t.amount, 0),
      activeSubscription: transactions.find(t => t.isActive && new Date(t.expiryDate) > new Date())
    };

    res.status(200).json({
      success: true,
      data: {
        transactions,
        stats
      }
    });

  } catch (error) {
    console.error('❌ Error fetching transaction history:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy lịch sử giao dịch',
      error: error.message
    });
  }
};

// Helper function để map features theo planType
const getFeaturesByPlanType = (planType, features) => {
  const baseFeatures = {
    free: [
      'Đăng tin miễn phí 3 tin/tháng',
      'Xem thông tin cơ bản',
      'Hỗ trợ cơ bản'
    ],
    pro: [
      'Đăng tin miễn phí 30 tin/tháng',
      'Tin VIP 5 tin/tháng', 
      'Xem SĐT có tức thì',
      'Duyệt tin 24h'
    ],
    plus: [
      'Tin đăng không giới hạn',
      'Tin VIP không giới hạn',
      'Xem SĐT tức thì',
      'Duyệt tin 2-4h',
      'Thêm logo thương hiệu',
      'Luôn hiển thị đầu tiên'
    ]
  };

  return baseFeatures[planType] || [];
};

// Lấy subscription hiện tại của user
const getCurrentSubscription = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const currentSub = await UserSubscription
      .findOne({ 
        userId: mongoose.Types.ObjectId(userId), 
        isActive: true,
        endDate: { $gt: new Date() }
      })
      .sort({ createdAt: -1 });

    if (!currentSub) {
      return res.status(200).json({
        success: true,
        data: {
          hasActiveSubscription: false,
          planType: 'free'
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        hasActiveSubscription: true,
        subscription: {
          id: currentSub._id,
          planType: currentSub.planType,
          planName: currentSub.planName,
          endDate: currentSub.endDate,
          features: currentSub.features,
          currentUsage: currentSub.currentUsage,
          isExpired: new Date() > new Date(currentSub.endDate)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching current subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thông tin gói hiện tại'
    });
  }
};

module.exports = {
  getUserTransactionHistory,
  getCurrentSubscription
};