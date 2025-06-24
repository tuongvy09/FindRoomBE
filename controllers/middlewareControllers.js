const jwt = require("jsonwebtoken");
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User'); // THÊM IMPORT USER MODEL

const client_id = '542714924408-kun6tfccnlcit4k9ono82oue7vqhth70.apps.googleusercontent.com';
const client = new OAuth2Client(client_id);

const middlewareControllers = {
    verifyToken: async (req, res, next) => {
        const authHeader = req.headers.authorization;
        
        if (authHeader) {
            const accessToken = authHeader.split(" ")[1];

            jwt.verify(accessToken, process.env.JWT_ACCESS_KEY, async (err, decoded) => {
                if (err) {
                    if (err.name === "TokenExpiredError") {
                        console.error("JWT expired: ", err);
                        return res.status(401).json("Token has expired");
                    } else if (err.name === "JsonWebTokenError") {
                        return res.status(403).json("Token is not valid");
                    } else {
                        console.error("JWT verification error: ", err);
                        return res.status(403).json("Token verification failed");
                    }
                }

                try {                    
                    const user = await User.findById(decoded.id)
                        .select('username email profile admin name'); 
                    
                    if (!user) {
                        return res.status(401).json({
                            success: false,
                            message: 'User không tồn tại'
                        });
                    }

                    req.user = {
                        id: user._id,
                        username: user.username,
                        email: user.email,
                        name: user.name,
                        profile: user.profile,
                        admin: user.admin || decoded.admin
                    };

                    next();
                } catch (dbError) {
                    return res.status(500).json({
                        success: false,
                        message: 'Lỗi server khi lấy thông tin user'
                    });
                }
            });
        } else {
            return res.status(401).json("You're not authenticated");
        }
    },

    verifyTokenAndAdminAuth: (req, res, next) => {
        middlewareControllers.verifyToken(req, res, () => {
            console.log("User after token verification:", req.user);
            if (req.user.id === req.params.id || req.user.admin) {
                next();  
            } else {
                console.error("Access denied: Not an admin or not the same user");
                return res.status(403).json("You're not allowed to perform this action");
            }
        });
    },

    checkQuota: async (req, res, next) => {
        const user = await User.findById(req.user.id);
        
        const now = new Date();
        const resetTime = new Date(user.quotaResetAt);
      
        // Reset mỗi tháng 1 lần
        if (now.getMonth() !== resetTime.getMonth() || now.getFullYear() !== resetTime.getFullYear()) {
            user.postQuota = 3; // reset quota về 3 tin miễn phí
            user.quotaResetAt = now;
            await user.save();
        }
      
        if (user.postQuota > 0 || (user.plan && user.planExpiredAt > now)) {
            return next(); // Cho phép đăng tin
        }
      
        // Hết quota và không có gói
        return res.status(403).json({ 
            message: "Bạn đã hết lượt đăng tin miễn phí. Vui lòng mua gói để tiếp tục." 
        });
    },
};

module.exports = middlewareControllers;