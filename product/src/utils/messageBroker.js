const amqp = require("amqplib");

class MessageBroker {
  constructor() {
    this.channel = null;
    this.connection = null;
    this.onConnectCallbacks = [];
  }

  async connect() {
    console.log("Connecting to RabbitMQ...");
    const amqpServer = process.env.RABBITMQ_URL || "amqp://rabbitmq:5672";
    
    let retries = 10;
    while (retries > 0) {
      try {
        this.connection = await amqp.connect(amqpServer);
        this.channel = await this.connection.createChannel();

        // Assert exchange
        await this.channel.assertExchange("ecommerce_exchange", "topic", { durable: true });

        // Assert DLQs as Quorum Queues
        await this.channel.assertQueue("products_dlq", {
          durable: true,
          arguments: { "x-queue-type": "quorum" }
        });
        await this.channel.assertQueue("payment_results_dlq", {
          durable: true,
          arguments: { "x-queue-type": "quorum" }
        });
        await this.channel.assertQueue("orders_dlq", {
          durable: true,
          arguments: { "x-queue-type": "quorum" }
        });

        // Assert main queues with DLQ and Quorum configuration
        await this.channel.assertQueue("products", {
          durable: true,
          arguments: {
            "x-queue-type": "quorum",
            "x-dead-letter-exchange": "",
            "x-dead-letter-routing-key": "products_dlq",
          },
        });
        await this.channel.assertQueue("orders", {
          durable: true,
          arguments: {
            "x-queue-type": "quorum",
            "x-dead-letter-exchange": "",
            "x-dead-letter-routing-key": "orders_dlq",
          },
        });
        await this.channel.assertQueue("payments", { 
          durable: true,
          arguments: {
            "x-queue-type": "quorum",
            "x-dead-letter-exchange": "",
            "x-dead-letter-routing-key": "payments_dlq",
          },
        });
        await this.channel.assertQueue("payment_results", { 
          durable: true,
          arguments: {
            "x-queue-type": "quorum",
            "x-dead-letter-exchange": "",
            "x-dead-letter-routing-key": "payment_results_dlq",
          },
        });

        // Bind queues to topic exchange with routing keys
        await this.channel.bindQueue("products", "ecommerce_exchange", "order.fulfilled");
        await this.channel.bindQueue("payment_results", "ecommerce_exchange", "payment.*");

        console.log("RabbitMQ connected successfully");
        
        // Execute any callbacks registered before connection completed
        for (const cb of this.onConnectCallbacks) {
          cb();
        }
        this.onConnectCallbacks = [];
        return;
      } catch (err) {
        console.error(`Failed to connect to RabbitMQ: ${err.message}. Retrying in 3 seconds...`);
        retries--;
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    console.error("Fatal: Could not connect to RabbitMQ after multiple attempts.");
  }

  onConnect(callback) {
    if (this.channel) {
      callback();
    } else {
      this.onConnectCallbacks.push(callback);
    }
  }

  async publishMessage(routingKey, message) {
    if (!this.channel) {
      console.error("No RabbitMQ channel available.");
      return false;
    }

    try {
      return this.channel.publish(
        "ecommerce_exchange",
        routingKey,
        Buffer.from(JSON.stringify(message)),
        {
          contentType: "application/json",
          deliveryMode: 2,
        },
      );
    } catch (err) {
      console.log(err);
      return false;
    }
  }

  async consumeMessage(queue, callback) {
    if (!this.channel) {
      console.error("No RabbitMQ channel available.");
      return;
    }

    try {
      await this.channel.consume(queue, (message) => {
        if (!message) return;
        const content = message.content.toString();
        const parsedContent = JSON.parse(content);
        callback(parsedContent);
        this.channel.ack(message);
      });
    } catch (err) {
      console.log(err);
    }
  }
}

module.exports = new MessageBroker();
