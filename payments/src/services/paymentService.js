const crypto = require("crypto");
const Payment = require("../models/payment");
const config = require("../config");

class PaymentService {
  constructor(messageBroker) {
    this.messageBroker = messageBroker;
  }

  async processPayment(payload) {
    const data = this.normalizePayload(payload);
    this.validatePayment(data);

    const existingPayment = await Payment.findOne({
      idempotencyKey: data.idempotencyKey,
    });

    if (existingPayment) {
      return existingPayment;
    }

    const payment = await Payment.create({
      orderId: data.orderId,
      userId: data.userId,
      amount: data.amount,
      currency: data.currency,
      method: data.method,
      idempotencyKey: data.idempotencyKey,
      metadata: data.metadata,
      status: "pending",
    });

    try {
      const providerReference = this.createProviderReference(payment);
      payment.status = "completed";
      payment.providerReference = providerReference;
      payment.processedAt = new Date();
      await payment.save();

      await this.publishResult(payment);
      return payment;
    } catch (err) {
      payment.status = "failed";
      payment.failureReason = err.message;
      payment.processedAt = new Date();
      await payment.save();
      await this.publishResult(payment);
      throw err;
    }
  }

  async getPayment(paymentId, userId) {
    const payment = await Payment.findOne({ _id: paymentId, userId });
    if (!payment) {
      const err = new Error("Payment not found");
      err.statusCode = 404;
      throw err;
    }
    return payment;
  }

  async getPaymentsByOrder(orderId, userId) {
    return Payment.find({ orderId, userId }).sort({ createdAt: -1 });
  }

  async refundPayment(paymentId, userId) {
    const payment = await this.getPayment(paymentId, userId);

    if (payment.status !== "completed") {
      const err = new Error("Only completed payments can be refunded");
      err.statusCode = 409;
      throw err;
    }

    payment.status = "refunded";
    payment.refundedAt = new Date();
    await payment.save();
    await this.publishResult(payment);
    return payment;
  }

  normalizePayload(payload) {
    return {
      orderId: String(payload.orderId || "").trim(),
      userId: String(payload.userId || payload.user?.id || "").trim(),
      amount: Number(payload.amount),
      currency: String(payload.currency || "INR").trim().toUpperCase(),
      method: String(payload.method || "").trim().toLowerCase(),
      idempotencyKey: String(
        payload.idempotencyKey || payload.requestId || crypto.randomUUID(),
      ).trim(),
      metadata: payload.metadata || {},
    };
  }

  validatePayment(data) {
    if (!data.orderId || !data.userId || !data.method || !data.idempotencyKey) {
      const err = new Error("Missing required payment fields");
      err.statusCode = 400;
      throw err;
    }

    if (!Number.isFinite(data.amount) || data.amount <= 0) {
      const err = new Error("Amount must be greater than zero");
      err.statusCode = 400;
      throw err;
    }

    if (!config.allowedPaymentMethods.includes(data.method)) {
      const err = new Error("Unsupported payment method");
      err.statusCode = 400;
      throw err;
    }
  }

  createProviderReference(payment) {
    const hash = crypto
      .createHash("sha256")
      .update(`${payment.id}:${payment.orderId}:${payment.amount}`)
      .digest("hex")
      .slice(0, 16);

    return `pay_${hash}`;
  }

  async publishResult(payment) {
    if (!this.messageBroker) return;

    await this.messageBroker.publish(config.paymentResultsQueue, {
      paymentId: payment.id,
      orderId: payment.orderId,
      userId: payment.userId,
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
      status: payment.status,
      providerReference: payment.providerReference,
      failureReason: payment.failureReason,
      processedAt: payment.processedAt,
      refundedAt: payment.refundedAt,
    });
  }
}

module.exports = PaymentService;
