const express = require('express');
const router = express.Router();
const newsController = require('../controllers/newsControllers');
const multer = require('multer');

// Cấu hình Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + '-' + file.originalname);
    },
  });
  
  const upload = multer({ storage: storage });

//get all news
router.get('/', newsController.getAllNews);
//get news by id
router.get('/:id', upload.single('imageUrl'), newsController.getNewsById);
//add new news
router.post('/', upload.single('imageUrl'), newsController.createNews); 
//update news
router.put('/:id', newsController.updateNews); 
//delete news
router.delete('/:id', newsController.deleteNews); 

module.exports = router;