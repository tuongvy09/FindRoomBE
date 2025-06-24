const router = require("express").Router();
const middlewareControllers = require("../controllers/middlewareControllers");
const { getConversationsByUser, getMessagesByConversation, searchConversationsByUser, hideConversation, toggleConversationsVisibility, getFilteredConversations, getConversationsByAdmin, getMessagesWithBot, getUnclaimedConversations } = require("../controllers/chatController");
const { suggestQuestions } = require("../controllers/aiController");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");

router.get("/user/:userId", middlewareControllers.verifyToken, getConversationsByUser);
router.get("/chat/:conversationId", middlewareControllers.verifyToken, getMessagesByConversation);
router.get("/search/:userId", middlewareControllers.verifyToken, searchConversationsByUser);
router.patch("/visibility",middlewareControllers.verifyToken, toggleConversationsVisibility);
router.get("/filter/:userId", middlewareControllers.verifyToken, getFilteredConversations);
router.post('/suggest-questions',middlewareControllers.verifyToken, suggestQuestions);
router.get("/admin/listConversations/:adminId", middlewareControllers.verifyTokenAndAdminAuth, getConversationsByAdmin);
router.get("/user/messageswithBot/:userId", middlewareControllers.verifyToken, getMessagesWithBot);
router.get("/unclaimed", middlewareControllers.verifyTokenAndAdminAuth, getUnclaimedConversations);

//test
router.delete("/:id", async (req, res) => {
    const conversationId = req.params.id;

    try {
        // Kiểm tra đoạn hội thoại tồn tại
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }

        // Xóa tất cả tin nhắn thuộc đoạn hội thoại này
        await Message.deleteMany({ conversationId });

        // Xóa đoạn hội thoại
        await Conversation.findByIdAndDelete(conversationId);

        return res.status(200).json({ message: "Conversation and related messages deleted successfully" });
    } catch (error) {
        console.error("Delete conversation error:", error);
        return res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;