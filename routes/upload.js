const express = require('express');
const uploadCloud = require('../congfig/cloudinaryConfig');
const router = express.Router();

// Hỗ trợ tải lên nhiều ảnh
router.post('/upload-image', uploadCloud.array('images', 10), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    // Trả về danh sách đường dẫn ảnh
    const imageUrls = req.files.map(file => file.path);  // Lấy đường dẫn của mỗi ảnh đã upload lên Cloudinary
    res.status(200).json({
        success: true,
        imageUrls: imageUrls, // Danh sách đường dẫn ảnh
    });
});

module.exports = router;
