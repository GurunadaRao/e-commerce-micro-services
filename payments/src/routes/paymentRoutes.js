const express = require("express");
const PaymentController = require("../controllers/paymentController");
const isAuthenticated = require("../middlewares/authMiddleware");

const router = express.Router();
const ctrl = new PaymentController();

router.post("/pay", isAuthenticated, ctrl.createPayment);
router.get("/order/:orderId", isAuthenticated, ctrl.getPaymentsByOrder);
router.get("/:paymentId", isAuthenticated, ctrl.getPayment);
router.post("/:paymentId/refund", isAuthenticated, ctrl.refundPayment);

module.exports = router;
