const axios = require("axios");
require("dotenv").config();
const Post = require('../models/Post');

const suggestQuestions = async (req, res) => {
    const { postContent } = req.body;

    const prompt = `
    Dựa trên nội dung sau đây của một bài đăng tìm phòng trọ, hãy gợi ý 5 câu hỏi mà người dùng có thể sẽ muốn hỏi trước khi thuê trọ:

    Nội dung bài đăng: """${postContent}"""

    Trả lời bằng danh sách các câu hỏi dạng gạch đầu dòng, không cần chú thích câu hỏi bằng dấu ngoặc.
    `;

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

        const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            return res.status(500).json({ error: "Không nhận được phản hồi từ Gemini" });
        }

        res.json({ questions: text });
    } catch (error) {
        console.error("Lỗi khi gọi Gemini API:", error?.response?.data || error.message);
        res.status(500).json({ error: "Lỗi khi gọi Gemini API" });
    }
};

const checkPostModeration = async (post) => {
    const moderationPrompt = `Bạn là một hệ thống kiểm duyệt nội dung bất động sản. Hãy đánh giá bài đăng sau theo các quy tắc sau:
    
    1. Không được chứa ngôn từ thù ghét, phân biệt chủng tộc, khiêu dâm.
    2. Không được có nội dung spam, lặp lại vô nghĩa.
    3. Không được chứa quảng cáo trá hình (spam link, nội dung không liên quan đến bất động sản).
    
    **Yêu cầu phản hồi theo đúng định dạng sau:**
    Nhãn: OK | Cần kiểm duyệt | Từ chối  
    Lý do: <nêu rõ lý do nếu nhãn là "Từ chối", nếu không thì ghi "Không có">
    
  **Thông tin bài đăng:**
    - Tiêu đề: ${post.title}
    - Nội dung: ${post.content}
    `;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: moderationPrompt }] }],
                }),
            }
        );

        const data = await response.json();
        const resultText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!resultText) {
            return { status: 'pending', reason: 'Không có phản hồi từ AI' };
        }

        const labelMatch = resultText.match(/Nhãn:\s*(.*)/);
        const reasonMatch = resultText.match(/Lý do:\s*(.*)/);

        const label = labelMatch?.[1]?.trim();
        const reason = reasonMatch?.[1]?.trim() || 'Không có';

        if (label === 'OK') {
            return { status: 'approved', reason: null };
        } else if (label === 'Cần kiểm duyệt') {
            return { status: 'pending', reason: null };
        } else if (label === 'Từ chối') {
            return { status: 'rejected', reason };
        } else {
            return { status: 'pending', reason: 'Phản hồi không hợp lệ từ AI' };
        }
    } catch (error) {
        console.error('Lỗi kiểm duyệt AI:', error);
        return { status: 'pending', reason: 'Lỗi hệ thống kiểm duyệt' };
    }
};

const requestThreadApproval = async (title, content) => {
    if (!title || !content) {
        throw new Error("Thiếu tiêu đề hoặc nội dung bài viết");
    }

    const prompt = `
Bạn là một quản trị viên diễn đàn. Dưới đây là một bài viết mới gồm tiêu đề và nội dung. Hãy đánh giá xem bài viết có nên được duyệt hay không.

Tiêu đề: """${title}"""
Nội dung: """${content}"""

Chỉ trả lời bằng một từ duy nhất:
- Nếu **duyệt**, trả lời: duyệt
- Nếu **không duyệt**, trả lời: không duyệt

Không thêm bất kỳ lời giải thích hay định dạng nào khác.
    `.trim();

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
                headers: { "Content-Type": "application/json" },
            }
        );

        const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.toLowerCase().trim();

        if (!rawText) {
            throw new Error("Không nhận được phản hồi từ AI");
        }

        if (rawText === "duyệt") {
            return {
                approve: true,
                reason: "Hệ thống đánh giá bài viết hợp lệ và đã được duyệt."
            };
        }

        if (rawText === "không duyệt") {
            return {
                approve: false,
                reason: "Hệ thống đánh giá bài viết không đủ điều kiện để được duyệt."
            };
        }

        throw new Error(`Phản hồi không hợp lệ từ AI: "${rawText}"`);

    } catch (error) {
        console.error("Lỗi khi gọi Gemini API hoặc xử lý dữ liệu:", error.message);
        throw error;
    }
};

module.exports = {
    suggestQuestions,
    checkPostModeration,
    requestThreadApproval,
};