const Order = require("../models/Order");
const User = require("../models/User");

// Tạo đơn hàng mới
exports.createOrder = async (req, res) => {
  try {
    const { orderCode, amount, planId } = req.body;

    if (!orderCode || !amount || !planId) {
      return res.status(400).json({ error: "Thiếu thông tin đơn hàng" });
    }

    // Check trùng mã đơn hàng
    const existingOrder = await Order.findOne({ orderCode });
    if (existingOrder) {
      return res.status(400).json({ error: "Mã đơn hàng đã tồn tại" });
    }

    const order = await Order.create({
      orderCode,
      amount,
      planId,
      userId: req.user.id,
      expiredAt: new Date(Date.now() + 30 * 60 * 1000), // hết hạn sau 30 phút
    });

    res.status(201).json(order);
  } catch (err) {
    console.error("Create Order Error:", err);
    res.status(500).json({ error: "Tạo đơn hàng thất bại" });
  }
};

//nhận thông báo từ sepay: webhook
exports.sepayWebhook = async (req, res) => {
  const { description, transferAmount, transferType } = req.body;

  // Nếu là chuyển tiền vào tài khoản
  if (transferType === "in") {
    const rawDescription = req.body.description || "";
    const match = rawDescription.match(/g[oó]i\d{6}/i);
    const orderCode = match?.[0]?.toUpperCase();
    if (!orderCode) return res.status(400).send("Order code not found");

    const order = await Order.findOne({ orderCode });
    if (!order) return res.status(404).send("Order not found");

    order.status = "PAID";
    await order.save();

    const user = await User.findById(order.userId);
    if (!user) return res.status(404).send("User not found");

    const now = new Date();
    let updatedFields = { updatedAt: now };

    switch (order.planId) {
      case "free3post":
        updatedFields.postQuota = 3;
        updatedFields.quotaResetAt = now;
        updatedFields.plan = {};
        break;
      case "additional5post":
        updatedFields.postQuota = (user.postQuota || 0) + 5;
        updatedFields.plan = {
          name: "5post",
          expiredAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        };
        break;
      case "additionalunlimitedpost":
        updatedFields.postQuota = Infinity;
        updatedFields.plan = {
          name: "unlimited",
          expiredAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        };
        break;
    }

    await User.findByIdAndUpdate(user._id, updatedFields);
    return res.status(200).send("OK");
  }

  res.status(400).send("Invalid transfer type");
};