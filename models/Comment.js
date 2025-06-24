// models/Comment.js
const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
  content: {
    type: String,
    required: [true, 'Nội dung bình luận là bắt buộc'],
    trim: true,
    maxlength: [1000, 'Bình luận không được vượt quá 1000 ký tự']
  },
  thread: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Thread',
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: [true, 'Username là bắt buộc'],
    trim: true
  },
  avatar: {
    type: String,
    trim: true,
    default: null
  },
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null 
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  replies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved' 
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Index để tối ưu query
CommentSchema.index({ thread: 1, created_at: -1 });
CommentSchema.index({ author: 1 });
CommentSchema.index({ parentComment: 1 });

module.exports = mongoose.model('Comment', CommentSchema);