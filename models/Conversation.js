const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema({
    participants: [
        { type: mongoose.Schema.Types.ObjectId, ref: "User" }
    ],
    claimedByAdmin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message"
    },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    visible: { type: Boolean, default: true },
    adminStatus: {
        type: String,
        enum: ["pending", "processing", "done", null],
        default: "done",
    },
    isConversationSupport: { type: Boolean, default: false },
    updatedAt: { type: Date, default: Date.now }
});

const Conversation = mongoose.model("Conversation", ConversationSchema);
module.exports = Conversation;
