const User = require("../models/User");

let ADMIN_IDS = [];

async function getAllAdminIds() {
    const admins = await User.find({ admin: "true" }).select("_id");
    ADMIN_IDS = admins.map(a => a._id.toString());
}
getAllAdminIds();

function getOnlineAdmins(onlineUsers) {
    const onlineAdminIds = ADMIN_IDS.filter(adminId => onlineUsers.hasOwnProperty(adminId));
    return onlineAdminIds;
}

module.exports = { getOnlineAdmins };
