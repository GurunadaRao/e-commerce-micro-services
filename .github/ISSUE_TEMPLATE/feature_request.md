name: Feature Request
description: Propose a new feature, optimization, or architectural upgrade
labels: [enhancement]
body:
  - type: textarea
    id: feature-description
    attributes:
      label: Is your feature request related to a problem?
      description: A clear and concise description of what the problem is.
      placeholder: E.g., Database write contention on payments is slowing down checkouts...
  - type: textarea
    id: proposal
    attributes:
      label: Describe the Proposed Solution
      description: A clear and concise description of what you want to happen.
      placeholder: E.g., Implement PgBouncer connection pooling or scale out payments replicas...
    validations:
      required: true
  - type: textarea
    id: alternatives
    attributes:
      label: Describe Alternatives You've Considered
      description: Any alternative solutions or features you've considered.
  - type: textarea
    id: context
    attributes:
      label: Additional Context
      description: Any other context, diagrams, or screenshots about the feature request here.
