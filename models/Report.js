const mongoose = require("mongoose");

const ReportSchema = new mongoose.Schema({
    post: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post",
        required: true
    },
    reporter: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        phone: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true
        }
    },
    reason: {
        type: String,
        required: true,
        enum: [
            "Lừa đảo",
            "Trùng lặp",
            "Bất động sản đã bán",
            "Không liên lạc được",
            "Thông tin Bất động sản không đúng thực tế",
            "Thông tin người đăng không đúng thực tế",
            "Lý do khác"
        ]
    },
    note: {
        type: String,
        default: ""
    },
    status: {
        type: String,
        enum: ["Pending", "Reviewed", "Resolved"],
        default: "Pending"
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Report = mongoose.model("Report", ReportSchema);
module.exports = Report;
