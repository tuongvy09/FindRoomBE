const { Server } = require("socket.io");
const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const mongoose = require("mongoose");
const { markConversationAsRead } = require("../controllers/chatController");
const { handleIncomingMessage, resolveConversation } = require("../bot/queues/autoReply.worker");
const { getOnlineAdmins } = require("../bot/filterOnlineAdmins");
require("dotenv").config();

let onlineUsers = {};
let io;

const botId = process.env.BOT_ID || null;
function initializeSocket(server) {
    io = new Server(server, {
        cors: {
            origin: ["http://localhost:3000"],
            methods: ["GET", "POST"]
        }
    });

    io.on("connection", (socket) => {
        const getOnlineUserIds = () => Object.keys(onlineUsers);

        socket.on("join", (userId) => {
            onlineUsers[userId] = socket.id;
            socket.join(userId);
            io.emit("onlineUsers", getOnlineUserIds());
        });


        socket.on("sendMessage", async ({ sender, receiver, content, postId, images, location }) => {
            try {
                console.log("Dữ liệu nhận được từ client:", { sender, receiver, content, postId });
                const senderId = typeof sender === 'object' ? sender._id : sender;
                const receiverId = typeof receiver === 'object' ? receiver._id : receiver;
                const participantsSorted = [senderId, receiverId].sort();

                let conversation = await Conversation.findOne({
                    participants: { $all: participantsSorted, $size: 2 },
                });

                if (!conversation) {
                    conversation = new Conversation({
                        participants: participantsSorted,
                        postId: postId || null,
                    });
                    await conversation.save();
                }

                const newMessage = new Message({
                    conversationId: conversation._id,
                    sender,
                    receiver,
                    content,
                    content: content || '',
                    images,
                    location: location || null,
                });
                await newMessage.save();

                conversation.lastMessage = newMessage._id;
                conversation.readBy = [sender];
                conversation.updatedAt = Date.now();
                await conversation.save();

                const unreadCount = await Conversation.countDocuments({
                    participants: receiverId,
                    readBy: { $ne: receiverId },
                });

                io.to(receiverId.toString()).emit("unreadConversationsCount", {
                    userId: receiverId,
                    count: unreadCount,
                });

                io.emit("receiveMessage", newMessage);
                const updatedConversation = await Conversation.findById(conversation._id)
                    .populate({
                        path: "participants",
                        select: "username profile.picture profile.isOnline",
                    })
                    .populate({
                        path: "lastMessage",
                    })
                    .populate({
                        path: "postId",
                        select: "images title rentalPrice typePrice",
                    });

                io.emit("updateConversations", {
                    userIds: [sender, receiver],
                    updatedConversation,
                });
            } catch (error) {
                console.error("Lỗi khi gửi tin nhắn:", error);
            }
        });

        socket.on('clientMessage', msg => {
            const onlineUsers = getOnlineUsers();
            handleIncomingMessage(io, socket.id, msg, onlineUsers);
        });

        socket.on("readConversation", async ({ conversationId, userId }) => {
            await markConversationAsRead(conversationId, userId, socket);
        });

        socket.on("claimConversation", async ({ conversationId, adminId }) => {
            try {
                if (!mongoose.Types.ObjectId.isValid(conversationId)) {
                    console.log("[claimConversation] conversationId không hợp lệ:", conversationId);
                    return;
                }

                const conversation = await Conversation.findById(mongoose.Types.ObjectId(conversationId));
                if (!conversation) {
                    console.log("[claimConversation] Conversation with id=" + conversationId + " not found.");
                    return;
                }

                if (conversation.claimedByAdmin) {
                    socket.emit("claimFailed", { message: "Conversation đã được claim bởi admin khác." });
                    return;
                }

                conversation.claimedByAdmin = adminId;
                conversation.adminStatus = "processing";
                await conversation.save();

                const claimedConversation = await Conversation.findById(conversationId)
                    .populate({
                        path: "participants",
                        select: "_id username email profile.picture profile.isOnline",
                        options: { strictPopulate: false }
                    })
                    .populate({
                        path: "lastMessage",
                        options: { strictPopulate: false }
                    })
                    .lean();

                socket.emit("claimSuccess", claimedConversation);

                const onlineUsers = getOnlineUsers();
                for (const [otherAdminId, adminSocketId] of Object.entries(onlineUsers)) {
                    if (otherAdminId !== adminId) {
                        const isAdmin = await getOnlineAdmins(otherAdminId);
                        if (isAdmin) {
                            io.to(adminSocketId).emit("conversationClaimed", { conversationId });
                        }
                    }
                }

            } catch (error) {
                console.error("Lỗi khi claim conversation:", error);
            }
        });

        socket.on("adminSendMessage", async ({ conversationId, adminId, content, images }) => {
            try {
                const conversation = await Conversation.findById(conversationId);
                if (!conversation) return;
                if (conversation.claimedByAdmin?.toString() !== adminId) {
                    socket.emit("sendMessageFailed", { message: "Bạn chưa claim conversation này." });
                    return;
                }
                const receiverId = conversation.participants.find(
                    id => id.toString() !== botId
                );

                const message = await Message.create({
                    conversationId,
                    sender: adminId,
                    receiver: receiverId,
                    content,
                    images,
                    timestamp: new Date(),
                });

                conversation.lastMessage = message._id;
                conversation.updatedAt = new Date();
                conversation.readBy = [adminId];
                await conversation.save();

                const receiverSocketId = getSocketIdByUserId(receiverId);
                if (receiverSocketId) {
                    io.to(receiverSocketId).emit("receiveMessage", message);
                }
                const updatedConversation = await Conversation.findById(conversation._id)
                    .populate({
                        path: "participants",
                        select: "username profile.picture profile.isOnline",
                    })
                    .populate({
                        path: "lastMessage",
                    });
                io.emit("updateConversationsAdmin", {
                    userIds: [adminId, receiverId],
                    updatedConversation,
                });
                io.to(adminId).emit("receiveMessageAdmin", message);

            } catch (err) {
                console.error("Lỗi khi admin gửi message:", err);
                socket.emit("sendMessageFailed", { message: "Có lỗi xảy ra khi gửi tin nhắn." });
            }
        });

        socket.on("resolveConversation", async ({ conversationId }) => {
            await resolveConversation(io, conversationId, socket);
        });

        socket.on("disconnect", () => {
            for (let userId in onlineUsers) {
                if (onlineUsers[userId] === socket.id) {
                    delete onlineUsers[userId];
                    break;
                }
            }
            io.emit("onlineUsers", getOnlineUserIds());
        });
    });
}

function getIO() {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
}

function getSocketIdByUserId(userId) {
    return onlineUsers[userId];
}

function getOnlineUsers() {
    return onlineUsers;
}

module.exports = { initializeSocket, onlineUsers, io: getIO, getOnlineUsers };