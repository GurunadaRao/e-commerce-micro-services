## Description
Please describe the changes proposed in this Pull Request, including the problem solved, design choices made, and overall impact on the microservices.

Fixes # (issue number)

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Optimization / Refactoring (e.g. Caching, database index, telemetry upgrade)

## 🛡️ Production & SRE Checklist
Before requesting review, please ensure the following:

### 1. Database & Persistence Layer
- [ ] PostgreSQL schemas have been updated via migration script (if applicable).
- [ ] MongoDB schemas are indexed properly on frequently queried attributes.
- [ ] Connection pools are properly closed on application shutdown.

### 2. Caching & Redis Integration
- [ ] Redis keys are designed under clear namespaces (e.g. `user:username:${username}`).
- [ ] Cache TTL (time-to-live) is set appropriately for read-heavy vs write-heavy items.
- [ ] Database fallback logic is implemented in case of Redis container outages (no critical crashes).
- [ ] Cache invalidation handles are implemented upon writes/creations.

### 3. Messaging & Reliability (RabbitMQ)
- [ ] Queues are declared as durable, replicated **Quorum Queues**.
- [ ] Dead Letter Queues (DLQs) are configured for processing failure routing.
- [ ] Consumers acknowledge messages (`channel.ack`) only after successful processing.
- [ ] No consumer leaks are created (consumers are registered globally, not per HTTP request).

### 4. Telemetry & Observability
- [ ] OpenTelemetry trace spans are correctly initialized and closed.
- [ ] API routes are instrumented, and metrics are scraped successfully by OTel Collector.
- [ ] Logs are printed with appropriate correlation IDs (Loki integration).

## 🧪 Testing & Verification
Describe how the changes were verified locally:
*   *Test Script run*: e.g. `node scripts/generateLoad.js` or `npm test`
*   *Verification Command*: e.g. `docker compose exec redis redis-cli KEYS "*"`
*   *Grafana check*: Trace found in Tempo? Metrics showing in dashboard?
