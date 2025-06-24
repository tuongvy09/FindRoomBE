// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } 
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Không có quyền truy cập'
    });
  }

  try {
    // Thay JWT_SECRET bằng JWT_ACCESS_KEY để thống nhất
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_KEY);

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Không tìm thấy người dùng với token này'
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.log("JWT Verification Error:", err.message);  // Thêm log để debug
    return res.status(401).json({
      success: false,
      message: 'Token không hợp lệ'
    });
  }
};