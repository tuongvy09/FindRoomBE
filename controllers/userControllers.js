const User = require("../models/User");
const Post = require("../models/Post")
const nodemailer = require('nodemailer');
// const sendEmail = require('../services/emailService');

const userController = {
  //get all users
  getAllUsers: async (req, res) => {
    try {
      const users = await User.find();
      res.status(200).json(users);
    } catch (err) {
      // res.status(500).json(err);
      console.error("Error details: ", err);  // In chi tiết lỗi ra console
      res.status(500).json({ error: "An error occurred", details: err.message });
    }
  },
 getUserProfile : async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log("🔍 getUserProfile: Getting user profile for userId:", userId);
    
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    console.log("✅ getUserProfile: User profile found:", {
      id: user._id,
      username: user.username,
      postQuota: user.postQuota,
      email: user.email
    });
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error("getUserProfile error:", error);
    res.status(500).json({
      success: false,
      message: "Error getting user profile",
      error: error.message
    });
  }
},

  //delete user
  deleteUser: async (req, res) => {
    try {
      const user = await User.findByIdAndDelete(req.params.id);
      res.status(200).json("Delete successfully!");
    } catch (err) {
      res.status(500).json(err);
    }
  },

  // Khóa/Mở khóa tài khoản và gửi email thông báo
  toggleBlockUser: async (req, res) => {
    try {
      const userId = req.params.id;
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ message: "Không tìm thấy người dùng" });
      }

      // Đảo ngược trạng thái khóa/mở khóa
      user.profile.isBlocked = !user.profile.isBlocked;
      await user.save();

      // Gửi email thông báo
      const subject = user.profile.isBlocked
        ? "Tài khoản của bạn đã bị khóa"
        : "Tài khoản của bạn đã được mở khóa";

      // Nội dung email
      const html = user.profile.isBlocked
        ? `
        <p>Chào bạn,</p>
        <p>Tài khoản của bạn đã bị khóa do vi phạm chính sách hoặc hành vi không tuân thủ các điều khoản dịch vụ của chúng tôi. Đây là một quyết định nghiêm túc và được đưa ra sau khi xem xét kỹ lưỡng các hoạt động của bạn.</p>
        <p>Vui lòng kiểm tra kỹ lại các hành động của mình để hiểu rõ lý do và tránh tái phạm trong tương lai. Nếu bạn nghĩ đây là một sự nhầm lẫn hoặc cần giải thích thêm, hãy liên hệ với bộ phận hỗ trợ khách hàng của chúng tôi qua email hoặc số điện thoại dưới đây:</p>
        <ul>
          <li>Email hỗ trợ: PhongTroXinh@gmail.com</li>
          <li>Số điện thoại hỗ trợ: 04564789</li>
        </ul>
        <p>Chúng tôi sẽ làm việc cùng bạn để giải quyết vấn đề này một cách nhanh chóng và công bằng.</p>
        <img src="https://i.pinimg.com/736x/51/46/0c/51460cf91031e29fe2950c7464b28c62.jpg" alt="Account Blocked" width="600" />
        <p>Trân trọng, <br> Đội ngũ hỗ trợ của Phòng trọ xinh</p>
      `
        : `
        <p>Chào bạn,</p>
        <p>Chúng tôi vui mừng thông báo rằng tài khoản của bạn đã được mở khóa thành công và bạn có thể tiếp tục sử dụng tất cả các dịch vụ của chúng tôi mà không gặp bất kỳ hạn chế nào.</p>
        <p>Chúng tôi rất tiếc vì bất kỳ sự bất tiện nào mà tình trạng tài khoản đã gây ra và hy vọng rằng bạn sẽ tiếp tục tận hưởng trải nghiệm tuyệt vời cùng chúng tôi.</p>
        <p>Nếu bạn gặp bất kỳ vấn đề gì hoặc cần hỗ trợ thêm, đừng ngần ngại liên hệ với đội ngũ hỗ trợ qua các kênh sau:</p>
        <ul>
          <li>Email hỗ trợ: PhongTroXinh@gmail.com</li>
          <li>Số điện thoại hỗ trợ: 04564789</li>
        </ul>
        <img src="https://i.pinimg.com/736x/a5/9a/66/a59a663935620f7a8b227675652bd5ac.jpg" alt="Account Unblocked" width="600" />
        <p>Chúc bạn có một ngày tuyệt vời và trải nghiệm dịch vụ của chúng tôi một cách trọn vẹn!</p>
        <p>Trân trọng, <br> Đội ngũ hỗ trợ của Phòng trọ xinh</p>
      `;

      // Cấu hình email
      const transporter = nodemailer.createTransport({
        service: "Gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const mailOptions = {
        from: `"Phòng trọ xinh" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject,
        html,
      };

      // Gửi email
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error("Gửi email thất bại:", error);
          return res.status(500).json({ error: "Có lỗi xảy ra khi gửi email." });
        }
        console.log("Email sent: " + info.response);
        res.status(200).json({ message: "Tài khoản đã được cập nhật và email thông báo đã được gửi." });
      });
    } catch (error) {
      console.error("Error details: ", error);
      res.status(500).json({ error: "Đã xảy ra lỗi", details: error.message });
    }
  },

  detectSuspiciousActivity: async (userId, reason) => {
    try {
      const user = await User.findById(userId);
      if (!user || user.profile.isBlocked) return;

      // Nếu chưa có mảng suspiciousActivityCount, khởi tạo mặc định
      if (!user.suspiciousActivityCount || user.suspiciousActivityCount.length === 0) {
        user.suspiciousActivityCount = [{
          loginCount: 0,
          reviewCount: 0
        }];
      }

      const suspiciousData = user.suspiciousActivityCount[0];

      // Tăng đúng loại count dựa vào reason
      if (reason === "Cố gắng đăng nhập nhiều lần") {
        suspiciousData.loginCount += 1;

        // Kiểm tra nếu login quá 5 lần thì khóa
        if (suspiciousData.loginCount >= 5) {
          user.profile.isBlocked = true;
        }

      } else if (reason === "Spam review") {
        suspiciousData.reviewCount += 1;

        if (suspiciousData.reviewCount >= 2) {
          user.profile.isBlocked = true;
        }
      }

      // Nếu bị khóa thì gửi email
      if (user.profile.isBlocked) {
        const subject = "Tài khoản của bạn đã bị khóa";

        const html = `
          <p>Chào bạn,</p>
          <p>Tài khoản của bạn đã bị <strong>tự động khóa</strong> do phát hiện hoạt động đáng ngờ: ${reason}.</p>   
          <p>Vui lòng kiểm tra kỹ lại các hành động của mình để hiểu rõ lý do và tránh tái phạm trong tương lai. Nếu bạn nghĩ đây là một sự nhầm lẫn hoặc cần giải thích thêm, hãy liên hệ với bộ phận hỗ trợ khách hàng của chúng tôi qua email hoặc số điện thoại dưới đây:</p>
          <ul>
            <li>Email hỗ trợ: PhongTroXinh@gmail.com</li>
            <li>Số điện thoại hỗ trợ: 04564789</li>
          </ul>
          <p>Chúng tôi sẽ làm việc cùng bạn để giải quyết vấn đề này một cách nhanh chóng và công bằng.</p>
          <img src="https://i.pinimg.com/736x/51/46/0c/51460cf91031e29fe2950c7464b28c62.jpg" alt="Account Blocked" width="600" />
          <p>Trân trọng, <br> Đội ngũ hỗ trợ của Phòng trọ xinh</p>
        `;

        const transporter = nodemailer.createTransport({
          service: "Gmail",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        const mailOptions = {
          from: `"Phòng trọ xinh" <${process.env.EMAIL_USER}>`,
          to: user.email,
          subject,
          html,
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error("Gửi email thất bại:", error);
          } else {
            console.log("Email sent: " + info.response);
          }
        });
      }

      await user.save();

    } catch (error) {
      console.error("Lỗi trong detectSuspiciousActivity:", error);
      throw error;
    }
  },


  updateUserProfile: async (req, res) => {
    try {
      const userId = req.params.id;
      const { name, phone, address, bio } = req.body;

      let picture = "";
      if (req.file) {
        picture = req.file.path; // Path của ảnh lưu trữ trên Cloudinary
      }

      let updatedFields = {
        username: name,
        "profile.phone": phone,
        "profile.address": address,
        "profile.bio": bio,
        "profile.picture": picture
      };

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: updatedFields },
        { new: true, runValidators: true }
      );

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      res.status(200).json({
        message: "User profile updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({
        message: "Server error",
        error: error.message,
      });
    }
  },

  markNotificationAsRead: async (req, res) => {
    try {
      const { notificationId } = req.params;
      const userId = req.user.id;

      // Tìm người dùng
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'Người dùng không tồn tại' });
      }

      // Tìm thông báo trong mảng notifications
      const notification = user.notifications.find(notification => notification._id.toString() === notificationId);
      if (!notification) {
        return res.status(404).json({ message: 'Thông báo không tồn tại' });
      }

      // Đánh dấu thông báo là đã đọc
      notification.status = 'read';
      await user.save();

      res.status(200).json({
        message: 'Thông báo đã được đánh dấu là đã đọc',
        notification,
      });
    } catch (error) {
      res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
  },
  getNotificationsByUser: async (req, res) => {
    const userId = req.user.id; // Lấy user ID từ middleware verifyToken

    try {
      // Tìm user dựa trên ID
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Lấy danh sách thông báo từ user
      const notifications = user.notifications || [];

      // Trả danh sách thông báo, sắp xếp theo thời gian (mới nhất trước)
      const sortedNotifications = notifications.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      res.status(200).json({
        message: 'Notifications fetched successfully',
        notifications: sortedNotifications,
      });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  },

  viewPost: async (req, res) => {
    try {
      const userId = req.params.userId;
      const postId = req.params.postId;

      if (!userId) return res.status(401).json({ message: 'Unauthorized' });

      const user = await User.findById(userId);
      const post = await Post.findById(postId);

      if (!user || !post) {
        return res.status(404).json({ message: 'User hoặc Post không tồn tại' });
      }
      const hasViewed = user.viewed.some(
        (viewedPostId) => viewedPostId.toString() === postId
      );

      if (!hasViewed) {
        user.viewed.push(postId);
        post.views += 1;

        await user.save();
        await post.save();
      }

      return res.status(200).json({
        message: 'Cập nhật lượt xem thành công',
        views: post.views,
      });
    } catch (error) {
      console.error('Lỗi cập nhật lượt xem:', error);
      return res.status(500).json({ message: 'Lỗi server' });
    }
  },

  getViewedPosts: async (req, res) => {
    try {
      const userId = req.params.userId;

      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
      const user = await User.findById(userId).populate('viewed');

      if (!user) return res.status(404).json({ message: 'User không tồn tại' });

      return res.status(200).json({
        viewedPosts: user.viewed,
      });
    } catch (error) {
      console.error('Lỗi lấy danh sách bài đăng đã xem:', error);
      return res.status(500).json({ message: 'Lỗi server' });
    }
  }
}

module.exports = userController;