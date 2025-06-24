const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
    minlength: [10, 'Description must be at least 10 characters long'],
  },
  content: {
    type: String,
    required: true,
    minlength: [200, 'Content must be at least 10 characters long'],
  },
  author: {
    type: String, 
    required: true,
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  imageUrl: {
    type: String,
    required: false, 
  },
  views: {
    type: Number,
    default: 0,
  }
});

const News = mongoose.model('News', newsSchema);

module.exports = News;