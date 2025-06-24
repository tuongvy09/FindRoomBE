const Review = require('../models/Review');
const Post = require('../models/Post');
const User = require('../models/User');
const cloudinary = require('cloudinary').v2;
const userController = require('./userControllers');

// Tạo đánh giá mới
exports.createReview = async (req, res) => {
    const { rating, comments, review_checks, media } = req.body;
    const { postId } = req.params;
    
    try {
        // Tìm bài đăng
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ message: 'Bài đăng không tồn tại' });
        }

        // Lấy user ID
        const userId = req.user.id;

        // Kiểm tra hành vi spam review
        let isSpam = false;

        // 1. 5 review trong vòng 1 giờ
        const reviewsInOneHour = await Review.find({
            user_id: userId,
            createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
        });
        if (reviewsInOneHour.length >= 5) {
            isSpam = true;
        }

        // 2. 2 review liên tiếp trong vòng 10 phút
        const lastTwo = await Review.find({ user_id: userId }).sort({ createdAt: -1 }).limit(2);
        if (lastTwo.length === 2) {
            const timeDiff = (lastTwo[0].createdAt - lastTwo[1].createdAt) / (1000 * 60);
            if (timeDiff <= 10) {
                isSpam = true;
            }
        }

        if (isSpam) {
            await userController.detectSuspiciousActivity(userId, "Spam review");
        }

        const imageUrls = Array.isArray(media?.images) ? media.images.slice(0, 5) : [];
        const videoUrl = media?.video ? [media.video] : [];

        // Tạo review mới
        const review = new Review({
            post_id: postId,
            user_id: userId,
            rating,
            comments,
            review_checks,
            media: {
                images: imageUrls,
                videos: videoUrl
            }
        });

        await review.save();

        // FIX: Gửi thông báo mà không trigger validation lỗi
        try {
            const owner = await User.findById(post.contactInfo.user);
            if (owner) {
                const notification = {
                    message: `Bài viết "${post.title}" của bạn nhận được một đánh giá mới.`,
                    type: 'review',
                    post_id: postId,
                    review_id: review._id,
                    status: 'unread',
                };

                // FIX: Sử dụng updateOne thay vì save() để tránh validation
                await User.updateOne(
                    { _id: owner._id },
                    { $push: { notifications: notification } }
                );
            }
        } catch (notificationError) {
            console.error('Lỗi khi gửi thông báo:', notificationError);
            // Không throw error để không ảnh hưởng đến việc tạo review
        }

        res.status(201).json({ review });
    } catch (error) {
        console.error('Chi tiết lỗi createReview:', error);
        res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};

// Lấy đánh giá theo bài đăng
exports.getReviewsByPost = async (req, res) => {
    const { postId } = req.params;

    try {   
        const reviews = await Review.find({ post_id: postId })
            .populate('user_id', 'username')
            .sort({ createdAt: -1 });
        res.status(200).json(reviews);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};

// controllers/reviewController.js
exports.deleteReview = async (req, res) => {
    const { reviewId } = req.params;

    try {
        const review = await Review.findById(reviewId);
        if (!review) {
            return res.status(404).json({ message: 'Đánh giá không tồn tại' });
        }

        // DEBUG: Thêm log để kiểm tra (giống updateReview)
        console.log('🔍 DEBUG DELETE REVIEW:');
        console.log('req.user:', req.user);
        console.log('req.user.id:', req.user.id);
        console.log('review.user_id:', review.user_id);
        console.log('review.user_id.toString():', review.user_id.toString());
        console.log('Comparison result:', review.user_id.toString() === req.user.id);

        // FIX: Áp dụng cùng logic kiểm tra quyền như updateReview
        const isOwner = review.user_id.toString() === req.user.id.toString() || 
                       review.user_id.toString() === req.user.id ||
                       review.user_id._id?.toString() === req.user.id;

        if (!isOwner) {
            console.log('❌ DELETE PERMISSION DENIED:');
            console.log('Review user_id:', review.user_id.toString());
            console.log('Request user id:', req.user.id);
            return res.status(403).json({ message: 'Bạn không có quyền xóa đánh giá này' });
        }

        await review.deleteOne();
        console.log('✅ Review deleted successfully');
        res.status(200).json({ message: 'Đánh giá đã được xóa' });
    } catch (error) {
        console.error('❌ Error in deleteReview:', error);
        res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};

// controllers/reviewController.js
exports.updateReview = async (req, res) => {
    const { reviewId } = req.params;
    const { rating, comments, review_checks, media } = req.body;

    try {
        const review = await Review.findById(reviewId);
        if (!review) {
            return res.status(404).json({ message: 'Đánh giá không tồn tại' });
        }

        // DEBUG: Thêm log để kiểm tra
        console.log('🔍 DEBUG UPDATE REVIEW:');
        console.log('req.user:', req.user);
        console.log('req.user.id:', req.user.id);
        console.log('review.user_id:', review.user_id);
        console.log('review.user_id.toString():', review.user_id.toString());
        console.log('Comparison result:', review.user_id.toString() === req.user.id);

        // FIX: Kiểm tra quyền chỉnh sửa với nhiều cách so sánh
        const isOwner = review.user_id.toString() === req.user.id.toString() || 
                       review.user_id.toString() === req.user.id ||
                       review.user_id._id?.toString() === req.user.id;

        if (!isOwner) {
            console.log('❌ PERMISSION DENIED:');
            console.log('Review user_id:', review.user_id.toString());
            console.log('Request user id:', req.user.id);
            return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa đánh giá này' });
        }

        // Cập nhật thông tin đánh giá
        if (rating) review.rating = rating;
        if (comments) review.comments = comments;
        if (review_checks) review.review_checks = review_checks;
        if (media) review.media = media;

        await review.save();
        
        // Populate user info để trả về dữ liệu đầy đủ
        await review.populate('user_id', 'username');
        
        console.log('✅ Review updated successfully');
        res.status(200).json({ message: 'Đánh giá đã được cập nhật', review });
    } catch (error) {
        console.error('❌ Error in updateReview:', error);
        res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};