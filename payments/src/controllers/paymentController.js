const PaymentService = require("../services/paymentService");
const messageBroker = require("../utils/messageBroker");

class PaymentController {
  constructor() {
    this.paymentService = new PaymentService(messageBroker);
    this.createPayment = this.createPayment.bind(this);
    this.getPayment = this.getPayment.bind(this);
    this.getPaymentsByOrder = this.getPaymentsByOrder.bind(this);
    this.refundPayment = this.refundPayment.bind(this);
  }

  async createPayment(req, res) {
    try {
      const payment = await this.paymentService.processPayment({
        ...req.body,
        userId: req.user.id,
        idempotencyKey: req.header("Idempotency-Key") || req.body.idempotencyKey,
      });

      res.status(201).json({ success: true, payment });
    } catch (err) {
      this.handleError(err, res);
    }
  }

  async getPayment(req, res) {
    try {
      const payment = await this.paymentService.getPayment(
        req.params.paymentId,
        req.user.id,
      );

      res.status(200).json({ payment });
    } catch (err) {
      this.handleError(err, res);
    }
  }

  async getPaymentsByOrder(req, res) {
    try {
      const payments = await this.paymentService.getPaymentsByOrder(
        req.params.orderId,
        req.user.id,
      );

      res.status(200).json({ payments });
    } catch (err) {
      this.handleError(err, res);
    }
  }

  async refundPayment(req, res) {
    try {
      const payment = await this.paymentService.refundPayment(
        req.params.paymentId,
        req.user.id,
      );

      res.status(200).json({ success: true, payment });
    } catch (err) {
      this.handleError(err, res);
    }
  }

  handleError(err, res) {
    const statusCode = err.statusCode || 500;
    if (statusCode === 500) {
      console.error(err);
    }

    res.status(statusCode).json({ message: err.message || "Server error" });
  }
}

module.exports = PaymentController;
