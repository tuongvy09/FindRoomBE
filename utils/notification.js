const { sendToUser } = require('./websocket');

// Hoặc nếu bạn muốn gửi email, bạn có thể dùng thư viện như nodemailer
const nodemailer = require('nodemailer');

// Hàm gửi thông báo cho người dùng
const sendNotification = async (userId, message) => {
    try {
        // Giả sử bạn đã có một cơ chế để lấy người dùng theo ID (ví dụ: từ database)
        const user = await User.findById(userId);

        if (!user) {
            console.error('User not found');
            return;
        }

        // Gửi thông báo qua WebSocket (hoặc cơ chế khác)
        sendToUser(userId, message);

        // Nếu bạn muốn gửi email thông báo cho người dùng
        await sendEmailNotification(user.email, message);
        console.log('Notification sent to user', userId);
    } catch (error) {
        console.error('Error sending notification:', error.message);
    }
};

// Hàm gửi email thông báo (ví dụ với nodemailer)
const sendEmailNotification = async (email, message) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'your-email@gmail.com',
            pass: 'your-email-password',
        },
    });

    const mailOptions = {
        from: 'your-email@gmail.com',
        to: email,
        subject: 'Bạn có một thông báo mới',
        text: message,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Email notification sent');
    } catch (error) {
        console.error('Error sending email:', error.message);
    }
};

module.exports = {
    sendNotification,
};