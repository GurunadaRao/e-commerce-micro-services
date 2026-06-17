const amqp = require("amqplib");

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost:5672";

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function consumeWithTimeout(channel, queue) {
  let consumed = false;

  await channel.consume(queue, (msg) => {
    if (!msg) return;

    console.log(`  [ok] Message consumed from '${queue}':`);
    const content = JSON.parse(msg.content.toString());
    console.log("     ", JSON.stringify(content, null, 2));
    channel.ack(msg);
    consumed = true;
  });

  const startTime = Date.now();
  while (!consumed && Date.now() - startTime < 5000) {
    await sleep(100);
  }

  if (!consumed) {
    console.log(`  [warn] No message consumed from '${queue}' queue (timeout)`);
  }
}

async function testRabbitMQ() {
  let connection;
  let channel;

  try {
    console.log(`\nTesting RabbitMQ at ${RABBITMQ_URL}\n`);

    console.log("[test] 1: Connect to RabbitMQ");
    connection = await amqp.connect(RABBITMQ_URL);
    console.log("  [ok] Connected to RabbitMQ\n");

    console.log("[test] 2: Create channel");
    channel = await connection.createChannel();
    console.log("  [ok] Channel created\n");

    console.log("[test] 3: Assert queues");
    await channel.assertQueue("orders", { durable: false });
    console.log("  [ok] 'orders' queue asserted");
    await channel.assertQueue("products", { durable: false });
    console.log("  [ok] 'products' queue asserted");
    await channel.assertQueue("payments", { durable: true });
    console.log("  [ok] 'payments' queue asserted");
    await channel.assertQueue("payment_results", { durable: true });
    console.log("  [ok] 'payment_results' queue asserted\n");

    console.log("[test] 4: Publish message to 'orders' queue");
    const orderMessage = {
      orderId: "test-order-001",
      products: [{ id: "p1", name: "Test Product", price: 99.99 }],
      username: "testuser",
    };
    await channel.sendToQueue("orders", Buffer.from(JSON.stringify(orderMessage)));
    console.log("  [ok] Message published:", JSON.stringify(orderMessage, null, 2));

    console.log("\n[test] 5: Publish message to 'products' queue");
    const productMessage = {
      orderId: "test-order-001",
      user: "testuser",
      products: [{ id: "p1", name: "Test Product", price: 99.99 }],
      totalPrice: 99.99,
    };
    await channel.sendToQueue("products", Buffer.from(JSON.stringify(productMessage)));
    console.log("  [ok] Message published:", JSON.stringify(productMessage, null, 2));

    console.log("\n[test] 6: Publish message to 'payments' queue");
    const paymentMessage = {
      orderId: "test-order-001",
      userId: "testuser",
      amount: 99.99,
      currency: "INR",
      method: "cod",
      idempotencyKey: "test-payment-001",
    };
    await channel.sendToQueue(
      "payments",
      Buffer.from(JSON.stringify(paymentMessage)),
      { contentType: "application/json", deliveryMode: 2 },
    );
    console.log("  [ok] Message published:", JSON.stringify(paymentMessage, null, 2));

    console.log("\n[test] 7: Consume from 'orders' queue");
    await consumeWithTimeout(channel, "orders");

    console.log("\n[test] 8: Consume from 'products' queue");
    await consumeWithTimeout(channel, "products");

    console.log("\n[test] 9: Check queue stats");
    const ordersStats = await channel.checkQueue("orders");
    const productsStats = await channel.checkQueue("products");
    const paymentsStats = await channel.checkQueue("payments");
    const paymentResultsStats = await channel.checkQueue("payment_results");

    console.log(
      "  'orders' queue:",
      `${ordersStats.messageCount} messages, ${ordersStats.consumerCount} consumers`,
    );
    console.log(
      "  'products' queue:",
      `${productsStats.messageCount} messages, ${productsStats.consumerCount} consumers`,
    );
    console.log(
      "  'payments' queue:",
      `${paymentsStats.messageCount} messages, ${paymentsStats.consumerCount} consumers`,
    );
    console.log(
      "  'payment_results' queue:",
      `${paymentResultsStats.messageCount} messages, ${paymentResultsStats.consumerCount} consumers\n`,
    );

    console.log("[ok] All RabbitMQ tests passed!\n");
    process.exit(0);
  } catch (err) {
    console.error("[fail] Test failed:", err.message);
    process.exit(1);
  } finally {
    if (channel) await channel.close();
    if (connection) await connection.close();
  }
}

testRabbitMQ();
