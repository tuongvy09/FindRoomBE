const User = require("../models/User");
const Thread = require("../models/thread");
const Comment = require("../models/Comment");

class ForumNotificationService {
  // Gửi thông báo khi có comment mới
  static async notifyThreadComment(threadId, commentData, fromUser) {
    try {
      const thread = await Thread.findById(threadId).select(
        "author username title"
      );
      if (!thread) {
        return;
      }

      // Không gửi thông báo cho chính mình
      if (thread.author.toString() === fromUser.userId.toString()) {
        return;
      }

      const threadOwner = await User.findById(thread.author);
      if (!threadOwner) {
        return;
      }

      const notification = {
        message: `${fromUser.username} đã bình luận về bài viết "${thread.title}" của bạn`,
        type: "forum_comment",
        thread_id: threadId,
        comment_id: commentData._id,
        from_user: fromUser,
        status: "unread",
        createdAt: new Date(),
      };

      threadOwner.notifications.push(notification);
      const savedUser = await threadOwner.save();

      // Emit socket event
      const io = require("../socket/socketManager").getIO();
      if (io) {
        const roomName = `user_${thread.author}`;

        io.to(roomName).emit("forumNotification", {
          type: "forum_comment",
          notification,
          threadTitle: thread.title,
        });
      } else {
      }
    } catch (error) {
      console.error("❌ Error sending thread comment notification:", error);
    }
  }

  // Gửi thông báo khi có like trên thread
  static async notifyThreadLike(threadId, fromUser) {
    try {
      const thread = await Thread.findById(threadId).select(
        "author username title"
      );
      if (!thread) {
        return;
      }

      // Không gửi thông báo cho chính mình
      if (thread.author.toString() === fromUser.userId.toString()) {
        return;
      }

      const threadOwner = await User.findById(thread.author);
      if (!threadOwner) {
        return;
      }

      const notification = {
        message: `${fromUser.username} đã thích bài viết "${thread.title}" của bạn`,
        type: "forum_like",
        thread_id: threadId,
        from_user: fromUser,
        status: "unread",
        createdAt: new Date(),
      };

      threadOwner.notifications.push(notification);
      await threadOwner.save();

      // Emit socket event
      const io = require("../socket/socketManager").getIO();
      if (io) {
        const roomName = `user_${thread.author}`;

        io.to(roomName).emit("forumNotification", {
          type: "forum_like",
          notification,
          threadTitle: thread.title,
        });
      }
    } catch (error) {
      console.error(error);
    }
  }

  // Gửi thông báo khi có like trên comment
  static async notifyCommentLike(commentId, fromUser) {
    try {
      const comment = await Comment.findById(commentId)
        .populate("thread", "title")
        .select("author username thread");
      if (!comment) {
        return;
      }

      // Không gửi thông báo cho chính mình
      if (comment.author.toString() === fromUser.userId.toString()) {
        return;
      }

      const commentOwner = await User.findById(comment.author);
      if (!commentOwner) {
        return;
      }

      const notification = {
        message: `${fromUser.username} đã thích bình luận của bạn trong "${comment.thread.title}"`,
        type: "forum_like",
        thread_id: comment.thread._id,
        comment_id: commentId,
        from_user: fromUser,
        status: "unread",
        createdAt: new Date(),
      };

      commentOwner.notifications.push(notification);
      await commentOwner.save();

      // Emit socket event
      const io = require("../socket/socketManager").getIO();
      if (io) {
        const roomName = `user_${comment.author}`;

        io.to(roomName).emit("forumNotification", {
          type: "forum_like",
          notification,
          threadTitle: comment.thread.title,
        });
      }
    } catch (error) {
      console.error(error);
    }
  }

  // Gửi thông báo khi có reply comment
  static async notifyCommentReply(parentCommentId, replyData, fromUser) {
    try {
      const parentComment = await Comment.findById(parentCommentId)
        .populate("thread", "title")
        .select("author username thread");
      if (!parentComment) {
        return;
      }

      // Không gửi thông báo cho chính mình
      if (parentComment.author.toString() === fromUser.userId.toString()) {
        return;
      }

      const parentCommentOwner = await User.findById(parentComment.author);
      if (!parentCommentOwner) {
        return;
      }

      const notification = {
        message: `${fromUser.username} đã trả lời bình luận của bạn trong "${parentComment.thread.title}"`,
        type: "forum_reply",
        thread_id: parentComment.thread._id,
        comment_id: replyData._id,
        from_user: fromUser,
        status: "unread",
        createdAt: new Date(),
      };

      parentCommentOwner.notifications.push(notification);
      await parentCommentOwner.save();

      // Emit socket event
      const io = require("../socket/socketManager").getIO();
      if (io) {
        const roomName = `user_${parentComment.author}`;

        io.to(roomName).emit("forumNotification", {
          type: "forum_reply",
          notification,
          threadTitle: parentComment.thread.title,
        });
      }
    } catch (error) {}
  }

  // Xử lý mention trong comment
  static async processMentions(content, threadId, commentId, fromUser) {
    try {
      // Extract mentions từ content (format: @username)
      const mentionRegex = /@(\w+)/g;
      const mentions = [];
      let match;

      while ((match = mentionRegex.exec(content)) !== null) {
        const username = match[1];
        if (username !== fromUser.username) {
          // Không mention chính mình
          mentions.push(username);
        }
      }

      if (mentions.length === 0) {
        return;
      }

      // Remove duplicates
      const uniqueMentions = [...new Set(mentions)];

      const thread = await Thread.findById(threadId).select("title");
      if (!thread) {
        return;
      }

      // Gửi thông báo cho từng user được mention
      for (const username of uniqueMentions) {
        const mentionedUser = await User.findOne({ username: username });
        if (!mentionedUser) {
          continue;
        }

        const notification = {
          message: `${fromUser.username} đã nhắc đến bạn trong bài viết "${thread.title}"`,
          type: "forum_mention",
          thread_id: threadId,
          comment_id: commentId,
          from_user: fromUser,
          status: "unread",
          createdAt: new Date(),
        };

        mentionedUser.notifications.push(notification);
        await mentionedUser.save();

        // Emit socket event
        const io = require("../socket/socketManager").getIO();
        if (io) {
          const roomName = `user_${mentionedUser._id}`;

          io.to(roomName).emit("forumNotification", {
            type: "forum_mention",
            notification,
            threadTitle: thread.title,
          });
        }
      }
    } catch (error) {
      console.error(error);
    }
  }
}

module.exports = ForumNotificationService;
