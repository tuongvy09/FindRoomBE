const UserSubscription = require('../models/UserSubscription');

// Middleware kiểm tra quyền theo gói đăng ký
exports.requireSubscription = (requiredFeature) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      
      const userSubscription = await UserSubscription.findOne({
        userId: userId,
        isActive: true,
        endDate: { $gt: new Date() }
      }).populate('subscriptionId');

      if (!userSubscription) {
        return res.status(403).json({
          success: false,
          message: 'Bạn cần đăng ký gói để sử dụng tính năng này'
        });
      }

      const subscription = userSubscription.subscriptionId;
      
      // Kiểm tra tính năng cụ thể
      switch (requiredFeature) {
        case 'view_hidden_phone':
          if (!subscription.features.canViewHiddenPhone) {
            return res.status(403).json({
              success: false,
              message: 'Tính năng này chỉ dành cho gói Pro và Plus'
            });
          }
          break;
        
        case 'unlimited_posts':
          if (subscription.features.maxPosts !== -1) {
            return res.status(403).json({
              success: false,
              message: 'Bạn đã đạt giới hạn đăng tin của gói hiện tại'
            });
          }
          break;
        
        case 'vip_posts':
          if (subscription.features.vipPosts === 0) {
            return res.status(403).json({
              success: false,
              message: 'Tính năng tin VIP chỉ dành cho gói Pro và Plus'
            });
          }
          break;
      }

      req.userSubscription = userSubscription;
      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Lỗi khi kiểm tra quyền truy cập',
        error: error.message
      });
    }
  };
};

// Middleware kiểm tra còn lượt sử dụng
exports.checkUsageLimit = (feature) => {
  return async (req, res, next) => {
    try {
      const userSubscription = req.userSubscription;
      const subscription = userSubscription.subscriptionId;
      
      // Reset usage nếu cần
      const now = new Date();
      const lastReset = userSubscription.currentUsage.lastResetDate;
      const daysSinceReset = (now - lastReset) / (1000 * 60 * 60 * 24);

      if (daysSinceReset >= 30) {
        userSubscription.currentUsage = {
          postsCreated: 0,
          vipPostsUsed: 0,
          phoneViewsUsed: 0,
          lastResetDate: now
        };
        await userSubscription.save();
      }

      // Kiểm tra giới hạn
      switch (feature) {
        case 'post':
          if (subscription.features.maxPosts !== -1) {
            if (userSubscription.currentUsage.postsCreated >= subscription.features.maxPosts) {
              return res.status(403).json({
                success: false,
                message: `Bạn đã đạt giới hạn ${subscription.features.maxPosts} tin đăng/tháng`
              });
            }
          }
          break;
        
        case 'vip_post':
          if (subscription.features.vipPosts !== -1) {
            if (userSubscription.currentUsage.vipPostsUsed >= subscription.features.vipPosts) {
              return res.status(403).json({
                success: false,
                message: `Bạn đã sử dụng hết ${subscription.features.vipPosts} tin VIP trong tháng`
              });
            }
          }
          break;
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Lỗi khi kiểm tra giới hạn sử dụng',
        error: error.message
      });
    }
  };
};
