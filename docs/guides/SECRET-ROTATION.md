# Secret Rotation Runbook

This runbook covers the shared secrets used by the Gateway and ERP services.

## Secret ownership

- `JWT_SECRET` signs tenant and platform access tokens. Gateway and every service that validates user tokens must use the same active value.
- `SERVICE_SECRET` authenticates service-to-service requests. Gateway and every service that accepts service calls must use the same active value.
- `INTEGRATION_ENCRYPTION_KEY` (32-byte hex) encrypts per-tenant connector secrets (Fast2SMS API keys) at rest in Gateway. Only Gateway needs this value. Rotating it without re-encrypting stored secrets makes WhatsApp OTP unusable until tenants re-save API keys.
- `OTP_PEPPER` (optional) is mixed into WhatsApp OTP hashes. If unset, Gateway uses `INTEGRATION_ENCRYPTION_KEY`. Rotating the pepper invalidates in-flight OTP challenges only.
- `SERVICE_NAME` identifies the emitting service in logs and telemetry. It is not a secret and must match the service registry name.
- `SERVICE_VERSION` identifies the deployed build. Set it to the release or image identifier so failures can be attributed to a deployment.

Never commit secret values, place them in logs, or use a default value in a deployed environment.

## Rotation procedure

1. Announce a short maintenance window. The current implementation supports one active value at a time, so mixed old/new service instances can reject valid requests.
2. Generate new values in the deployment secret manager, for example:

   ```sh
   openssl rand -base64 48
   ```

3. Update `JWT_SECRET` and `SERVICE_SECRET` in the deployment environment. Keep the previous values available only for emergency rollback during the window.
4. If rotating `INTEGRATION_ENCRYPTION_KEY`, plan a tenant re-entry of Fast2SMS API keys (Administration → Integrations) after Gateway restart, or re-encrypt rows offline before cutover. `OTP_PEPPER` can rotate independently.
5. Restart or roll out Gateway and all services that validate the changed secret as one coordinated deployment. Do not expose a partially rotated stack to users.
6. Verify health endpoints for every service and Gateway readiness.
7. Verify a fresh login (email and, if configured, WhatsApp OTP), an authenticated tenant request, and one service-to-service flow for each critical path: order, stock, accounting, procurement, and delivery.
8. Review logs and telemetry for `401`, `403`, service-key failures, and correlation IDs. Confirm `SERVICE_NAME` and `SERVICE_VERSION` identify the failing deployment.
9. Revoke the previous values from the secret manager after the verification window and record the rotation timestamp, operator, release, and affected environments.

JWT rotation invalidates existing access tokens. Users must sign in again after a successful `JWT_SECRET` rotation. Service-secret rotation does not require user reauthentication, but all service instances must be restarted with the new value.

## Emergency rollback

If health checks or critical-flow verification fail, restore the previous secret values to the deployment environment and restart the complete affected stack. Re-run the health and critical-flow checks, then record the failed rotation and reason. Do not leave old and new values running simultaneously.

## Local validation

Use explicit non-default values for local validation:

```sh
SERVICE_SECRET=local-build-validation-service-secret \
JWT_SECRET=local-build-validation-jwt-secret \
pnpm exec turbo build --env-mode=loose
```

Local values must never be reused in shared, staging, or production environments.
