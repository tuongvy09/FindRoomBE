const Subscription = require('../models/Subscription');
const UserSubscription = require('../models/UserSubscription');
const Payment = require('../models/Payment');
const User = require('../models/User');

// Lấy tất cả gói đăng ký
exports.getAllSubscriptions = async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ isActive: true })
      .sort({ price: 1 });
    
    res.status(200).json({
      success: true,
      data: subscriptions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách gói đăng ký',
      error: error.message
    });
  }
};

// Lấy gói đăng ký hiện tại của user
exports.getUserSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const userSubscription = await UserSubscription.findOne({
      userId: userId,
      isActive: true,
      endDate: { $gt: new Date() }
    }).populate('subscriptionId');

    if (!userSubscription) {
      // Nếu không có gói nào, tạo gói free mặc định
      const freeSubscription = await Subscription.findOne({ name: 'free' });
      
      const newUserSubscription = new UserSubscription({
        userId: userId,
        subscriptionId: freeSubscription._id,
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 năm
        isActive: true
      });
      
      await newUserSubscription.save();
      await newUserSubscription.populate('subscriptionId');
      
      return res.status(200).json({
        success: true,
        data: newUserSubscription
      });
    }

    res.status(200).json({
      success: true,
      data: userSubscription
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thông tin gói đăng ký',
      error: error.message
    });
  }
};

// Kiểm tra khả năng sử dụng tính năng
exports.checkFeatureUsage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { feature } = req.params; // 'post', 'vip_post', 'phone_view'
    
    const userSubscription = await UserSubscription.findOne({
      userId: userId,
      isActive: true,
      endDate: { $gt: new Date() }
    }).populate('subscriptionId');

    if (!userSubscription) {
      return res.status(400).json({
        success: false,
        message: 'Không tìm thấy gói đăng ký'
      });
    }

    const now = new Date();
    const lastReset = userSubscription.currentUsage.lastResetDate;
    const daysSinceReset = (now - lastReset) / (1000 * 60 * 60 * 24);

    // Reset usage nếu đã qua tháng mới
    if (daysSinceReset >= 30) {
      userSubscription.currentUsage = {
        postsCreated: 0,
        vipPostsUsed: 0,
        phoneViewsUsed: 0,
        lastResetDate: now
      };
      await userSubscription.save();
    }

    const subscription = userSubscription.subscriptionId;
    let canUse = false;
    let remainingUsage = 0;

    switch (feature) {
      case 'post':
        if (subscription.features.maxPosts === -1) {
          canUse = true;
          remainingUsage = -1; // unlimited
        } else {
          remainingUsage = subscription.features.maxPosts - userSubscription.currentUsage.postsCreated;
          canUse = remainingUsage > 0;
        }
        break;
      
      case 'vip_post':
        if (subscription.features.vipPosts === -1) {
          canUse = true;
          remainingUsage = -1;
        } else {
          remainingUsage = subscription.features.vipPosts - userSubscription.currentUsage.vipPostsUsed;
          canUse = remainingUsage > 0;
        }
        break;
      
      case 'phone_view':
        canUse = subscription.features.canViewHiddenPhone;
        remainingUsage = canUse ? -1 : 0;
        break;
    }

    res.status(200).json({
      success: true,
      data: {
        canUse,
        remainingUsage,
        currentUsage: userSubscription.currentUsage,
        subscriptionName: subscription.name
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi kiểm tra tính năng',
      error: error.message
    });
  }
};

// Cập nhật usage khi user sử dụng tính năng
exports.updateFeatureUsage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { feature, increment = 1 } = req.body;
    
    const userSubscription = await UserSubscription.findOne({
      userId: userId,
      isActive: true,
      endDate: { $gt: new Date() }
    });

    if (!userSubscription) {
      return res.status(400).json({
        success: false,
        message: 'Không tìm thấy gói đăng ký'
      });
    }

    switch (feature) {
      case 'post':
        userSubscription.currentUsage.postsCreated += increment;
        break;
      case 'vip_post':
        userSubscription.currentUsage.vipPostsUsed += increment;
        break;
      case 'phone_view':
        userSubscription.currentUsage.phoneViewsUsed += increment;
        break;
    }

    userSubscription.updatedAt = new Date();
    await userSubscription.save();

    res.status(200).json({
      success: true,
      message: 'Cập nhật usage thành công',
      data: userSubscription.currentUsage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật usage',
      error: error.message
    });
  }
};
