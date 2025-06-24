const postController = require("../controllers/postControllers");
const uploadCloud = require('../congfig/cloudinaryConfig');
const middlewareControllers = require("../controllers/middlewareControllers");
const { checkPostModeration } = require("../controllers/aiController");
const router = require("express").Router();

// Lấy tất cả bài đăng
router.get("/posts", middlewareControllers.verifyTokenAndAdminAuth, postController.getAllPosts);

//lấy bài đăng cho ss giá
router.get('/district-coordinates', postController.getDistrictCoordinatesByCity);

//lấy data cho compare chart
router.get('/compare-chart', postController.getCompareChartData);

//Lấy bài đăng theo trạng thái của admin
router.get("/list-pending", middlewareControllers.verifyTokenAndAdminAuth, postController.getUserPostAd);

// Lấy bài đăng theo ID
router.get("/posts/:id", postController.getPostById);

// Tạo bài đăng mới (cần xác thực)
router.post("/", middlewareControllers.verifyToken, uploadCloud.fields([{ name: 'images', maxCount: 10 }, { name: 'videoUrl', maxCount: 1 }]), postController.createPost);
router.put("/posts/:id", middlewareControllers.verifyToken, postController.updatePost);

// Xóa bài đăng (cần xác thực)
router.delete("/posts/:id", middlewareControllers.verifyToken, postController.deletePost);
//
router.get('/user-posts/:userId', middlewareControllers.verifyTokenAndAdminAuth, postController.getUserPostsByUserId);

//Lấy bài đăng theo status
router.get('/posts-by-status', postController.getPostsByStatus);
router.get('/list-post-pending', middlewareControllers.verifyToken, postController.getUserPostsByStateAndVisibility);

// Route cập nhật bài đăng
router.put('/update/:postId', middlewareControllers.verifyToken, postController.updatePost);

// Route ẩn/hiện bài đăng
router.put('/toggle-visibility/:postId', middlewareControllers.verifyToken, postController.toggleVisibility);
router.put('/:id/approve', middlewareControllers.verifyTokenAndAdminAuth, postController.approvePost);

// Route cho từ chối bài
router.put('/:id/reject', middlewareControllers.verifyTokenAndAdminAuth, postController.rejectPost);

//Route ẩn bài đăng của admin
router.put('/:id/hidden', middlewareControllers.verifyTokenAndAdminAuth, postController.hiddenPost);

//Route hiện bài đăng của admin
router.put('/:id/visible', middlewareControllers.verifyTokenAndAdminAuth, postController.visiblePost);

// Route tìm kiếm bài đăng
router.get('/search', postController.searchPosts);

// Route thống kê số lượng bài đăng theo ngày
router.get('/by-date', middlewareControllers.verifyTokenAndAdminAuth, postController.getPostCountByDateRange);

// Route thống kê 7 loại hình cho thuê nhiều bài đăng nhất
router.get('/top-categories', middlewareControllers.verifyTokenAndAdminAuth, postController.getTopCategories);

// Route thống kê 7 tỉnh/thành phố nhiều bài đăng nhất
router.get('/top-provinces', middlewareControllers.verifyTokenAndAdminAuth, postController.getTopProvinces);

//Route thêm post vào yêu thích
router.post('/:id/favorite', middlewareControllers.verifyToken, postController.addToFavorites);

//Route xóa post khỏi yêu thích
router.delete('/:id/favorite', middlewareControllers.verifyToken, postController.removeFromFavorites);

//Route lấy danh sách yêu thích 
router.get('/favorites', middlewareControllers.verifyToken, postController.getFavorites);

//Route cập nhật số ngày hiển thị tất cả bài post trên trang chủ
router.put('/update-default-days', middlewareControllers.verifyTokenAndAdminAuth, postController.updateDefaultDaysToShow);

//test route ai kiểm duyệt 
router.post('/moderate-test', async (req, res) => {
    try {
        const post = req.body; // Lấy dữ liệu bài đăng từ body
        const status = await checkPostModeration(post); // Gọi hàm kiểm duyệt
        res.json({ status }); // Trả về kết quả
    } catch (error) {
        console.error('Lỗi khi test kiểm duyệt:', error);
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});

router.get('/suggestions/:postId', middlewareControllers.verifyToken, postController.getSuggestedPosts);
//điếm số bài viết ở 5 tỉnh thành
router.get("/count-by-city", postController.countPostsByCity);
module.exports = router;