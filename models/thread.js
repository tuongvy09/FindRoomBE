// models/Thread.js
const mongoose = require('mongoose');

const ThreadSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Tiêu đề là bắt buộc'],
    trim: true,
    maxlength: [200, 'Tiêu đề không được vượt quá 200 ký tự']
  },
  content: {
    type: String,
    required: [true, 'Nội dung là bắt buộc'],
    trim: true
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
  tags: [{
    type: String,
    trim: true
  }],
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  dislikes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  viewCount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  image: {  
    type: String
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

// Index để tối ưu tìm kiếm
ThreadSchema.index({ status: 1, created_at: -1 });
ThreadSchema.index({ author: 1 });
ThreadSchema.index({ username: 1 });
ThreadSchema.index({ tags: 1 });

module.exports = mongoose.models.Thread || mongoose.model("Thread", ThreadSchema);
