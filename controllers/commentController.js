// controllers/commentController.js
const Comment = require('../models/Comment');
const Thread = require('../models/thread');
const User = require('../models/User'); 
const ForumNotificationService = require('../services/forumNotificationService');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

/**
 * Tạo comment mới
 * @route POST /v1/forum/threads/:threadId/comments
 * @access Private
 */
exports.createComment = async (req, res) => {
  try {
    const { threadId } = req.params;
    const { content, parentCommentId } = req.body;
    const userId = req.user.id;
    const username = req.user.username;

    console.log('💬 Create comment request:', { threadId, userId, username, parentCommentId });

    // Validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu không hợp lệ',
        errors: errors.array()
      });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nội dung bình luận không được để trống'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(threadId)) {
      return res.status(400).json({
        success: false,
        message: 'ID bài viết không hợp lệ'
      });
    }

    // Kiểm tra thread tồn tại
    const thread = await Thread.findById(threadId);
    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài viết'
      });
    }

    // Kiểm tra parent comment nếu có
    let parentComment = null;
    if (parentCommentId) {
      if (!mongoose.Types.ObjectId.isValid(parentCommentId)) {
        return res.status(400).json({
          success: false,
          message: 'ID bình luận cha không hợp lệ'
        });
      }
      
      parentComment = await Comment.findById(parentCommentId);
      if (!parentComment) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy bình luận cha'
        });
      }
    }

    // Tạo comment mới
    const newComment = new Comment({
      content: content.trim(),
      author: userId,
      username: username,
      avatar: req.user.profile?.picture || null,
      thread: threadId,
      parentComment: parentCommentId || null,
      likes: [],
      created_at: new Date()
    });

    const savedComment = await newComment.save();

    // Cập nhật số lượng comment của thread
    await Thread.findByIdAndUpdate(threadId, {
      $inc: { commentsCount: 1 }
    });

    console.log('✅ Comment created successfully:', savedComment._id);

    // Prepare user data for notifications
    const fromUser = {
      userId: userId,
      username: username,
      avatar: req.user.profile?.picture || null
    };

    console.log('📤 Preparing to send notifications with fromUser:', fromUser);

    // Gửi thông báo
    try {
      if (parentCommentId) {
        console.log('📨 Sending reply notification for parent comment:', parentCommentId);
        // Đây là reply - gửi thông báo cho chủ comment gốc
        await ForumNotificationService.notifyCommentReply(parentCommentId, savedComment, fromUser);
      } else {
        console.log('📨 Sending thread comment notification for thread:', threadId);
        // Đây là comment mới - gửi thông báo cho chủ thread
        await ForumNotificationService.notifyThreadComment(threadId, savedComment, fromUser);
      }

      console.log('📨 Processing mentions in content:', content);
      // Xử lý mentions trong comment
      await ForumNotificationService.processMentions(content, threadId, savedComment._id, fromUser);
      
      console.log('✅ All notifications sent successfully');
    } catch (notificationError) {
      console.error('❌ Error sending notifications:', notificationError);
      // Không throw error để không ảnh hưởng đến việc tạo comment
    }

    res.status(201).json({
      success: true,
      message: 'Tạo bình luận thành công',
      data: {
        _id: savedComment._id,
        content: savedComment.content,
        username: savedComment.username,
        avatar: savedComment.avatar,
        likes: savedComment.likes,
        likesCount: 0,
        created_at: savedComment.created_at,
        parentComment: savedComment.parentComment,
        replies: []
      }
    });
  } catch (err) {
    console.error('❌ Create comment error:', err);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi tạo bình luận'
    });
  }
};

/**
 * Like một comment
 * @route POST /v1/forum/comments/:commentId/like
 * @access Private
 */
exports.likeComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;
    const username = req.user.username;

    console.log('👍 Like comment request:', { commentId, userId });

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({
        success: false,
        message: 'ID bình luận không hợp lệ'
      });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bình luận'
      });
    }

    const userIdObj = new mongoose.Types.ObjectId(userId);
    const hasLiked = comment.likes.includes(userIdObj);

    if (hasLiked) {
      // Remove like
      comment.likes.pull(userIdObj);
    } else {
      // Add like
      comment.likes.push(userIdObj);
      
      // Gửi thông báo khi like (chỉ khi add like, không gửi khi unlike)
      try {
        const fromUser = {
          userId: userId,
          username: username,
          avatar: req.user.profile?.picture || null
        };
        await ForumNotificationService.notifyCommentLike(commentId, fromUser);
      } catch (notificationError) {
        console.error('❌ Error sending like notification:', notificationError);
      }
    }

    await comment.save();

    console.log('✅ Comment like updated successfully');

    res.json({
      success: true,
      message: hasLiked ? 'Đã bỏ thích bình luận' : 'Đã thích bình luận',
      data: {
        liked: !hasLiked,
        likesCount: comment.likes.length
      }
    });
  } catch (err) {
    console.error('❌ Like comment error:', err);
    
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'ID bình luận không hợp lệ'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi thích bình luận'
    });
  }
};

/**
 * Lấy comments của thread với phân trang
 * @route GET /v1/forum/threads/:threadId/comments
 * @access Public
 */
exports.getThreadComments = async (req, res) => {
  try {
    const { threadId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // Validate thread exists
    const thread = await Thread.findById(threadId);
    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài viết'
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Lấy comments gốc (không phải reply)
    const comments = await Comment.find({
      thread: threadId,
      parentComment: null,
      status: 'approved'
    })
    .select('content username avatar likes replies created_at')
    .sort({ created_at: -1 })
    .limit(parseInt(limit))
    .skip(skip)
    .lean();

    // Lấy replies cho mỗi comment
    const commentIds = comments.map(comment => comment._id);
    const replies = await Comment.find({
      parentComment: { $in: commentIds },
      status: 'approved'
    })
    .select('content username avatar likes created_at parentComment')
    .sort({ created_at: 1 })
    .lean();

    // Group replies by parent comment
    const repliesMap = replies.reduce((map, reply) => {
      const parentId = reply.parentComment.toString();
      if (!map[parentId]) map[parentId] = [];
      map[parentId].push({
        ...reply,
        likesCount: reply.likes.length
      });
      return map;
    }, {});

    // Format comments with replies
    const formattedComments = comments.map(comment => ({
      ...comment,
      likesCount: comment.likes.length,
      repliesCount: comment.replies.length,
      replies: repliesMap[comment._id.toString()] || []
    }));

    // Count total comments
    const totalComments = await Comment.countDocuments({
      thread: threadId,
      parentComment: null,
      status: 'approved'
    });

    res.json({
      success: true,
      data: {
        comments: formattedComments,
        pagination: {
          total: totalComments,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(totalComments / parseInt(limit))
        }
      }
    });
  } catch (err) {
    console.error('Get comments error:', err);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy bình luận'
    });
  }
};

/**
 * Cập nhật/sửa comment
 * @route PUT /v1/forum/comments/:commentId
 * @access Private
 */
exports.updateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;
    const username = req.user.username;

    console.log('✏️ Update comment request:', { commentId, userId, username });

    // Validation
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nội dung bình luận không được để trống'
      });
    }

    if (content.trim().length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Nội dung bình luận không được vượt quá 1000 ký tự'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({
        success: false,
        message: 'ID bình luận không hợp lệ'
      });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bình luận'
      });
    }

    // Kiểm tra quyền sửa: chỉ cho phép chủ comment
    const canEdit = (
      comment.username === username || 
      comment.author.toString() === userId
    );

    if (!canEdit) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền sửa bình luận này'
      });
    }

    // Kiểm tra thời gian: chỉ cho phép sửa trong 24h
    const createdAt = new Date(comment.created_at);
    const now = new Date();
    const hoursDiff = (now - createdAt) / (1000 * 60 * 60);

    if (hoursDiff > 24) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ có thể sửa bình luận trong vòng 24 giờ sau khi đăng'
      });
    }

    console.log('✅ User authorized to edit comment');

    // Cập nhật comment
    const updatedComment = await Comment.findByIdAndUpdate(
      commentId,
      {
        content: content.trim(),
        updated_at: new Date()
      },
      { new: true }
    ).select('content username avatar likes created_at updated_at parentComment');

    console.log('✅ Comment updated successfully');

    res.json({
      success: true,
      message: 'Đã cập nhật bình luận thành công',
      data: {
        ...updatedComment.toObject(),
        likesCount: updatedComment.likes.length,
        edited: true
      }
    });
  } catch (err) {
    console.error('❌ Update comment error:', err);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật bình luận'
    });
  }
};

/**
 * Xóa comment
 * @route DELETE /v1/forum/comments/:commentId
 * @access Private
 */
exports.deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;
    const username = req.user.username;

    console.log('🗑️ Delete comment request:', { commentId, userId, username });

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({
        success: false,
        message: 'ID bình luận không hợp lệ'
      });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bình luận'
      });
    }

    // Kiểm tra quyền xóa: chỉ cho phép chủ comment
    const canDelete = (
      comment.username === username || 
      comment.author.toString() === userId
    );

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa bình luận này'
      });
    }

    console.log('✅ User authorized to delete comment');

    // Nếu là comment gốc, xóa tất cả replies
    if (!comment.parentComment) {
      await Comment.deleteMany({ parentComment: commentId });
      console.log('✅ Deleted all replies for parent comment');
    }

    // Xóa comment
    await Comment.findByIdAndDelete(commentId);
    
    // Cập nhật comment count của thread
    const threadId = comment.thread;
    await Thread.findByIdAndUpdate(threadId, {
      $inc: { commentsCount: -1 }
    });

    console.log('✅ Comment deleted successfully');

    res.json({
      success: true,
      message: 'Đã xóa bình luận thành công'
    });
  } catch (err) {
    console.error('❌ Delete comment error:', err);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi xóa bình luận'
    });
  }
};