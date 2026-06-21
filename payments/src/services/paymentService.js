const crypto = require("crypto");
const db = require("../utils/db");
const config = require("../config");

class PaymentService {
  constructor(messageBroker) {
    this.messageBroker = messageBroker;
  }

  mapToPaymentObject(row) {
    if (!row) return null;
    return {
      id: String(row.id),
      orderId: row.order_id,
      userId: row.user_id,
      amount: Number(row.amount),
      currency: row.currency,
      method: row.method,
      status: row.status,
      idempotencyKey: row.idempotency_key,
      providerReference: row.provider_reference,
      failureReason: row.failure_reason,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      processedAt: row.processed_at,
      refundedAt: row.refunded_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async processPayment(payload) {
    const data = this.normalizePayload(payload);
    this.validatePayment(data);

    // 1. Check idempotency
    const checkRes = await db.query(
      "SELECT * FROM payments WHERE idempotency_key = $1",
      [data.idempotencyKey]
    );
    if (checkRes.rows.length > 0) {
      return this.mapToPaymentObject(checkRes.rows[0]);
    }

    // 2. Create pending payment record
    const createRes = await db.query(
      `INSERT INTO payments 
       (order_id, user_id, amount, currency, method, idempotency_key, metadata, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.orderId,
        data.userId,
        data.amount,
        data.currency,
        data.method,
        data.idempotencyKey,
        JSON.stringify(data.metadata),
        "pending"
      ]
    );
    let paymentObj = this.mapToPaymentObject(createRes.rows[0]);

    try {
      const providerReference = this.createProviderReference(paymentObj);
      
      const updateRes = await db.query(
        `UPDATE payments 
         SET status = $1, provider_reference = $2, processed_at = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING *`,
        ["completed", providerReference, new Date(), parseInt(paymentObj.id, 10)]
      );
      paymentObj = this.mapToPaymentObject(updateRes.rows[0]);

      await this.publishResult(paymentObj);
      return paymentObj;
    } catch (err) {
      const updateRes = await db.query(
        `UPDATE payments 
         SET status = $1, failure_reason = $2, processed_at = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING *`,
        ["failed", err.message, new Date(), parseInt(paymentObj.id, 10)]
      );
      paymentObj = this.mapToPaymentObject(updateRes.rows[0]);
      await this.publishResult(paymentObj);
      throw err;
    }
  }

  async getPayment(paymentId, userId) {
    const numericId = parseInt(paymentId, 10);
    if (isNaN(numericId)) {
      const err = new Error("Payment not found");
      err.statusCode = 404;
      throw err;
    }

    const res = await db.query(
      "SELECT * FROM payments WHERE id = $1 AND user_id = $2",
      [numericId, userId]
    );

    if (res.rows.length === 0) {
      const err = new Error("Payment not found");
      err.statusCode = 404;
      throw err;
    }
    return this.mapToPaymentObject(res.rows[0]);
  }

  async getPaymentsByOrder(orderId, userId) {
    const res = await db.query(
      "SELECT * FROM payments WHERE order_id = $1 AND user_id = $2 ORDER BY created_at DESC",
      [orderId, userId]
    );
    return res.rows.map(row => this.mapToPaymentObject(row));
  }

  async refundPayment(paymentId, userId) {
    const payment = await this.getPayment(paymentId, userId);

    if (payment.status !== "completed") {
      const err = new Error("Only completed payments can be refunded");
      err.statusCode = 409;
      throw err;
    }

    const updateRes = await db.query(
      `UPDATE payments 
       SET status = $1, refunded_at = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      ["refunded", new Date(), parseInt(payment.id, 10)]
    );
    const updatedPayment = this.mapToPaymentObject(updateRes.rows[0]);
    await this.publishResult(updatedPayment);
    return updatedPayment;
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

    const routingKey = payment.status === "completed" ? "payment.success" : "payment.failed";
    await this.messageBroker.publish(routingKey, {
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
