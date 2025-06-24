// routes/forumRoutes.js
const express = require("express");
const router = express.Router();
const threadController = require("../controllers/threadController");
const commentController = require("../controllers/commentController");
const { protect, optionalAuth } = require("../middleware/auth");
const {
  validateThread,
  validateComment,
} = require("../middleware/threadValidation");
const middlewareControllers = require("../controllers/middlewareControllers");

// Tạo thread mới
router.post(
  "/threads",
  middlewareControllers.verifyToken,
  validateThread,
  threadController.createThread
);

// Route lấy danh sách threads
router.get("/threads", threadController.getAllThreads);

// Lấy thread theo ID
router.get("/threads/:id", threadController.getThreadById);

// Cập nhật thread
router.put(
  "/threads/:id",
  middlewareControllers.verifyToken,
  validateThread,
  threadController.updateThread
);

// Xóa thread
router.delete(
  "/threads/:id",
  middlewareControllers.verifyToken,
  threadController.deleteThread
);

// Like thread
router.post(
  "/threads/:id/like",
  middlewareControllers.verifyToken,
  threadController.likeThread
);

// Dislike thread
router.post(
  "/threads/:id/dislike",
  middlewareControllers.verifyToken,
  threadController.dislikeThread
);

// Lấy trạng thái like/dislike của user
router.get(
  "/threads/:id/like-status",
  middlewareControllers.verifyToken,
  threadController.getThreadLikeStatus
);

router.post(
  "/threads/:threadId/comments",
  middlewareControllers.verifyToken,
  validateComment,
  commentController.createComment
);

// Lấy comments của thread
router.get("/threads/:threadId/comments", commentController.getThreadComments);

// Like comment
router.post(
  "/comments/:commentId/like",
  middlewareControllers.verifyToken,
  commentController.likeComment
);

// Cập nhật comment
router.put('/comments/:commentId', 
  middlewareControllers.verifyToken,
  validateComment, 
  commentController.updateComment
);

// Xóa comment
router.delete('/comments/:commentId', 
  middlewareControllers.verifyToken, 
  commentController.deleteComment
);

//Lấy tất cả Tag
router.get('/tags', threadController.getAllTags);
//tìm kiếm threads theo nhiều tiêu chí
router.get('/search', threadController.searchThreads);
//Người dùng lấy thread
router.get('/threadsByUser', middlewareControllers.verifyToken, threadController.searchThreads);
// Approve thread
router.put('/:threadId/approve', middlewareControllers.verifyTokenAndAdminAuth, threadController.approveThread);

// Reject thread
router.put('/:threadId/reject', middlewareControllers.verifyTokenAndAdminAuth, threadController.rejectThread);

// Export router
module.exports = router;