const nodemailer = require('nodemailer');

// Tạo transporter với thông tin cấu hình
const transporter = nodemailer.createTransport({
  service: 'Gmail', // hoặc dùng SMTP của dịch vụ khác
  auth: {
    user: process.env.EMAIL_USER, // email bạn sẽ dùng để gửi mã
    pass: process.env.EMAIL_PASS,// mật khẩu hoặc mã ứng dụng của email
  },
});

// Hàm gửi email
const sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: '"Phòng trọ xinh" <nguyenanhtuyet03.nbk@gmail.com>', // Tên người gửi
      to, // Email người nhận
      subject, // Chủ đề email
      html,
    });
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

module.exports = sendEmail;
