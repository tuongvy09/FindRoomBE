const express = require("express");
const router = express.Router();
const { reportPost, getReports, handleReports, markReportAsViewed } = require("../controllers/reportController");
const middlewareControllers = require("../controllers/middlewareControllers");

// Route nhận báo cáo bài viết
router.post("/", middlewareControllers.verifyToken, reportPost);

// Route lấy danh sách báo cáo có filter, search
router.get("/report-list", middlewareControllers.verifyTokenAndAdminAuth, getReports);
// Xử lý báo cáo
router.post("/handle-report", middlewareControllers.verifyTokenAndAdminAuth, handleReports );
// Đánh dấu đã đọc nhưng chưa xử lý
router.patch("/mark-as-viewed/:reportId", middlewareControllers.verifyTokenAndAdminAuth, markReportAsViewed);

module.exports = router;
