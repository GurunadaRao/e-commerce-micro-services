require("./observability/tracing");
const express = require("express");
const httpProxy = require("http-proxy");
const setupMetrics = require("./observability/metrics");

const proxy = httpProxy.createProxyServer();
const app = express();
setupMetrics(app, process.env.OTEL_SERVICE_NAME || "api-gateway");

// Route requests to the auth service
app.use("/auth", (req, res) => {
  proxy.web(req, res, { target: "http://auth:3000" });
});

// Route requests to the product service
app.use("/products", (req, res) => {
  proxy.web(req, res, { target: "http://product:3001" });
});

// Route requests to the order service
app.use("/orders", (req, res) => {
  proxy.web(req, res, { target: "http://order:3002" });
});

// Route requests to the payments service
app.use("/payments", (req, res) => {
  proxy.web(req, res, { target: "http://payments:3004/payments" });
});

// Start the server
const port = process.env.PORT || 3003;
app.listen(port, () => {
  console.log(`API Gateway listening on port ${port}`);
});
