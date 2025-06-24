const Report = require("../models/Report");
const Post = require("../models/Post");
const User = require("../models/User");
const { io } = require('../congfig/websocket');

const reportPost = async (req, res) => {
    try {
        const { postId, reporter, reason, note } = req.body;

        // 1. Kiểm tra đã từng báo cáo chưa
        const existingReport = await Report.findOne({
            post: postId,
            "reporter.id": reporter.id
        });

        if (existingReport) {
            return res.status(400).json({ message: "Bạn đã báo cáo bài viết này trước đó." });
        }

        // 2. Tạo báo cáo
        const report = new Report({
            post: postId,
            reporter,
            reason,
            note
        });
        await report.save();

        // 3. Cập nhật bài viết
        const post = await Post.findById(postId);
        post.report_count += 1;

        // 4. Gắn cờ nếu ≥ 5 báo cáo
        if (post.report_count >= 5) {
            post.is_flagged = true;
        }

        // 5. Tạm ẩn nếu ≥ 10 báo cáo trong 1 giờ
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const reportsLastHour = await Report.countDocuments({
            post: postId,
            createdAt: { $gte: oneHourAgo }
        });

        if (reportsLastHour >= 10) {
            post.visibility = "hidden";
        }

        // 6. Nếu là lừa đảo => đánh dấu ưu tiên
        if (reason === "Lừa đảo") {
            post.is_priority = true;
        }

        await post.save();

        // 7. Khóa người dùng nếu ≥ 3 bài viết bị flag
        const flaggedPosts = await Post.countDocuments({
            user: post.user,
            is_flagged: true
        });

        if (flaggedPosts >= 3) {
            await User.findByIdAndUpdate(post.user, { is_blocked: true });
        }

        return res.status(201).json({ message: "Báo cáo đã được ghi nhận." });

    } catch (error) {
        console.error("Lỗi báo cáo:", error);
        return res.status(500).json({ message: "Lỗi server." });
    }
};

//api report cho admin
// Lấy danh sách báo cáo, có filter và search
const getReports = async (req, res) => {
    try {
        const { status, search } = req.query;

        // Điều kiện lọc theo trạng thái
        const filter = {};
        if (status) {
            filter.status = status;
        }

        // Tìm tất cả các report và populate thông tin bài viết + người đăng
        const reports = await Report.find(filter)
            .populate({
                path: "post",
                select: "title contactInfo",
                populate: {
                    path: "contactInfo.user",
                    select: "_id full_name email"
                }
            })
            .lean();

        const reportMap = new Map();

        for (let r of reports) {
            const post = r.post;
            const author = post?.contactInfo?.user;

            if (!post || !post._id) continue;

            const key = post._id.toString();

            if (!reportMap.has(key)) {
                reportMap.set(key, {
                    reportId: r._id,
                    postId: post._id,
                    postTitle: post.title,
                    reportCount: 1,
                    reasonCount: { [r.reason]: 1 },
                    status: r.status,
                    note: r.note,
                    reporterEmail: r.reporter?.email || "",
                    authorId: author?._id || null
                });
            } else {
                const item = reportMap.get(key);
                item.reportCount++;
                item.reasonCount[r.reason] = (item.reasonCount[r.reason] || 0) + 1;
            }
        }

        // Format dữ liệu cuối cùng
        let result = Array.from(reportMap.values()).map((item) => {
            const commonReason = Object.entries(item.reasonCount)
                .sort((a, b) => b[1] - a[1])[0][0];

            return {
                reportId: item.reportId,
                postId: item.postId,
                postTitle: item.postTitle,
                reportCount: item.reportCount,
                commonReason,
                status: item.status,
                note: item.note,
                reporterEmail: item.reporterEmail,
                authorId: item.authorId
            };
        });

        // Tìm kiếm theo tiêu đề bài viết (nếu có)
        if (search) {
            result = result.filter(r =>
                r.postTitle.toLowerCase().includes(search.toLowerCase())
            );
        }

        res.json(result);
    } catch (err) {
        console.error("Lỗi khi lấy danh sách báo cáo:", err);
        res.status(500).json({ message: "Server error" });
    }
};

//Xử lý các báo cáo
const handleReports = async (req, res) => {
    try {
        const { reportIds, action } = req.body;

        if (!Array.isArray(reportIds) || !["hide", "keep", "delete"].includes(action)) {
            return res.status(400).json({ message: "Dữ liệu không hợp lệ." });
        }

        const reports = await Report.find({ _id: { $in: reportIds } }).populate({
            path: "post",
            populate: {
                path: "contactInfo.user",
                select: "_id full_name email notifications",
            }
        });

        const socket = io();

        for (const report of reports) {
            const post = report.post;
            const author = post?.contactInfo?.user;

            if (!post || !author?._id) continue;

            let notificationMessage = "";

            switch (action) {
                case "hide":
                    post.visibility = "hidden";
                    await post.save();
                    notificationMessage = `Bài viết "${post.title}" của bạn đã bị ẩn do vi phạm chính sách.`;
                    break;

                case "delete":
                    await Post.deleteOne({ _id: post._id });
                    notificationMessage = `Bài viết "${post.title}" của bạn đã bị xóa do vi phạm nghiêm trọng.`;
                    break;

                case "keep":
                    notificationMessage = `Báo cáo về bài viết "${post.title}" đã được xem xét. Bài viết của bạn được giữ nguyên.`;
                    break;
            }

            // Đánh dấu báo cáo đã xử lý
            report.status = "Resolved";
            await report.save();

            // Gửi thông báo nếu có message
            if (notificationMessage) {
                const notification = {
                    message: notificationMessage,
                    type: "post",
                    post_id: post._id,
                    status: "unread",
                    createdAt: new Date(),
                };

                // Đẩy thông báo vào notifications của user
                author.notifications.push(notification);
                await author.save();

                // Gửi qua socket nếu có
                const socketRoom = author._id.toString();
                socket.to(socketRoom).emit("notification", notification);

                console.log(`>>> Gửi notification đến user ${socketRoom}:`, notificationMessage);
            }
        }

        return res.json({ message: "Xử lý báo cáo thành công." });
    } catch (err) {
        console.error("Lỗi khi xử lý báo cáo:", err);
        return res.status(500).json({ message: "Lỗi server." });
    }
};


//Đánh dấu đã đọc báo cáo mà chưa xử lý
const markReportAsViewed = async (req, res) => {
    try {
        const { reportId } = req.params;

        if (!reportId) {
            return res.status(400).json({ message: "Thiếu reportId." });
        }

        const report = await Report.findById(reportId);

        if (!report) {
            return res.status(404).json({ message: "Không tìm thấy báo cáo." });
        }

        if (report.status !== "Pending") {
            return res.status(200).json({ message: "Báo cáo đã được xem hoặc xử lý trước đó." });
        }

        report.status = "Reviewed";
        await report.save();

        return res.json({ message: "Báo cáo đã được đánh dấu là đã xem." });
    } catch (err) {
        console.error("Lỗi khi đánh dấu báo cáo đã xem:", err);
        return res.status(500).json({ message: "Lỗi server." });
    }
};

module.exports = {
    reportPost, getReports, handleReports, markReportAsViewed
};
