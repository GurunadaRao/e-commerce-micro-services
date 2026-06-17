require("dotenv").config();

module.exports = {
  port: process.env.PORT || 3004,
  mongoURI: process.env.MONGODB_PAYMENTS_URI || "mongodb://mongodb:27017/payments",
  rabbitMQUrl: process.env.RABBITMQ_URL || "amqp://localhost:5672",
  paymentsQueue: process.env.PAYMENTS_QUEUE || "payments",
  paymentResultsQueue: process.env.PAYMENT_RESULTS_QUEUE || "payment_results",
  jwtSecret: process.env.JWT_SECRET || "secret",
  allowedPaymentMethods: ["card", "upi", "wallet", "cod"],
};
