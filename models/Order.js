const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    orderCode: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["PENDING", "PAID", "EXPIRED"],
      default: "PENDING"
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    planId: {
      type: String,
      required: true,
      enum: ["free3post", "additional5post", "additionalunlimitedpost"]
    },
    expiredAt: {
      type: Date, // dùng để xác định khi nào hết hạn thanh toán (ví dụ 30 phút)
    },
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;