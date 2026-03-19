# Operations Runbook

## Health Checks
- API health: `GET /api/trpc/system.health`
- Process liveness: verify Node process is running and listening on configured port.

## Common Failure Modes

### 1) OAuth login fails
Symptoms:
- Redirect loops or callback returns 400/500.

Checks:
- Verify `VITE_APP_ID`, `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL`.
- Confirm callback URL in OAuth provider matches `/api/oauth/callback`.
- Ensure `JWT_SECRET` is configured and stable.

### 2) Document uploads fail
Symptoms:
- Upload mutation returns internal error.

Checks:
- Validate `BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY`.
- Confirm file size is under 15MB (current limit).
- Verify storage proxy connectivity.

### 3) Documents stuck in processing
Symptoms:
- Document status never reaches `completed` or `failed`.

Checks:
- Inspect server logs for `Document Worker` errors.
- Confirm DB connectivity (`DATABASE_URL`).
- Confirm worker process is running (same API process).

### 4) Synthesis queries fail
Symptoms:
- Query status transitions to `failed`.

Checks:
- Verify document summaries exist for selected documents.
- Inspect logs for `Synthesis Worker` pipeline errors.
- Confirm DB write permissions for reports, claims, contradictions, and metrics.

## Recovery Procedures

### Restart services
```bash
pnpm build
pnpm start
```

### Re-run local development
```bash
pnpm dev
```

### Validate type and tests
```bash
pnpm check
pnpm test
```

## Data Integrity Checks
- Documents without summaries should remain `processing` only briefly; investigate if prolonged.
- Completed synthesis queries should have exactly one synthesis report.
- Claims and contradictions should be linked to valid `reportId` rows.

## Escalation
- If OAuth exchange fails repeatedly: verify upstream OAuth service health.
- If storage upload fails repeatedly: rotate forge API key and validate proxy access.
- If DB operations fail: inspect migration state and credentials, then run `pnpm db:push` if schema drift is suspected.
