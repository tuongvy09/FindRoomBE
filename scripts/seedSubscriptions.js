const mongoose = require('mongoose');
const Subscription = require('../models/Subscription');
require('dotenv').config();

const subscriptions = [
  {
    name: 'free',
    displayName: 'Gói Free',
    price: 0,
    duration: 365, // 1 năm
    features: {
      maxPosts: 3,
      postDuration: 7,
      vipPosts: 0,
      canViewHiddenPhone: false,
      depositFeeDiscount: 0,
      prioritySupport: false,
      fastApproval: 48,
      analytics: false,
      customBranding: false,
      alwaysOnTop: false
    }
  },
  {
    name: 'pro',
    displayName: 'Gói Pro',
    price: 199000,
    duration: 30,
    features: {
      maxPosts: -1, // unlimited
      postDuration: 30,
      vipPosts: 5,
      canViewHiddenPhone: true,
      depositFeeDiscount: 50,
      prioritySupport: true,
      fastApproval: 24,
      analytics: true,
      customBranding: false,
      alwaysOnTop: false
    }
  },
  {
    name: 'plus',
    displayName: 'Gói Plus',
    price: 499000,
    duration: 30,
    features: {
      maxPosts: -1,
      postDuration: -1, // không giới hạn
      vipPosts: -1,
      canViewHiddenPhone: true,
      depositFeeDiscount: 100,
      prioritySupport: true,
      fastApproval: 2,
      analytics: true,
      customBranding: true,
      alwaysOnTop: true
    }
  }
];

async function seedSubscriptions() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    
    // Xóa dữ liệu cũ
    await Subscription.deleteMany({});
    
    // Thêm dữ liệu mới
    await Subscription.insertMany(subscriptions);
    
    console.log('Seeded subscriptions successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding subscriptions:', error);
    process.exit(1);
  }
}

seedSubscriptions();