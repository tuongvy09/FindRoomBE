// services/subscriptionService.js
const cron = require('node-cron');
const UserSubscription = require('../models/UserSubscription');
const User = require('../models/User');

// Plan Configuration
const PLAN_CONFIGS = {
  free: {
    name: 'Gói Miễn Phí',
    features: {
      posting: {
        monthlyPostLimit: 3,
        isUnlimitedPosts: false
      },
      vipFeatures: {
        vipPostsPerMonth: 0,
        isUnlimitedVipPosts: false
      },
      contactFeatures: {
        canViewHiddenPhone: false,
        hiddenPhoneViewsPerMonth: 0
      },
      processingFeatures: {
        approvalTimeHours: 72,
        prioritySupport: false
      },
      premiumFeatures: {
        hasDetailedReports: false,
        hasBrandLogo: false,
        alwaysShowFirst: false
      }
    }
  },
  pro: {
    name: 'Gói Pro',
    features: {
      posting: {
        monthlyPostLimit: -1, // unlimited
        isUnlimitedPosts: true
      },
      vipFeatures: {
        vipPostsPerMonth: 5,
        isUnlimitedVipPosts: false
      },
      contactFeatures: {
        canViewHiddenPhone: true,
        hiddenPhoneViewsPerMonth: -1 // unlimited
      },
      processingFeatures: {
        approvalTimeHours: 24,
        prioritySupport: true
      },
      premiumFeatures: {
        hasDetailedReports: false,
        hasBrandLogo: false,
        alwaysShowFirst: false
      }
    }
  },
  plus: {
    name: 'Gói Plus',
    features: {
      posting: {
        monthlyPostLimit: -1, // unlimited
        isUnlimitedPosts: true
      },
      vipFeatures: {
        vipPostsPerMonth: -1, // unlimited
        isUnlimitedVipPosts: true
      },
      contactFeatures: {
        canViewHiddenPhone: true,
        hiddenPhoneViewsPerMonth: -1 // unlimited
      },
      processingFeatures: {
        approvalTimeHours: 2,
        prioritySupport: true
      },
      premiumFeatures: {
        hasDetailedReports: true,
        hasBrandLogo: true,
        alwaysShowFirst: true
      }
    }
  }
};

class SubscriptionService {
  
  /**
   * Initialize cron jobs for subscription management
   */
  static initCronJobs() {
    // Check expired subscriptions every day at midnight
    cron.schedule('0 0 * * *', async () => {
      console.log('🔄 Checking expired subscriptions...');
      await this.resetExpiredSubscriptions();
    });

    // Reset monthly usage on the 1st of every month
    cron.schedule('0 0 1 * *', async () => {
      console.log('🔄 Resetting monthly usage...');
      await this.resetMonthlyUsage();
    });

    // Check subscriptions expiring in 3 days (for notifications)
    cron.schedule('0 9 * * *', async () => {
      console.log('📧 Checking subscriptions expiring soon...');
      await this.notifyExpiringSubscriptions();
    });

  }

  /**
   * Reset expired subscriptions and revert users to free plan
   */
  static async resetExpiredSubscriptions() {
    try {
      const now = new Date();
      
      // Find expired subscriptions
      const expiredSubscriptions = await UserSubscription.find({
        endDate: { $lt: now },
        isActive: true
      });

      let processedCount = 0;

      for (const subscription of expiredSubscriptions) {
        try {
          // Deactivate subscription
          subscription.isActive = false;
          await subscription.save();

          // Reset user to free plan
          await User.findByIdAndUpdate(subscription.userId, {
            currentPlan: 'free',
            postQuota: 3,
            quotaResetAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days
          });

          console.log(`❌ Subscription expired for user: ${subscription.userName} (${subscription.userEmail})`);
          processedCount++;
        } catch (error) {
          console.error(`Error processing expired subscription for ${subscription.userName}:`, error);
        }
      }

      console.log(`✅ Processed ${processedCount} expired subscriptions`);
      return processedCount;
    } catch (error) {
      console.error('Error resetting expired subscriptions:', error);
      throw error;
    }
  }

  /**
   * Reset monthly usage for all active subscriptions
   */
  static async resetMonthlyUsage() {
    try {
      const activeSubscriptions = await UserSubscription.find({ isActive: true });
      let resetCount = 0;
      
      for (const subscription of activeSubscriptions) {
        try {
          subscription.resetMonthlyUsage();
          await subscription.save();
          console.log(`🔄 Reset usage for: ${subscription.userName}`);
          resetCount++;
        } catch (error) {
          console.error(`Error resetting usage for ${subscription.userName}:`, error);
        }
      }

      console.log(`✅ Reset monthly usage for ${resetCount} subscriptions`);
      return resetCount;
    } catch (error) {
      console.error('Error resetting monthly usage:', error);
      throw error;
    }
  }

  /**
   * Notify users with subscriptions expiring soon
   */
  static async notifyExpiringSubscriptions() {
    try {
      const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      
      const expiringSubscriptions = await UserSubscription.find({
        isActive: true,
        endDate: { 
          $gte: new Date(),
          $lte: threeDaysFromNow
        }
      });

      for (const subscription of expiringSubscriptions) {
        const daysLeft = Math.ceil((subscription.endDate - new Date()) / (1000 * 60 * 60 * 24));
        console.log(`⏰ Subscription expiring in ${daysLeft} days: ${subscription.userName} (${subscription.planType})`);
        
        // Here you can add notification logic (email, push notification, etc.)
        // await this.sendExpirationNotification(subscription, daysLeft);
      }

      console.log(`📧 Checked ${expiringSubscriptions.length} expiring subscriptions`);
      return expiringSubscriptions;
    } catch (error) {
      console.error('Error checking expiring subscriptions:', error);
      throw error;
    }
  }

  /**
   * Get user's current active subscription
   */
  static async getUserSubscription(userId) {
    try {
      const subscription = await UserSubscription.findOne({
        userId: userId,
        isActive: true,
        endDate: { $gt: new Date() }
      }).populate('subscriptionId');

      return subscription;
    } catch (error) {
      console.error('Error getting user subscription:', error);
      throw error;
    }
  }

  /**
   * Get subscription by username or email
   */
  static async getSubscriptionByUserInfo(searchTerm) {
    try {
      return await UserSubscription.findByUserInfo(searchTerm);
    } catch (error) {
      console.error('Error searching subscription by user info:', error);
      throw error;
    }
  }

  /**
   * Get all active subscriptions with pagination and search
   */
  static async getAllActiveSubscriptions(page = 1, limit = 20, searchTerm = '', planType = '') {
    try {
      let query = { isActive: true };
      
      // Add search filter
      if (searchTerm) {
        const searchRegex = new RegExp(searchTerm, 'i');
        query.$or = [
          { userName: searchRegex },
          { userEmail: searchRegex }
        ];
      }

      // Add plan type filter
      if (planType && planType !== 'all') {
        query.planType = planType;
      }

      const subscriptions = await UserSubscription.find(query)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .populate('subscriptionId');

      const total = await UserSubscription.countDocuments(query);

      return {
        subscriptions,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      };
    } catch (error) {
      console.error('Error getting all active subscriptions:', error);
      throw error;
    }
  }

  /**
   * Check if user can perform a specific action based on their plan
   */
  static async canUserPerformAction(userId, action, count = 1) {
    try {
      const subscription = await this.getUserSubscription(userId);
      
      if (!subscription) {
        // User is on free plan
        return await this.checkFreePlanLimits(userId, action, count);
      }

      return this.checkSubscriptionLimits(subscription, action, count);
    } catch (error) {
      console.error('Error checking user permissions:', error);
      return false; // Fail safe
    }
  }

  /**
   * Check limits for free plan users
   */
  static async checkFreePlanLimits(userId, action, count) {
    try {
      const user = await User.findById(userId);
      if (!user) return false;

      switch (action) {
        case 'create_post':
          return user.postQuota > 0;
          
        case 'create_vip_post':
          return false; // Free users can't create VIP posts
          
        case 'view_hidden_phone':
          return false; // Free users can't view hidden phones
          
        case 'priority_support':
          return false; // No priority support for free users
          
        default:
          return true;
      }
    } catch (error) {
      console.error('Error checking free plan limits:', error);
      return false;
    }
  }

  /**
   * Check limits for subscribed users
   */
  static checkSubscriptionLimits(subscription, action, count) {
    try {
      const features = subscription.features;
      
      switch (action) {
        case 'create_post':
          if (features.posting.isUnlimitedPosts) return true;
          return subscription.currentUsage.usage.postsCreated + count <= features.posting.monthlyPostLimit;
          
        case 'create_vip_post':
          if (features.vipFeatures.isUnlimitedVipPosts) return true;
          return subscription.currentUsage.usage.vipPostsUsed + count <= features.vipFeatures.vipPostsPerMonth;
          
        case 'view_hidden_phone':
          return features.contactFeatures.canViewHiddenPhone;
          
        case 'priority_support':
          return features.processingFeatures.prioritySupport;
          
        case 'detailed_reports':
          return features.premiumFeatures.hasDetailedReports;
          
        case 'brand_logo':
          return features.premiumFeatures.hasBrandLogo;
          
        case 'always_show_first':
          return features.premiumFeatures.alwaysShowFirst;
          
        default:
          return true;
      }
    } catch (error) {
      console.error('Error checking subscription limits:', error);
      return false;
    }
  }

  /**
   * Update usage tracking for a user
   */
  static async updateUsage(userId, action, count = 1) {
    try {
      const subscription = await this.getUserSubscription(userId);
      
      if (!subscription) {
        // Update free plan usage
        const user = await User.findById(userId);
        if (user && action === 'create_post') {
          user.postQuota = Math.max(0, user.postQuota - count);
          await user.save();
          console.log(`📊 Updated free plan usage for ${user.username}: remaining=${user.postQuota}`);
        }
        return;
      }

      // Update subscription usage
      switch (action) {
        case 'create_post':
          subscription.currentUsage.usage.postsCreated += count;
          break;
          
        case 'create_vip_post':
          subscription.currentUsage.usage.vipPostsUsed += count;
          break;
          
        case 'view_hidden_phone':
          subscription.currentUsage.usage.hiddenPhoneViews += count;
          break;
      }

      await subscription.save();
      console.log(`📊 Updated usage for ${subscription.userName}: ${action} +${count}`);
    } catch (error) {
      console.error('Error updating usage:', error);
      throw error;
    }
  }

  /**
   * Get user's plan details and usage statistics
   */
  static async getUserPlanDetails(userId) {
    try {
      const subscription = await this.getUserSubscription(userId);
      
      if (!subscription) {
        // Return free plan details
        const user = await User.findById(userId);
        return {
          planType: 'free',
          planName: 'Gói Miễn Phí',
          isActive: false,
          features: PLAN_CONFIGS.free.features,
          currentUsage: {
            postsCreated: 3 - (user?.postQuota || 0),
            vipPostsUsed: 0,
            hiddenPhoneViews: 0
          },
          limits: {
            postsRemaining: user?.postQuota || 0,
            vipPostsRemaining: 0
          }
        };
      }

      // Calculate remaining limits
      const features = subscription.features;
      const usage = subscription.currentUsage.usage;
      
      const limits = {
        postsRemaining: features.posting.isUnlimitedPosts ? -1 : 
          Math.max(0, features.posting.monthlyPostLimit - usage.postsCreated),
        vipPostsRemaining: features.vipFeatures.isUnlimitedVipPosts ? -1 :
          Math.max(0, features.vipFeatures.vipPostsPerMonth - usage.vipPostsUsed),
        daysRemaining: Math.ceil((subscription.endDate - new Date()) / (1000 * 60 * 60 * 24))
      };

      return {
        planType: subscription.planType,
        planName: subscription.planName,
        isActive: subscription.isActive,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        features: subscription.features,
        currentUsage: usage,
        limits
      };
    } catch (error) {
      console.error('Error getting user plan details:', error);
      throw error;
    }
  }

  /**
   * Get subscription statistics for admin dashboard
   */
  static async getSubscriptionStats() {
    try {
      const stats = await UserSubscription.aggregate([
        {
          $group: {
            _id: '$planType',
            activeCount: {
              $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
            },
            totalRevenue: {
              $sum: { $cond: [{ $eq: ['$isActive', true] }, '$paymentInfo.amount', 0] }
            },
            users: {
              $push: {
                $cond: [
                  { $eq: ['$isActive', true] },
                  { 
                    userName: '$userName',
                    userEmail: '$userEmail',
                    endDate: '$endDate',
                    amount: '$paymentInfo.amount'
                  },
                  null
                ]
              }
            }
          }
        },
        {
          $project: {
            _id: 1,
            activeCount: 1,
            totalRevenue: 1,
            users: {
              $filter: {
                input: '$users',
                as: 'user',
                cond: { $ne: ['$$user', null] }
              }
            }
          }
        }
      ]);

      // Get expiring subscriptions
      const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const expiringCount = await UserSubscription.countDocuments({
        isActive: true,
        endDate: { $gte: new Date(), $lte: threeDaysFromNow }
      });

      // Get total active subscriptions
      const totalActive = await UserSubscription.countDocuments({ isActive: true });

      return {
        planStats: stats,
        totalActiveSubscriptions: totalActive,
        expiringIn3Days: expiringCount,
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Error getting subscription stats:', error);
      throw error;
    }
  }

  /**
   * Manually create subscription (for admin or special cases)
   */
  static async createManualSubscription(userId, planType, durationDays = 30, adminId = null) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const planConfig = PLAN_CONFIGS[planType];
      if (!planConfig) {
        throw new Error('Invalid plan type');
      }

      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

      // Deactivate current subscription
      await UserSubscription.updateMany(
        { userId: userId, isActive: true },
        { isActive: false }
      );

      // Create new subscription
      const subscription = new UserSubscription({
        userId: userId,
        userName: user.username,
        userEmail: user.email,
        subscriptionId: null, // No subscription ID for manual
        planType: planType,
        planName: planConfig.name,
        startDate: startDate,
        endDate: endDate,
        isActive: true,
        features: planConfig.features,
        currentUsage: {
          periodStartDate: startDate,
          periodEndDate: new Date(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate()),
          usage: {
            postsCreated: 0,
            vipPostsUsed: 0,
            hiddenPhoneViews: 0
          },
          lastResetDate: startDate
        },
        paymentInfo: {
          amount: 0,
          currency: 'VND',
          paymentMethod: 'manual',
          transactionId: `MANUAL_${Date.now()}`
        }
      });

      await subscription.save();

      // Update user plan
      await User.findByIdAndUpdate(userId, {
        currentPlan: planType,
        postQuota: planConfig.features.posting.isUnlimitedPosts ? 999999 : planConfig.features.posting.monthlyPostLimit
      });

      console.log(`✅ Manual subscription created: ${user.username} -> ${planType} for ${durationDays} days`);
      return subscription;
    } catch (error) {
      console.error('Error creating manual subscription:', error);
      throw error;
    }
  }

  /**
   * Get plan configuration
   */
  static getPlanConfig(planType) {
    return PLAN_CONFIGS[planType] || null;
  }

  /**
   * Get all plan configurations
   */
  static getAllPlanConfigs() {
    return PLAN_CONFIGS;
  }
}

module.exports = SubscriptionService;