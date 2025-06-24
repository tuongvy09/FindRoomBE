const userController = require("../controllers/userControllers");
const middlewareControllers = require("../controllers/middlewareControllers");
const uploadCloud = require('../congfig/cloudinaryConfig'); 


const router = require("express").Router();

//get all users
router.get("/", middlewareControllers.verifyToken, userController.getAllUsers);

//get user by id
router.get("/profile", middlewareControllers.verifyToken, userController.getUserProfile);

//delete user
router.delete("/:id", middlewareControllers.verifyTokenAndAdminAuth, userController.deleteUser);

//update user profile
router.put("/update-profile/:id", middlewareControllers.verifyToken, uploadCloud.single('picture'), userController.updateUserProfile);

//khóa/mở khóa tài khoản
router.put("/block/:id", middlewareControllers.verifyTokenAndAdminAuth, userController.toggleBlockUser);

//lấy all noti
router.get("/notifications", middlewareControllers.verifyToken, userController.getNotificationsByUser);

//đánh dấu thông báo là đã đọc
router.put('/notifications/:notificationId', middlewareControllers.verifyToken, userController.markNotificationAsRead);

//xem bài post
router.post('/view-posts/:postId/:userId', middlewareControllers.verifyToken, userController.viewPost);

router.get('/get-viewed-posts/:userId/', middlewareControllers.verifyToken, userController.getViewedPosts);

module.exports = router;