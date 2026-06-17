const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");
const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-http");
const { NodeSDK } = require("@opentelemetry/sdk-node");
const resources = require("@opentelemetry/resources");

const serviceName = process.env.OTEL_SERVICE_NAME || "api-gateway";
const tracesUrl =
  process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
  "http://otel-collector:4318/v1/traces";

const resource = resources.resourceFromAttributes
  ? resources.resourceFromAttributes({ "service.name": serviceName })
  : new resources.Resource({ "service.name": serviceName });

const sdk = new NodeSDK({
  resource,
  traceExporter: new OTLPTraceExporter({ url: tracesUrl }),
  instrumentations: [getNodeAutoInstrumentations()],
});

try {
  sdk.start();
  console.log(`OpenTelemetry tracing started for ${serviceName}`);
} catch (err) {
  console.error("OpenTelemetry startup failed:", err.message);
}

process.on("SIGTERM", () => {
  sdk
    .shutdown()
    .then(() => console.log("OpenTelemetry tracing shut down"))
    .catch((err) => console.error("OpenTelemetry shutdown failed:", err.message));
});
