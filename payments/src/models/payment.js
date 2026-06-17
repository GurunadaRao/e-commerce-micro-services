const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, default: "INR", uppercase: true, trim: true },
    method: {
      type: String,
      required: true,
      enum: ["card", "upi", "wallet", "cod"],
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
      index: true,
    },
    idempotencyKey: { type: String, required: true, unique: true },
    providerReference: { type: String },
    failureReason: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
    processedAt: { type: Date },
    refundedAt: { type: Date },
  },
  { timestamps: true },
);

paymentSchema.index({ orderId: 1, userId: 1 });

module.exports = mongoose.model("Payment", paymentSchema);
