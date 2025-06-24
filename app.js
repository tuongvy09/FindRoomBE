const mongoose = require('mongoose');
const express = require('express');
const cors = require("cors");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const authRoute = require("./routes/auth");
const userRoute = require("./routes/user");
const postRoute = require("./routes/post");
const newsRoutes = require("./routes/news");
const reviewRoutes = require("./routes/review");
const conversationRoutes = require("./routes/chat");
const uploadRoutes = require('./routes/upload');
const webhookRoutes = require("./routes/webhook");
const orderRoutes = require("./routes/order");
const reportRoutes = require("./routes/reportRoutes");
const forumRoutes = require("./routes/forum");
const alertSubscription = require("./routes/alertSubscription");
const http = require('http');
const { initializeSocket } = require("./congfig/websocket");
require('./congfig/cronJobs');
const subscriptionRoutes = require("./routes/subscription");
const paymentRoutes = require("./routes/payment");
const SubscriptionService = require('./services/subscriptionService');
const userSubscription = require("./routes/userSubscription");

SubscriptionService.initCronJobs();

dotenv.config();
const app = express();
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3001"],
  credentials: true
}));
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

// Cấu hình Express để phục vụ tệp từ thư mục 'uploads'
app.use('/uploads', express.static('uploads'));

app.use(cookieParser());

app.post("/api/webhook/momo", async (req, res) => {
  const { transId, amount, note, status } = req.body;

  if (status === "success" && note) {
    console.log("Nhận được thanh toán:", req.body);

    // Ví dụ tìm đơn hàng theo nội dung chuyển khoản
    const order = await Order.findOne({ where: { orderCode: note } });

    if (order && !order.paid) {
      order.paid = true;
      order.paidAt = new Date();
      await order.save();
    }
  }

  res.status(200).send("OK");
});

mongoose.connect(process.env.MONGODB_URL, { useNewUrlParser: true, useUnifiedTopology: true })
.then(() =>
  console.log('Connected to MongoDB...'))
.catch(err => console.error('Could not connect to MongoDB...', err));

//ROUTE
app.use("/v1/auth", authRoute);
app.use("/v1/user", userRoute);
app.use('/v1/posts', postRoute);
app.use('/v1/news', newsRoutes);
app.use('/v1/reviews', reviewRoutes);
app.use("/v1/conversations", conversationRoutes);
app.use("/v1/upload", uploadRoutes);
app.use("/v1/webhook", webhookRoutes);
app.use("/v1/orders", orderRoutes);
app.use("/v1/report", reportRoutes);
app.use('/v1/forum', forumRoutes);
app.use('/v1/alertSubscription', alertSubscription);
app.use("/v1/subscriptions", subscriptionRoutes);
app.use("/v1/payments", paymentRoutes);
app.use('/v1/subscriptions', userSubscription);

const server = http.createServer(app);
initializeSocket(server);

server.listen(8000, () => {
  console.log("Server is running")
});