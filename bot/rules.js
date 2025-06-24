// rules.js
module.exports = [
    {
        pattern: /xin chào|hello|hi/i,
        response: 'Xin chào! Tôi có thể giúp gì cho bạn?',
    },
    {
        pattern: /giờ làm việc|làm việc lúc nào/i,
        response: 'Chúng tôi làm việc từ 8h sáng đến 6h chiều, từ thứ 2 đến thứ 6.',
    },
    {
        pattern: /cảm ơn|thanks/i,
        response: 'Rất vui được giúp bạn!',
    },
    // Thêm rule khác nếu cần
];
