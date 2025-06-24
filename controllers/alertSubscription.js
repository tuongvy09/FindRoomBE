const AlertSubscription = require("../models/AlertSubscription");
const User = require("../models/User");
const sendEmail = require("../services/emailService");
const { io } = require('../congfig/websocket');
const nodemailer = require("nodemailer");

// Tạo subscription
const createAlertSubscription = async (req, res) => {
    try {
        const userId = req.user.id;

        const newSubscription = new AlertSubscription({
            ...req.body,
            user: userId,
        });

        const savedSubscription = await newSubscription.save();
        res.status(201).json(savedSubscription);
    } catch (error) {
        console.error("Error creating alert subscription:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const checkAlertSubscriptions = async (approvedPost) => {
    try {

        const subscriptions = await AlertSubscription.find();

        for (const subscription of subscriptions) {
            const matched = matchSubscriptionWithPost(subscription, approvedPost);

            if (matched) {
                const user = await User.findById(subscription.user);
                if (!user) {
                    console.warn(`[checkAlertSubscriptions] Không tìm thấy user với ID: ${subscription.user}`);
                    continue;
                }

                if (subscription.notifyMethod === 'email' || subscription.notifyMethod === 'both') {
                    sendEmailNotification(user.email, approvedPost);
                }
                if (subscription.notifyMethod === 'web' || subscription.notifyMethod === 'both') {
                    await createInAppNotification(user._id, approvedPost);
                }
            }
        }

    } catch (err) {
        console.error('Error checking subscriptions:', err);
    }
};

function matchSubscriptionWithPost(subscription, post) {
    if (post.category !== subscription.category) return false;
    const transactionMatchMap = {
        "Cần thuê": "Cho thuê",
        "Cần mua": "Cần bán",
    };

    if (transactionMatchMap[subscription.transactionType] !== post.transactionType) {
        return false;
    } if (post.address?.province !== subscription.address?.province) return false;
    if (post.address?.district !== subscription.address?.district) return false;

    const inPriceRange = post.price >= subscription.priceRange.min && post.price <= subscription.priceRange.max;
    const inAreaRange = post.area >= subscription.areaRange.min && post.area <= subscription.areaRange.max;

    return inPriceRange && inAreaRange;
}

const sendEmailNotification = async (userEmail, post) => {
    try {
        const subject = `Thông báo: Có bài đăng mới phù hợp với bạn`;
        const html = `
      <h3>Chào bạn,</h3>
      <p>Chúng tôi vừa tìm thấy một bài đăng phù hợp với yêu cầu của bạn:</p>
      <ul>
          <li><strong>Tiêu đề:</strong> ${post.title}</li>
          <li><strong>Giá:</strong> ${post.price} VND</li>
          <li><strong>Diện tích:</strong> ${post.area} m²</li>
          <li><strong>Khu vực:</strong> ${post.address?.district}, ${post.address?.province}</li>
      </ul>
      <p><a href="https://yourwebsite.com/posts/${post._id}">Xem chi tiết bài đăng</a></p>
      <br/>
      <p>Trân trọng,<br/>Phòng trọ xinh</p>
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
            to: userEmail,
            subject,
            html,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("Email đã gửi: ", info.response);
    } catch (error) {
        throw new Error("Không thể gửi email thông báo.");
    }
};
const createInAppNotification = async (userId, post) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            console.error('User not found:', userId);
            return;
        }

        const message = `Có bài đăng mới phù hợp: ${post.title}`;
        const newNotification = {
            message,
            type: 'post',
            post_id: post._id,
            status: "unread",
            createdAt: new Date(),
        };
        user.notifications.push(newNotification);
        await user.save();

        const socket = io();
        socket.to(userId.toString()).emit("notification", newNotification);
        console.log("In-app notification sent to user", userId);
    } catch (error) {
        console.error("Error creating in-app notification:", error);
    }
};

module.exports = {
    createAlertSubscription,
    checkAlertSubscriptions,
};
