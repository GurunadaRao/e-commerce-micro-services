const express = require("express");
const config = require("./config");
const paymentRoutes = require("./routes/paymentRoutes");
const messageBroker = require("./utils/messageBroker");
const PaymentService = require("./services/paymentService");
const db = require("./utils/db");
const {
  applySecurity,
  createRateLimiter,
} = require("./middlewares/securityMiddleware");
const setupMetrics = require("./observability/metrics");

class App {
  constructor() {
    this.app = express();
    this.connectDB();
    this.setMiddlewares();
    this.setRoutes();
    this.setupMessageBroker();
  }

  async connectDB() {
    try {
      await db.initDB();
      this.dbConnected = true;
      console.log("PostgreSQL connected (payments)");
    } catch (err) {
      console.error("Payments DB connection error:", err.message);
      this.dbConnected = false;
    }
  }

  setMiddlewares() {
    applySecurity(this.app);
    setupMetrics(this.app, process.env.OTEL_SERVICE_NAME || "payments");
    this.app.use(express.json({ limit: "20kb" }));
    this.app.use(createRateLimiter({ windowMs: 60000, max: 120 }));
  }

  setRoutes() {
    this.app.get("/health", (req, res) => {
      res.status(200).json({
        service: "payments",
        postgres: this.dbConnected ? "connected" : "down",
        rabbitmq: messageBroker.connected ? "connected" : "down",
      });
    });

    this.app.use("/payments", paymentRoutes);
  }

  async setupMessageBroker() {
    try {
      await messageBroker.connect();
      const paymentService = new PaymentService(messageBroker);

      await messageBroker.consume(config.paymentsQueue, async (payload) => {
        await paymentService.processPayment(payload);
      });
    } catch (err) {
      console.error("Payments message broker setup failed:", err.message);
    }
  }

  start() {
    this.server = this.app.listen(config.port, () =>
      console.log(`Payments service started on port ${config.port}`),
    );
  }

  async stop() {
    await messageBroker.close();
    await db.pool.end();
    this.server.close();
    console.log("Payments service stopped");
  }
}

module.exports = App;
