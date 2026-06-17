const Product = require("../models/product");
const messageBroker = require("../utils/messageBroker");
const uuid = require('uuid');

/**
 * Class to hold the API implementation for the product services
 */
class ProductController {

  constructor() {
    this.createOrder = this.createOrder.bind(this);
    this.getOrderStatus = this.getOrderStatus.bind(this);
    this.ordersMap = new Map();

  }

  async createProduct(req, res, next) {
    try {
      const token = req.headers.authorization;
      if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const product = new Product(req.body);

      const validationError = product.validateSync();
      if (validationError) {
        return res.status(400).json({ message: validationError.message });
      }

      await product.save({ timeout: 30000 });

      res.status(201).json(product);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  }

  async createOrder(req, res, next) {
    try {
      const token = req.headers.authorization;
      if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
      }
  
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "Product ids are required" });
      }

      const products = await Product.find({ _id: { $in: ids } });
      if (products.length === 0) {
        return res.status(404).json({ message: "No matching products found" });
      }

      const totalPrice = products.reduce((acc, product) => acc + product.price, 0);
  
      const orderId = uuid.v4(); // Generate a unique order ID
      const userId = req.user.id;
      const username = req.user.username || userId;

      this.ordersMap.set(orderId, { 
        status: "pending_payment",
        products, 
        username,
        totalPrice,
      });

      const paymentMethod = req.body.paymentMethod || req.body.method || "cod";
      const paymentQueued = await messageBroker.publishMessage("payments", {
        orderId,
        userId,
        amount: totalPrice,
        method: paymentMethod,
        currency: req.body.currency || "INR",
        idempotencyKey: req.body.idempotencyKey || orderId,
        metadata: {
          productIds: ids,
        },
      });

      if (!paymentQueued) {
        return res.status(503).json({ message: "Payment service is unavailable" });
      }

      messageBroker.consumeMessage("payment_results", (data) => {
        if (data.orderId !== orderId) return;

        const order = this.ordersMap.get(orderId);
        if (!order) return;

        this.ordersMap.set(orderId, {
          ...order,
          payment: data,
          status: data.status === "completed" ? "payment_completed" : "payment_failed",
        });
      });

      let order = this.ordersMap.get(orderId);
      let paymentWaits = 0;
      while (order.status === "pending_payment" && paymentWaits < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        order = this.ordersMap.get(orderId);
        paymentWaits += 1;
      }

      if (order.status !== "payment_completed") {
        return res.status(402).json({
          message: "Payment could not be completed",
          order,
        });
      }
  
      await messageBroker.publishMessage("orders", {
        products,
        username,
        orderId, // include the order ID in the message to orders queue
      });

      messageBroker.consumeMessage("products", (data) => {
        const orderData = JSON.parse(JSON.stringify(data));
        const { orderId } = orderData;
        const order = this.ordersMap.get(orderId);
        if (order) {
          // update the order in the map
          this.ordersMap.set(orderId, { ...order, ...orderData, status: 'completed' });
          console.log("Updated order:", order);
        }
      });
  
      // Long polling until order is completed
      let orderWaits = 0;
      order = this.ordersMap.get(orderId);
      while (order.status !== 'completed' && orderWaits < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // wait for 1 second before checking status again
        order = this.ordersMap.get(orderId);
        orderWaits += 1;
      }

      if (order.status !== "completed") {
        return res.status(202).json(order);
      }
  
      // Once the order is marked as completed, return the complete order details
      return res.status(201).json(order);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  }
  

  async getOrderStatus(req, res, next) {
    const { orderId } = req.params;
    const order = this.ordersMap.get(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    return res.status(200).json(order);
  }

  async getProducts(req, res, next) {
    try {
      const token = req.headers.authorization;
      if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const products = await Product.find({});

      res.status(200).json(products);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  }
}

module.exports = ProductController;
