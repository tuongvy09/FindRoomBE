const express = require('express');
const router = express.Router();
const middlewareControllers = require("../controllers/middlewareControllers");
const { sepayWebhook } = require("../controllers/orderControllers");

router.post("/sepay", sepayWebhook);

module.exports = router;