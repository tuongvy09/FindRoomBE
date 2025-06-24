const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    maxlength: 20,
    unique: true,
  },
  password: {
    type: String,
    required: false,
    minlength: 6,
  },
  email: {
    type: String,
    required: true,
    maxlength: 50,
    unique: true,
  },
  admin: {
    type: Boolean,
    default: false,
  },
  profile: {
    name: {
      type: String,
    },
    phone: {
      type: String,
    },
    address: {
      type: String,
    },
    picture: {
      type: String,
    },
    isBlocked: {   
      type: Boolean,
      default: false,
    },  
    bio:{
      type: String,
    },
    isOnline: {
      type: Boolean,
      default: true,
    },
  },
  favorites: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
    }
  ],
      viewed: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
    }
  ],
  suspiciousActivityCount: [
    {
      loginCount: {
        type: Number,
        default: 0, 
      },
      reviewCount: {
        type: Number,
        default: 0, 
      }, 
    }
  ],
  notifications: [
    {
      message: {
        type: String,
        required: true,
      },
      type: {
        type: String,
        enum: [
          'review', 
          'message', 
          'post',
          'forum_comment', 
          'forum_like', 
          'forum_mention', 
          'forum_reply',
          'thread_approval'
        ],
        required: true,
      },
      post_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
      },
      review_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Review',
      },
      // New fields for forum notifications
      thread_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Thread',
      },
      comment_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment',
      },
      from_user: {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        username: {
          type: String,
        },
        avatar: {
          type: String,
        }
      },
      status: {
        type: String, 
        enum: ['read', 'unread'],
        default: 'unread',
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    }
  ],

  plan: {
    type: String,
    enum: ['free', 'plus', 'pro'],
    default: 'free',
    expiredAt: {
      type: Date,
      default: null,
    }
  },

  // Gói đăng tin
  postQuota: { type: Number, default: 3 },
  quotaResetAt: { type: Date, default: new Date() },
    
  
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
module.exports = User;