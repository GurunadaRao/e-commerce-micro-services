const amqp = require("amqplib");
const config = require("../config");

class MessageBroker {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.connected = false;
  }

  async connect({ retries = 10, retryDelayMs = 5000 } = {}) {
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        this.connection = await amqp.connect(config.rabbitMQUrl);
        this.channel = await this.connection.createChannel();
        await this.channel.assertQueue(config.paymentsQueue, { durable: true });
        await this.channel.assertQueue(config.paymentResultsQueue, {
          durable: true,
        });

        this.connection.on("close", () => {
          this.connected = false;
          this.channel = null;
          console.error("Payments RabbitMQ connection closed");
        });

        this.connection.on("error", (err) => {
          this.connected = false;
          console.error("Payments RabbitMQ connection error:", err.message);
        });

        this.connected = true;
        console.log("Payments service connected to RabbitMQ");
        return;
      } catch (err) {
        console.error(
          `Payments RabbitMQ connection failed (${attempt}/${retries}):`,
          err.message,
        );

        if (attempt === retries) {
          throw err;
        }

        await this.wait(retryDelayMs);
      }
    }
  }

  async publish(queue, payload) {
    if (!this.channel) {
      console.error("Payments RabbitMQ channel is not available");
      return false;
    }

    return this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(payload)), {
      contentType: "application/json",
      deliveryMode: 2,
    });
  }

  async consume(queue, handler) {
    if (!this.channel) {
      console.error("Payments RabbitMQ channel is not available");
      return;
    }

    await this.channel.consume(queue, async (message) => {
      if (!message) return;

      try {
        const payload = JSON.parse(message.content.toString());
        await handler(payload);
        this.channel.ack(message);
      } catch (err) {
        console.error("Payments queue message failed:", err.message);
        this.channel.nack(message, false, false);
      }
    });
  }

  async close() {
    if (this.channel) {
      await this.channel.close();
    }

    if (this.connection) {
      await this.connection.close();
    }
  }

  wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = new MessageBroker();
