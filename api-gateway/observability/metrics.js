const client = require("prom-client");

function setupMetrics(app, serviceName) {
  client.collectDefaultMetrics({
    prefix: `${serviceName.replace(/-/g, "_")}_`,
  });

  const httpDuration = new client.Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request duration in seconds",
    labelNames: ["service", "method", "route", "status_code"],
    buckets: [0.005, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  });

  app.use((req, res, next) => {
    const end = httpDuration.startTimer();
    res.on("finish", () => {
      const route = req.route?.path || req.path || "unknown";
      end({
        service: serviceName,
        method: req.method,
        route,
        status_code: res.statusCode,
      });
    });
    next();
  });

  app.get("/metrics", async (req, res) => {
    res.set("Content-Type", client.register.contentType);
    res.end(await client.register.metrics());
  });
}

module.exports = setupMetrics;
