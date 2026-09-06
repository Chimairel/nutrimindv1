# Security policy

Do not open public issues containing credentials, personal health information, private user records, or exploitable details from a live deployment.

For this capstone repository, report a suspected vulnerability privately to the repository owner. Include the affected commit, reproduction steps using synthetic data, expected impact, and a proposed mitigation when available. Rotate any exposed credential immediately and remove it from Git history before treating the incident as closed.

Supported development work is tracked on `development` and active feature branches. A release is supportable only when CI, production configuration validation, dependency audit, migration review, and the deployment health checks pass for the exact commit and image digests being released.
