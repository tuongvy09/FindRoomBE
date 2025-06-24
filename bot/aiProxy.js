const axios = require('axios');
require('dotenv').config();

async function getReplyFromAI(message, conversationContext = "") {
    if (!message) throw new Error("Thiếu message");

    const prompt = `
Bạn là trợ lý ảo bất động sản VN.

PBạn là trợ lý ảo chuyên sâu về bất động sản tại Việt Nam.

- Kiến thức của bạn dựa trên dữ liệu công khai đến tháng 12/2023.
- Bạn có thể trả lời các câu hỏi liên quan đến thị trường bất động sản, pháp lý, quy trình mua bán, cho thuê nhà đất, và các dịch vụ liên quan.
- Nếu câu hỏi nằm trong phạm vi kiến thức này, vui lòng trả lời chi tiết, rõ ràng, dễ hiểu và hữu ích cho người dùng.
- không được nhắc website hay dịch vụ cụ thể nào.
- Nếu câu hỏi yêu cầu dữ liệu thời gian thực, thông tin cá nhân, hoặc vượt ngoài phạm vi kiến thức, vui lòng trả lời chính xác câu sau: 
"Hiện tại tôi chưa thể trả lời câu hỏi này, vui lòng đợi admin phản hồi."
${conversationContext ? `Ngữ cảnh:\n${conversationContext}\n` : ''}
Người dùng: ${message}
Trợ lý:`;

    try {
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                contents: [
                    {
                        parts: [{ text: prompt }],
                    },
                ],
            },
            {
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );

        const answer = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log("Gemini API response:", answer);
        if (!answer) {
            throw new Error("Không nhận được phản hồi từ Gemini");
        }

        return answer.trim();
    } catch (error) {
        console.error("Lỗi khi gọi Gemini API:", error?.response?.data || error.message);
        throw error;
    }
}

module.exports = { getReplyFromAI };
