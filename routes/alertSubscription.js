const { createAlertSubscription, getUserSubscriptions } = require("../controllers/alertSubscription");
const middlewareControllers = require("../controllers/middlewareControllers");
const { verifyToken } = require("../controllers/middlewareControllers");

const router = require("express").Router();

// Tạo subscription
router.post("/create", middlewareControllers.verifyToken, createAlertSubscription);
module.exports = router;