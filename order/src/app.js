const express = require("express");
const mongoose = require("mongoose");
const Order = require("./models/order");
const amqp = require("amqplib");
const config = require("./config");
const setupMetrics = require("./observability/metrics");

class App {
  constructor() {
    this.app = express();
    this.connectDB();
    this.setMiddlewares();
    this.setupOrderConsumer();
  }

  async connectDB() {
    await mongoose.connect(config.mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB connected");
  }

  async disconnectDB() {
    await mongoose.disconnect();
    console.log("MongoDB disconnected");
  }

  setMiddlewares() {
    setupMetrics(this.app, process.env.OTEL_SERVICE_NAME || "order");
    this.app.use(express.json());
  }

  async setupOrderConsumer() {
    console.log("Connecting to RabbitMQ...");
  
    setTimeout(async () => {
      try {
        const amqpServer = process.env.RABBITMQ_URL || "amqp://rabbitmq:5672";
        const connection = await amqp.connect(amqpServer);
        console.log("Connected to RabbitMQ");
        const channel = await connection.createChannel();

        // Assert exchange
        await channel.assertExchange("ecommerce_exchange", "topic", { durable: true });

        // Assert DLQ as Quorum Queue
        await channel.assertQueue("orders_dlq", {
          durable: true,
          arguments: { "x-queue-type": "quorum" }
        });

        // Assert main queue with DLQ and Quorum options
        await channel.assertQueue("orders", {
          durable: true,
          arguments: {
            "x-queue-type": "quorum",
            "x-dead-letter-exchange": "",
            "x-dead-letter-routing-key": "orders_dlq",
          },
        });

        // Bind orders queue to exchange
        await channel.bindQueue("orders", "ecommerce_exchange", "order.request");
  
        channel.consume("orders", async (data) => {
          if (!data) return;
          console.log("Consuming ORDER service");

          try {
            const { products, username, orderId } = JSON.parse(data.content.toString());
    
            const newOrder = new Order({
              products,
              user: username,
              totalPrice: products.reduce((acc, product) => acc + product.price, 0),
            });
    
            // Save order to DB
            await newOrder.save();
    
            // Send ACK to ORDER service
            channel.ack(data);
            console.log("Order saved to DB and ACK sent to ORDER queue");
    
            // Send fulfilled order event to products via exchange
            const { user, products: savedProducts, totalPrice } = newOrder.toJSON();
            channel.publish(
              "ecommerce_exchange",
              "order.fulfilled",
              Buffer.from(JSON.stringify({ orderId, user, products: savedProducts, totalPrice })),
              { deliveryMode: 2 }
            );
          } catch (err) {
            console.error("Order queue message failed:", err.message);
            // send to DLQ
            channel.nack(data, false, false);
          }
        });
      } catch (err) {
        console.error("Failed to connect to RabbitMQ:", err.message);
      }
    }, 10000); // add a delay to wait for RabbitMQ to start in docker-compose
  }

  start() {
    this.server = this.app.listen(config.port, () =>
      console.log(`Server started on port ${config.port}`)
    );
  }

  async stop() {
    await mongoose.disconnect();
    this.server.close();
    console.log("Server stopped");
  }
}

module.exports = App;
