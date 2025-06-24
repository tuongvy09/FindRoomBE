const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation" },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    content: String,
    images: {
        type: [String],
        default: [],
    },
    location: {
        latitude: Number,
        longitude: Number
    },
    timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model("Message", MessageSchema);
module.exports = Message;
