# Deployment Guide

## 1) Prerequisites
- Node.js 20+
- pnpm 10+
- MySQL-compatible database reachable from runtime
- OAuth provider credentials
- Forge API credentials for storage and model endpoints

## 2) Environment Setup
1. Copy `.env.example` to `.env`.
2. Fill all required variables (`DATABASE_URL`, OAuth vars, forge vars, `JWT_SECRET`).
3. Set `NODE_ENV=production` for release deployments.

## 3) Install Dependencies
```bash
pnpm install --frozen-lockfile
```

## 4) Apply Database Migrations
```bash
pnpm db:push
```

## 5) Build
```bash
pnpm build
```

## 6) Start
```bash
pnpm start
```

The server listens on `PORT` (defaults to `3000`).

## 7) Smoke Tests
- `GET /api/trpc/system.health` should return healthy response.
- OAuth callback route should be reachable at `/api/oauth/callback`.
- Submit a document and verify it reaches `completed` or `failed` state.
- Submit a synthesis query and verify report generation.

## 8) Operational Notes
- Document processing and synthesis jobs currently run in-process via async queue timers.
- For horizontal scaling, replace in-process queues with an external worker queue.
- Keep `JWT_SECRET` stable across restarts to avoid invalidating sessions.
