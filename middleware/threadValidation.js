// middleware/threadValidation.js
const { check } = require('express-validator');
const { body } = require('express-validator');

exports.validateThread = [
  check('title')
    .trim()
    .not()
    .isEmpty()
    .withMessage('Tiêu đề là bắt buộc')
    .isLength({ max: 200 })
    .withMessage('Tiêu đề không được vượt quá 200 ký tự'),
  
  check('content')
    .trim()
    .not()
    .isEmpty()
    .withMessage('Nội dung là bắt buộc'),
  
  check('tags')
    .optional()
    .isArray()
    .withMessage('Tags phải là một mảng')
    .custom((tags) => {
      if (tags && tags.length > 5) {
        throw new Error('Không được thêm quá 5 tags');
      }
      return true;
    }),
body('title')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Tiêu đề không được vượt quá 200 ký tự'),
    
  body('content')
    .notEmpty()
    .withMessage('Nội dung bài viết là bắt buộc')
    .trim()
    .isLength({ min: 10 })
    .withMessage('Nội dung phải có ít nhất 10 ký tự'),
    
  body('tags')
    .optional()
    .isArray({ max: 10 })
    .withMessage('Tối đa 10 tags')
];

exports.validateComment = [
  body('content')
    .notEmpty()
    .withMessage('Nội dung bình luận là bắt buộc')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Bình luận phải có từ 1-1000 ký tự'),
    
  body('parentCommentId')
    .optional()
    .isMongoId()
    .withMessage('ID bình luận gốc không hợp lệ')
];