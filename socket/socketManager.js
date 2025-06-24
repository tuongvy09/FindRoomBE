// socket/socketManager.js
const socketIo = require('socket.io');

class SocketManager {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); 
  }

  initialize(server) {
    this.io = socketIo(server, {
      cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    this.io.on('connection', (socket) => {
      console.log('🔌 New socket connection:', socket.id);

      // Handle user join
      socket.on('join', (userId) => {
        console.log(`👤 User ${userId} joined socket room: user_${userId}`);
        socket.join(`user_${userId}`);
        this.connectedUsers.set(userId, socket.id);
        
        // Debug: List all rooms this socket is in
        console.log('🏠 Socket rooms:', Array.from(socket.rooms));
        
        // Send online status
        socket.broadcast.emit('userOnline', userId);
      });

      // Handle user disconnect
      socket.on('disconnect', () => {
        console.log('❌ Socket disconnected:', socket.id);
        
        // Find and remove user from connected users
        for (const [userId, socketId] of this.connectedUsers.entries()) {
          if (socketId === socket.id) {
            this.connectedUsers.delete(userId);
            socket.broadcast.emit('userOffline', userId);
            console.log(`👤 User ${userId} removed from connected users`);
            break;
          }
        }
      });

      // Forum specific events
      socket.on('joinThread', (threadId) => {
        socket.join(`thread_${threadId}`);
        console.log(`🏛️ Socket joined thread room: thread_${threadId}`);
      });

      socket.on('leaveThread', (threadId) => {
        socket.leave(`thread_${threadId}`);
        console.log(`🚪 Socket left thread room: thread_${threadId}`);
      });
    });

    return this.io;
  }

  getIO() {
    return this.io;
  }

  // Send notification to specific user
  sendToUser(userId, event, data) {
    if (this.io) {
      const roomName = `user_${userId}`;
      console.log(`📤 Sending event '${event}' to room '${roomName}'`);
      console.log('📦 Event data:', data);
      
      // Check if room exists and has clients
      const room = this.io.sockets.adapter.rooms.get(roomName);
      if (room && room.size > 0) {
        console.log(`✅ Room '${roomName}' has ${room.size} client(s)`);
        this.io.to(roomName).emit(event, data);
      } else {
        console.log(`⚠️ Room '${roomName}' is empty or doesn't exist`);
      }
    } else {
      console.log('❌ Socket.IO not initialized');
    }
  }

  // Send to all users in a thread
  sendToThread(threadId, event, data) {
    if (this.io) {
      const roomName = `thread_${threadId}`;
      console.log(`📤 Sending event '${event}' to thread room '${roomName}'`);
      this.io.to(roomName).emit(event, data);
    }
  }

  // Check if user is online
  isUserOnline(userId) {
    return this.connectedUsers.has(userId);
  }

  // Debug method to list all rooms
  listAllRooms() {
    if (this.io) {
      const rooms = this.io.sockets.adapter.rooms;
      console.log('🏠 All active rooms:');
      rooms.forEach((sockets, roomName) => {
        console.log(`   Room: ${roomName}, Clients: ${sockets.size}`);
      });
    }
  }
}

// Singleton instance
const socketManager = new SocketManager();

module.exports = socketManager;