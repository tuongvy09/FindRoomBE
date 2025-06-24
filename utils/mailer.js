const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,  // Tài khoản Gmail của bạn
    pass: process.env.EMAIL_PASS,  // Mật khẩu ứng dụng (App Password) hoặc mật khẩu tài khoản Gmail
  },
});

const sendEmail = async (to, subject, text) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER, // Địa chỉ email gửi
      to: to, // Địa chỉ email nhận
      subject: subject,
      text: text, // Nội dung email
    });
    console.log("Email sent successfully!");
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

module.exports = sendEmail;