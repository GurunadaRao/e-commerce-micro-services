const amqp = require("amqplib");

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost:5672";

async function run() {
  console.log("🚀 Starting Heavy RabbitMQ Load Generator...");
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    
    // Assert exchange
    await channel.assertExchange("ecommerce_exchange", "topic", { durable: true });

    const messageCount = 5000;
    console.log(`✉️ Publishing ${messageCount} messages to each queue via topic exchange...`);

    // 1. Publish payment.request messages (routes to payments queue)
    console.log("-> Publishing payment.request...");
    for (let i = 0; i < messageCount; i++) {
      const payload = {
        orderId: `order-heavy-${i}`,
        userId: "user-heavy-load",
        amount: Math.floor(Math.random() * 1000) + 1,
        method: "card",
        currency: "USD",
        idempotencyKey: `idempotency-heavy-${i}`,
      };
      channel.publish("ecommerce_exchange", "payment.request", Buffer.from(JSON.stringify(payload)), {
        deliveryMode: 2,
        contentType: "application/json",
      });
    }

    // 2. Publish order.request messages (routes to orders queue)
    console.log("-> Publishing order.request...");
    for (let i = 0; i < messageCount; i++) {
      const payload = {
        orderId: `order-heavy-${i}`,
        username: "user-heavy-load",
        products: [{ id: "p1", name: "Heavy Load Product", price: 100 }],
      };
      channel.publish("ecommerce_exchange", "order.request", Buffer.from(JSON.stringify(payload)), {
        deliveryMode: 2,
        contentType: "application/json",
      });
    }

    // 3. Publish payment.success messages (routes to payment_results queue)
    console.log("-> Publishing payment.success...");
    for (let i = 0; i < messageCount; i++) {
      const payload = {
        orderId: `order-heavy-${i}`,
        status: "completed",
        amount: 100,
      };
      channel.publish("ecommerce_exchange", "payment.success", Buffer.from(JSON.stringify(payload)), {
        deliveryMode: 2,
        contentType: "application/json",
      });
    }

    // 4. Publish order.fulfilled messages (routes to products queue)
    console.log("-> Publishing order.fulfilled...");
    for (let i = 0; i < messageCount; i++) {
      const payload = {
        orderId: `order-heavy-${i}`,
        status: "completed",
      };
      channel.publish("ecommerce_exchange", "order.fulfilled", Buffer.from(JSON.stringify(payload)), {
        deliveryMode: 2,
        contentType: "application/json",
      });
    }

    console.log("✅ All messages successfully published to Topic Exchange!");
    
    // Allow a second for publisher buffers to flush to RabbitMQ socket
    await new Promise(resolve => setTimeout(resolve, 1500));

    await channel.close();
    await connection.close();
    process.exit(0);
  } catch (err) {
    console.error("❌ Failed to publish load:", err.message);
    process.exit(1);
  }
}

run();
