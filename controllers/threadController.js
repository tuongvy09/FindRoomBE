const Thread = require('../models/thread');
const Comment = require('../models/Comment');
const User = require('../models/User');
const ForumNotificationService = require('../services/forumNotificationService');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const { io } = require('../congfig/websocket');
const { requestThreadApproval } = require('./aiController');

/**
 * Tạo thread mới
 * @route POST /v1/forum/threads
 * @access Private
 */
exports.createThread = async (req, res) => {
  console.log("Request body:", req.body);

  try {
    // Kiểm tra lỗi validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { title, content, tags, image } = req.body;

    // Kiểm tra thông tin user
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Thông tin người dùng không hợp lệ'
      });
    }

    // Kiểm tra username
    if (!req.user.username) {
      return res.status(400).json({
        success: false,
        message: 'Username không tồn tại. Vui lòng cập nhật thông tin tài khoản.'
      });
    }

    // Tạo thread mới với username và avatar
    const newThread = new Thread({
      title,
      content,
      tags: tags || [],
      author: req.user.id,
      username: req.user.username,
      avatar: req.user.profile?.picture || null,
      status: 'pending',
      image: image || null // Đảm bảo image được lưu
    });

    const savedThread = await newThread.save();

    let approvalResult;
    try {
      approvalResult = await requestThreadApproval(title, content);
    } catch (err) {
      console.error("Lỗi khi gọi AI kiểm duyệt:", err.message);
      approvalResult = { approve: false, reason: "Không thể kiểm duyệt tự động, cần duyệt thủ công" };
    }

    // Cập nhật trạng thái bài viết dựa trên AI
    savedThread.status = approvalResult.approve ? 'approved' : 'rejected';
    await savedThread.save();
    await createThreadApprovalNotification(req.user.id, savedThread, savedThread.status, approvalResult.reason);
    
    // Trả về thread đã được lưu
    res.status(201).json({
      success: true,
      message: 'Tạo bài viết thành công! Đang chờ phê duyệt.',
      data: {
        id: savedThread._id,
        title: savedThread.title,
        content: savedThread.content,
        username: savedThread.username,
        avatar: savedThread.avatar,
        tags: savedThread.tags,
        status: savedThread.status,
        image: savedThread.image, // Include image in response
        created_at: savedThread.created_at
      }
    });
  } catch (err) {
    console.error('Create thread error:', err.message);

    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu không hợp lệ',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Lỗi server khi tạo bài viết'
    });
  }
};

/**
 * Lấy tất cả threads với phân trang
 * @route GET /v1/forum/threads
 * @access Public
 */
exports.getAllThreads = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const query = { status: 'approved' };
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // FIXED: Include image field in select
    let threads = await Thread.find(query)
      .select('title content username avatar tags likes dislikes viewCount created_at status author image') // Added image
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Thread.countDocuments(query);
    const threadIds = threads.map(thread => thread._id);

    // Đếm số comments cho tất cả threads
    const commentCounts = await Comment.aggregate([
      { $match: { thread: { $in: threadIds } } },
      { $group: { _id: '$thread', count: { $sum: 1 } } }
    ]);

    const commentCountMap = commentCounts.reduce((map, item) => {
      map[item._id.toString()] = item.count;
      return map;
    }, {});

    // Format threads với like/dislike counts và author info
    threads = threads.map(thread => ({
      _id: thread._id,
      title: thread.title,
      content: thread.content,
      username: thread.username,
      avatar: thread.avatar,
      tags: thread.tags,
      likesCount: thread.likes.length,
      dislikesCount: thread.dislikes.length,
      commentCount: commentCountMap[thread._id.toString()] || 0,
      viewCount: thread.viewCount,
      created_at: thread.created_at,
      status: thread.status,
      author: thread.author,
      image: thread.image // Include image in response
    }));

    res.json({
      success: true,
      data: threads,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Get threads error:', err);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách threads'
    });
  }
};

/**
 * Lấy thread theo ID với like/dislike counts
 * @route GET /v1/forum/threads/:id
 * @access Public
 */
exports.getThreadById = async (req, res) => {
  try {
    const { id } = req.params;

    // FIXED: Include image field in select and update view count
    const thread = await Thread.findByIdAndUpdate(
      id,
      { $inc: { viewCount: 1 } },
      { new: true }
    )
      .select('title content username avatar tags likes dislikes viewCount created_at status image') // Added image
      .lean();

    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài viết'
      });
    }

    if (thread.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Bài viết chưa được phê duyệt'
      });
    }

    const commentCount = await Comment.countDocuments({ thread: id });

    // Format response
    const formattedThread = {
      _id: thread._id,
      title: thread.title,
      content: thread.content,
      username: thread.username,
      avatar: thread.avatar,
      tags: thread.tags,
      likesCount: thread.likes.length,
      dislikesCount: thread.dislikes.length,
      commentCount,
      viewCount: thread.viewCount,
      created_at: thread.created_at,
      status: thread.status,
      image: thread.image // Include image in response
    };

    res.json({
      success: true,
      data: formattedThread
    });
  } catch (err) {
    console.error('Get thread by ID error:', err);

    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'ID bài viết không hợp lệ'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy bài viết'
    });
  }
};

/**
 * Cập nhật thread
 * @route PUT /v1/forum/threads/:id
 * @access Private
 */
exports.updateThread = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, tags, image, removeImage } = req.body; // Added image and removeImage
    const userId = req.user.id;
    const username = req.user.username;

    console.log('✏️ Update thread request:', { id, userId, username, hasImage: !!image, removeImage });

    // Validation
    if (!title || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tiêu đề không được để trống'
      });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nội dung không được để trống'
      });
    }

    if (title.trim().length > 200) {
      return res.status(400).json({
        success: false,
        message: 'Tiêu đề không được vượt quá 200 ký tự'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID bài viết không hợp lệ'
      });
    }

    const thread = await Thread.findById(id);
    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài viết'
      });
    }

    // Kiểm tra quyền sửa: chỉ cho phép chủ thread
    const canEdit = (
      thread.username === username ||
      thread.author.toString() === userId
    );

    if (!canEdit) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền sửa bài viết này'
      });
    }

    // Kiểm tra thời gian: chỉ cho phép sửa trong 24h
    const createdAt = new Date(thread.created_at);
    const now = new Date();
    const hoursDiff = (now - createdAt) / (1000 * 60 * 60);

    if (hoursDiff > 24) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ có thể sửa bài viết trong vòng 24 giờ sau khi đăng'
      });
    }

    console.log('✅ User authorized to edit thread');

    // Prepare update data
    const updateData = {
      title: title.trim(),
      content: content.trim(),
      tags: tags || thread.tags,
      updated_at: new Date()
    };

    // Handle image update
    if (removeImage) {
      updateData.image = null;
    } else if (image) {
      updateData.image = image;
    }
    // If neither removeImage nor image is provided, keep existing image

    // Cập nhật thread
    const updatedThread = await Thread.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).select('title content username avatar tags likes dislikes viewCount created_at updated_at author image'); // Include image

    console.log('✅ Thread updated successfully');

    res.json({
      success: true,
      message: 'Đã cập nhật bài viết thành công',
      data: {
        ...updatedThread.toObject(),
        likesCount: updatedThread.likes.length,
        dislikesCount: updatedThread.dislikes.length,
        edited: true
      }
    });
  } catch (err) {
    console.error('❌ Update thread error:', err);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật bài viết'
    });
  }
};

/**
 * Xóa thread
 * @route DELETE /v1/forum/threads/:id
 * @access Private
 */
exports.deleteThread = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const username = req.user.username;

    console.log('🗑️ Delete thread request:', { id, userId, username });

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID bài viết không hợp lệ'
      });
    }

    const thread = await Thread.findById(id);
    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài viết'
      });
    }

    // Kiểm tra quyền xóa: chỉ cho phép chủ thread
    const canDelete = (
      thread.username === username ||
      thread.author.toString() === userId
    );

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa bài viết này'
      });
    }

    console.log('✅ User authorized to delete thread');

    // Xóa tất cả comments của thread trước
    await Comment.deleteMany({ thread: id });
    console.log('✅ Deleted all comments for thread');

    // Xóa thread
    await Thread.findByIdAndDelete(id);
    console.log('✅ Thread deleted successfully');

    res.json({
      success: true,
      message: 'Đã xóa bài viết thành công'
    });
  } catch (err) {
    console.error('❌ Delete thread error:', err);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi xóa bài viết'
    });
  }
};

/**
 * Like một thread
 * @route POST /v1/forum/threads/:id/like
 * @access Private
 */
exports.likeThread = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const username = req.user.username;

    console.log('👍 Like thread request:', { id, userId, username });

    // Tìm thread
    const thread = await Thread.findById(id);
    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài viết'
      });
    }

    // Check thread status
    if (thread.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Bài viết chưa được phê duyệt'
      });
    }

    const userIdObj = new mongoose.Types.ObjectId(userId);

    // Kiểm tra user đã like chưa
    const hasLiked = thread.likes.includes(userIdObj);
    const hasDisliked = thread.dislikes.includes(userIdObj);

    if (hasLiked) {
      // Nếu đã like thì remove like (toggle off)
      thread.likes.pull(userIdObj);
    } else {
      // Nếu chưa like
      if (hasDisliked) {
        // Remove dislike nếu có
        thread.dislikes.pull(userIdObj);
      }
      // Add like
      thread.likes.push(userIdObj);

      // Gửi thông báo khi like thread (chỉ khi add like)
      try {
        const fromUser = {
          userId: userId,
          username: username,
          avatar: req.user.profile?.picture || null
        };
        await ForumNotificationService.notifyThreadLike(id, fromUser);
      } catch (notificationError) {
        console.error('❌ Error sending thread like notification:', notificationError);
      }
    }

    await thread.save();

    res.json({
      success: true,
      message: hasLiked ? 'Đã bỏ thích' : 'Đã thích bài viết',
      data: {
        liked: !hasLiked,
        disliked: false,
        likesCount: thread.likes.length,
        dislikesCount: thread.dislikes.length
      }
    });
  } catch (err) {
    console.error('Like thread error:', err);

    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'ID bài viết không hợp lệ'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Lỗi server khi thích bài viết'
    });
  }
};

/**
 * Dislike một thread
 * @route POST /v1/forum/threads/:id/dislike
 * @access Private
 */
exports.dislikeThread = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Tìm thread
    const thread = await Thread.findById(id);
    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài viết'
      });
    }

    // Check thread status
    if (thread.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Bài viết chưa được phê duyệt'
      });
    }

    const userIdObj = new mongoose.Types.ObjectId(userId);

    // Kiểm tra user đã dislike chưa
    const hasLiked = thread.likes.includes(userIdObj);
    const hasDisliked = thread.dislikes.includes(userIdObj);

    if (hasDisliked) {
      // Nếu đã dislike thì remove dislike (toggle off)
      thread.dislikes.pull(userIdObj);
    } else {
      // Nếu chưa dislike
      if (hasLiked) {
        // Remove like nếu có
        thread.likes.pull(userIdObj);
      }
      // Add dislike
      thread.dislikes.push(userIdObj);
    }

    await thread.save();

    res.json({
      success: true,
      message: hasDisliked ? 'Đã bỏ không thích' : 'Đã không thích bài viết',
      data: {
        liked: false,
        disliked: !hasDisliked,
        likesCount: thread.likes.length,
        dislikesCount: thread.dislikes.length
      }
    });
  } catch (err) {
    console.error('Dislike thread error:', err);

    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'ID bài viết không hợp lệ'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Lỗi server khi không thích bài viết'
    });
  }
};

/**
 * Lấy trạng thái like/dislike của user cho một thread
 * @route GET /v1/forum/threads/:id/like-status
 * @access Private
 */
exports.getThreadLikeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Tìm thread
    const thread = await Thread.findById(id).select('likes dislikes');
    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài viết'
      });
    }

    const userIdObj = new mongoose.Types.ObjectId(userId);
    const hasLiked = thread.likes.includes(userIdObj);
    const hasDisliked = thread.dislikes.includes(userIdObj);

    res.json({
      success: true,
      data: {
        liked: hasLiked,
        disliked: hasDisliked,
        likesCount: thread.likes.length,
        dislikesCount: thread.dislikes.length
      }
    });
  } catch (err) {
    console.error('Get like status error:', err);

    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'ID bài viết không hợp lệ'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy trạng thái thích'
    });
  }
};

exports.getAllTags = async (req, res) => {
  try {
    const tags = await Thread.aggregate([
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const allTags = tags.map(tag => tag._id);
    const top8Tags = allTags.slice(0, 8);

    res.json({ allTags, top8Tags });
  } catch (error) {
    console.error("Lỗi khi lấy tags:", error);
    res.status(500).json({ error: 'Lỗi lấy tags', message: error.message, stack: error.stack });
  }
};

//Tìm kiếm threads với nhiều tiêu chí
exports.searchThreads = async (req, res) => {
  try {
    const {
      keyword,
      authorId,
      username,
      tags,
      status = 'approved',
      page = 1,
      limit = 10,
      sort = 'newest'
    } = req.query;

    const query = {};

    // Lọc theo trạng thái
    if (status) query.status = status;

    // Tìm theo keyword mở rộng (title, content, username, authorId)
    if (keyword) {
      const regex = new RegExp(keyword, 'i');
      const keywordConditions = [
        { title: regex },
        { content: regex },
        { username: regex }
      ];

      // Nếu keyword là ObjectId hợp lệ, thêm vào điều kiện author
      if (mongoose.Types.ObjectId.isValid(keyword)) {
        keywordConditions.push({ author: keyword });
      }

      query.$or = keywordConditions;
    }

    // Nếu người dùng truyền authorId riêng
    if (authorId) {
      query.author = authorId;
    }

    // Nếu người dùng truyền username riêng
    if (username) {
      query.username = new RegExp(username, 'i');
    }

    // Lọc theo tags
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(',');
      query.tags = { $in: tagArray };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOption = sort === 'oldest' ? { created_at: 1 } : { created_at: -1 };

    // FIXED: Include image field in select
    let threads = await Thread.find(query)
      .select('title content username avatar tags likes dislikes viewCount created_at status author image') // Added image
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Thread.countDocuments(query);

    // Đếm số lượng comment
    const threadIds = threads.map(thread => thread._id);
    const commentCounts = await Comment.aggregate([
      { $match: { thread: { $in: threadIds } } },
      { $group: { _id: '$thread', count: { $sum: 1 } } }
    ]);

    const commentCountMap = commentCounts.reduce((map, item) => {
      map[item._id.toString()] = item.count;
      return map;
    }, {});

    // Format lại kết quả
    threads = threads.map(thread => ({
      _id: thread._id,
      title: thread.title,
      content: thread.content,
      username: thread.username,
      avatar: thread.avatar,
      tags: thread.tags,
      likesCount: thread.likes.length,
      dislikesCount: thread.dislikes.length,
      commentCount: commentCountMap[thread._id.toString()] || 0,
      viewCount: thread.viewCount,
      created_at: thread.created_at,
      status: thread.status,
      author: thread.author,
      image: thread.image // Include image in response
    }));

    res.json({
      success: true,
      data: threads,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (err) {
    console.error('Search threads error:', err);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi tìm kiếm threads'
    });
  }
};

//controler của admin
//Duyệt thread
// DUYỆT BÀI VIẾT
exports.approveThread = async (req, res) => {
  try {
    const { threadId } = req.params;

    const thread = await Thread.findById(threadId);
    if (!thread) {
      return res.status(404).json({ message: 'Bài viết không tồn tại' });
    }

    thread.status = 'approved';
    thread.updated_at = Date.now();
    await thread.save();

    res.status(200).json({ message: 'Bài viết đã được duyệt thành công', thread });
  } catch (error) {
    console.error('Lỗi khi duyệt bài viết:', error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
};

// TỪ CHỐI BÀI VIẾT
exports.rejectThread = async (req, res) => {
  try {
    const { threadId } = req.params;

    const thread = await Thread.findById(threadId);
    if (!thread) {
      return res.status(404).json({ message: 'Bài viết không tồn tại' });
    }

    thread.status = 'rejected';
    thread.updated_at = Date.now();
    await thread.save();

    res.status(200).json({ message: 'Bài viết đã bị từ chối', thread });
  } catch (error) {
    console.error('Lỗi khi từ chối bài viết:', error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
};

const createThreadApprovalNotification = async (userId, thread, status, reason) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      console.error('User not found:', userId);
      return;
    }

    // Tạo nội dung thông báo tùy theo trạng thái duyệt bài
    let message;
    if (status === 'approved') {
      message = `Bài viết "${thread.title}" của bạn đã được duyệt thành công!`;
    } else if (status === 'rejected') {
      message = `Bài viết "${thread.title}" của bạn đã bị từ chối. Lý do: ${reason}`;
    } else {
      message = `Bài viết "${thread.title}" của bạn đang chờ duyệt.`;
    }

    const newNotification = {
      message,
      type: 'thread_approval',
      thread_id: thread._id,
      status: 'unread',
      createdAt: new Date(),
    };

    // Push thông báo vào mảng notifications của user
    user.notifications.push(newNotification);
    await user.save();

    // Gửi thông báo realtime qua socket
    const socket = io();
    socket.to(userId.toString()).emit('notification', newNotification);

    console.log(`Thread approval notification sent to user ${userId}`);
  } catch (error) {
    console.error('Error creating thread approval notification:', error);
  }
};