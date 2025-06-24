const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  post_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true,
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  rating: {
    quality: {type: Number, required: true, min: 1, max: 5},
    location: {type: Number, required: true, min: 1, max: 5},
    price: {type: Number, required: true, min: 1, max: 5},
    service: {type: Number, required: true, min: 1, max: 5},
    security: {type: Number, required: true, min: 1, max: 5},
  },
  comments: {
    best_part: { type: String, required: false }, // Điều thích nhất về phòng
    worst_part: { type: String, required: false }, // Điều không hài lòng
    advice: { type: String, required: false }, // Lời khuyên cho người thuê sau
    additional_comment: { type: String, required: false }, // Ý kiến bổ sung
  },
  review_checks: {
    is_info_complete: { type: Boolean, default: false }, // Bài đăng đầy đủ thông tin không?
    is_image_accurate: { type: Boolean, default: false }, // Hình ảnh có đúng thực tế không?
    is_host_responsive: { type: Boolean, default: false }, // Chủ phòng có phản hồi nhanh không?
  },
  media: {
    images: [{ type: String}],
    videos: [{ type: String}],
  },
}, { timestamps: true });

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;