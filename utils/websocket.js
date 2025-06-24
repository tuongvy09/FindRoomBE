const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 }); 

let clients = [];

// Lưu trữ các kết nối WebSocket của người dùng
wss.on('connection', (ws) => {
    console.log('A new client connected');
    
    // Lưu client vào danh sách khi kết nối
    clients.push(ws);
    
    // Xử lý khi client đóng kết nối
    ws.on('close', () => {
        console.log('A client disconnected');
        clients = clients.filter(client => client !== ws);
    });
});

// Hàm gửi thông báo đến một client qua WebSocket
const sendToUser = (userId, message) => {
    // Tìm client của người dùng theo userId (có thể lưu trữ thêm thông tin userId vào mỗi WebSocket client)
    for (let client of clients) {
        if (client.userId === userId) {
            client.send(message);  // Gửi thông báo tới client
            console.log(`Notification sent to user ${userId}`);
            return;
        }
    }
    console.log(`No client found for user ${userId}`);
};

// Lưu trữ userId vào WebSocket để nhận diện mỗi client
const storeUserId = (ws, userId) => {
    ws.userId = userId;
};

module.exports = {
    sendToUser,
    storeUserId
};