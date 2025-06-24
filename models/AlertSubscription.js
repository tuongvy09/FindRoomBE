const mongoose = require("mongoose");

const AlertSubscriptionSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        category: {
            type: String,
            enum: [
                "Căn hộ/chung cư",
                "Nhà ở",
                "Đất",
                "Văn phòng, mặt bằng kinh doanh",
                "phòng trọ",
            ],
            required: true,
        },
        transactionType: {
            type: String,
            enum: ["Cần thuê", "Cần mua"],
            required: true,
        },
        address: {
            province: { type: String },
            district: { type: String },
        },
        propertyDetails: {
            propertyCategory: { type: String },
            apartmentType: { type: String },
            bedroomCount: { type: String },
            bathroomCount: { type: String },
            floorCount: { type: Number },
            balconyDirection: { type: String },
            mainDoorDirection: { type: String },
            landDirection: { type: String },
        },
        legalContract: {
            type: String,
        },
        furnitureStatus: {
            type: String,
        },
        priceRange: {
            min: { type: Number },
            max: { type: Number },
        },
        areaRange: {
            min: { type: Number },
            max: { type: Number },
        },
        typeArea: {
            type: String,
            enum: ["m²", "hecta"],
            default: "m²",
        },
        features: {
            type: [String],
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        notifyMethod: {
            type: String,
            enum: ["email", "web", "both"],
            default: "web",
        },
        lastNotifiedAt: {
            type: Date,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("AlertSubscription", AlertSubscriptionSchema);
