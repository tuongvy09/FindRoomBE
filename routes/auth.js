const authController = require("../controllers/authControllers");
const middlewareControllers = require("../controllers/middlewareControllers");

const router = require("express").Router();

//register
router.post("/register", authController.registerUser);

//login
router.post("/login", authController.loginUser);

//refresh
router.post("/refresh", authController.requestRefreshToken);

//logout
router.post("/logout", middlewareControllers.verifyToken , authController.userLogout);

//login with gg
router.post("/google", authController.googleLogin);

// forgot password
router.post("/forgot-password", authController.forgotPassword);

//reset password
router.post("/reset-password", authController.resetPassword);

// Change password
router.post("/change-password", middlewareControllers.verifyToken, authController.changePassword);

module.exports = router;