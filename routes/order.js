const router = require("express").Router();
const middlewareControllers = require("../controllers/middlewareControllers");
const { createOrder } = require("../controllers/orderControllers");

router.post("/", middlewareControllers.verifyToken, createOrder);

module.exports = router;