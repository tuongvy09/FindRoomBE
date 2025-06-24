
const News = require('../models/News');

// Lấy tất cả bài viết
exports.getAllNews = async (req, res) => {
  try {
    const news = await News.find();
    res.status(200).json(news);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// Lấy một bài viết
exports.getNewsById = async (req, res) => {
  try {
    let news = await News.findByIdAndUpdate(req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    );
    if (!news) return res.status(404).json({ message: 'Không tìm thấy bài viết' });
    console.log("views", news.views);
    res.status(200).json(news);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Tạo bài viết mới
exports.createNews = async (req, res) => {
  const { title, description, content, author } = req.body;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  // Kiểm tra từng trường và trả lỗi cụ thể
  if (!title || title.trim() === "") {
    return res.status(400).json({ message: "Tiêu đề không được để trống!" });
  }
  if (!description || description.trim() === "" || description.length < 10) {
    return res
      .status(400)
      .json({ message: "Mô tả phải có ít nhất 10 ký tự!" });
  }
  if (!content || content.trim() === "" || content.length < 200) {
    return res
      .status(400)
      .json({ message: "Nội dung phải có ít nhất 200 ký tự!" });
  }
  if (!author || author.trim() === "") {
    return res.status(400).json({ message: "Tác giả không được để trống!" });
  }

  try {
    // Tạo bài viết mới sau khi các kiểm tra đã thành công
    const newNews = new News({ title, description, content, author, imageUrl });
    await newNews.save();
    res.status(201).json(newNews);
  } catch (error) {
    // Xử lý lỗi từ cơ sở dữ liệu hoặc các lỗi không xác định khác
    res.status(500).json({ message: "Lỗi hệ thống. Vui lòng thử lại sau!" });
  }
};

// Cập nhật bài viết
exports.updateNews = async (req, res) => {
  const { title, description, content, author} = req.body; 
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : req.body.imageUrl; // Cập nhật URL nếu có tệp mới

  try {
    const news = await News.findByIdAndUpdate(
      req.params.id,
      { title, description, content, author, imageUrl },
      { new: true }
    );
    if (!news) return res.status(404).json({ message: 'Không tìm thấy bài viết' });
    res.status(200).json(news);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Xóa bài viết
exports.deleteNews = async (req, res) => {
  try {
    const news = await News.findByIdAndDelete(req.params.id);
    if (!news) return res.status(404).json({ message: 'Không tìm thấy bài viết' });
    res.status(200).json({ message: 'Xóa thành công' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};