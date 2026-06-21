# Contributing to Node.js E-Commerce Microservices

We welcome contributions from the community! To ensure a smooth process, please follow these guidelines when submitting bug reports, features, or pull requests.

---

## 🗺️ Codebase & Domain Structure
Our codebase is designed using Uncle Bob's **Clean Architecture** principles across four core microservices:
*   `auth`: User registration, session lookup, and JWT signing (MongoDB + Redis).
*   `product`: Inventory management, catalog queries, and order creation initiation (MongoDB + Redis + RabbitMQ).
*   `payments`: Financial ledgering and transaction checks (PostgreSQL + RabbitMQ).
*   `order`: Asynchronous order serialization and fulfillment recording (MongoDB + RabbitMQ).

All domain code must follow this module boundary:
```text
src/
├── app.js               # Express application wrapper & wiring
├── config.js            # Environment config schema
├── controllers/         # HTTP Controllers (API gateways)
├── models/              # Schema definitions (Mongoose/PostgreSQL schemas)
├── repositories/        # Database Access Layer (isolating DB calls)
├── services/            # Pure Business Logic (calling repositories)
└── utils/               # Shared helpers (e.g. redis.js, messageBroker.js)
```

---

## 🚀 Branching Strategy
*   `main`: Tracks production-ready, release-tagged states.
*   `develop`: The integration branch for new features. All pull requests should target `develop`.
*   Feature branches: Create branches off `develop` using the format `feature/your-feature-name` or `bugfix/issue-id`.

---

## ⚡ Local Setup & Testing
1.  **Start Local Dependencies**:
    Before running microservices locally, start the backing databases, message queues, and caching engines:
    ```bash
    docker compose up -d mongodb postgres redis rabbitmq
    ```
2.  **Verify Observability & Health**:
    Run our local healthcheck script to make sure Mimir, Tempo, Loki, and Grafana are provisioned:
    ```bash
    node scripts/verify-lgtm.js
    ```
3.  **Run Tests**:
    Tests can be executed in individual directories:
    ```bash
    cd auth && npm test
    ```

---

## 📥 Pull Request Checklist
Before submitting a PR, verify the following:
*   [ ] The code compiles and has no linting errors.
*   [ ] Local unit tests pass.
*   [ ] You have added tests covering the new functionality.
*   [ ] Secrets or config items are loaded via environment variables, not hardcoded.
*   [ ] Redis keys are safely handled in try/catch blocks for fallback/degradation.
