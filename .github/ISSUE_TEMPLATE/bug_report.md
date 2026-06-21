name: Bug Report
description: Report a bug or issue in the e-commerce microservices
labels: [bug]
body:
  - type: markdown
    attributes:
      value: |
        Please provide as much context as possible to help us reproduce and resolve the issue.
  - type: textarea
    id: description
    attributes:
      label: Describe the Bug
      description: A clear and concise description of what the bug is.
      placeholder: E.g., The Product service is crashing with OOM during concurrent checkouts...
    validations:
      required: true
  - type: textarea
    id: reproduce
    attributes:
      label: Steps to Reproduce
      description: Steps to recreate the bug.
      placeholder: |
        1. Start the stack using 'docker compose up'
        2. Run 'node scripts/generateLoad.js'
        3. Observe the crash...
    validations:
      required: true
  - type: textarea
    id: expected
    attributes:
      label: Expected Behavior
      description: What did you expect to happen?
      placeholder: E.g., The checkout flow should complete with 201 status and write to Postgres.
    validations:
      required: true
  - type: textarea
    id: logs
    attributes:
      label: Logs & Telemetry
      description: Please paste any relevant Docker Compose logs, error messages, or Grafana Tempo trace IDs here.
  - type: textarea
    id: environment
    attributes:
      label: Environment Info
      description: OS, Docker version, Node version.
      placeholder: E.g., Windows 11, Docker Desktop v4.25, Node v20.5
