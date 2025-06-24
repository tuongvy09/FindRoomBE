const express = require("express");
const router = express.Router();
const reviewController = require("../controllers/reviewController");
const middlewareControllers = require("../controllers/middlewareControllers");
const uploadCloud = require("../congfig/cloudinaryConfig");

// Thêm đánh giá bài đăng
router.post("/:postId", middlewareControllers.verifyToken, reviewController.createReview, uploadCloud.array("media", 6));

// Lấy danh sách đánh giá theo bài đăng
router.get("/:postId", reviewController.getReviewsByPost);

// Xóa đánh giá 
router.delete("/:reviewId", middlewareControllers.verifyToken, reviewController.deleteReview);

// Chỉnh sửa đánh giá 
router.put("/:reviewId", middlewareControllers.verifyToken, reviewController.updateReview);

module.exports = router;