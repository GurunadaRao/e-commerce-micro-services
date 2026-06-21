require("dotenv").config();

module.exports = {
  port: process.env.PORT || 3004,
  postgres: {
    host: process.env.POSTGRES_HOST || "localhost",
    port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
    user: process.env.POSTGRES_USER || "payments_user",
    password: process.env.POSTGRES_PASSWORD || "payments_password",
    database: process.env.POSTGRES_DB || "payments_db",
  },
  rabbitMQUrl: process.env.RABBITMQ_URL || "amqp://localhost:5672",
  paymentsQueue: process.env.PAYMENTS_QUEUE || "payments",
  paymentResultsQueue: process.env.PAYMENT_RESULTS_QUEUE || "payment_results",
  jwtSecret: process.env.JWT_SECRET || "secret",
  allowedPaymentMethods: ["card", "upi", "wallet", "cod"],
};
