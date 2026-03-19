# Aegis Research Platform

A sovereign research synthesis platform focused on grounded outputs and hallucination defense.

## What is implemented
- Document ingestion pipeline: upload -> storage -> async processing -> summary persistence
- Synthesis pipeline: async query execution -> retrieval -> orchestration -> verified report persistence
- Multi-source retrieval (vector-like lexical similarity, BM25, GraphRAG-lite)
- Hallucination defense heuristics: CRAG-style gating, trust scoring, constitutional verification, reasoning pass
- Knowledge graph APIs and visualization page
- Analytics and admin dashboards with operational alerts
- Runtime diagnostics, structured request logs, and job queue visibility

## Architecture overview
1. Documents are uploaded through `documents.upload` and stored via Forge storage proxy.
2. A background document worker processes text and writes summaries + entity links.
3. Research queries are submitted through `synthesis.submitQuery`.
4. A background synthesis worker runs retrieval + synthesis orchestration + verification.
5. Reports, claims, contradictions, and performance metrics are persisted.
6. UI pages (`/documents`, `/research`, `/analytics`, `/graph`, `/admin`) consume these APIs.

## Local setup
1. Copy `.env.example` to `.env` and fill required values.
2. Install dependencies:
```bash
pnpm install
```
3. Apply DB schema:
```bash
pnpm db:push
```
4. Run development server:
```bash
pnpm dev
```

## Verification commands
```bash
pnpm check
pnpm test
pnpm bench
```

## Core routes
- Public health: `/api/trpc/system.health`
- OAuth callback: `/api/oauth/callback`
- tRPC root: `/api/trpc`

## Operational notes
- Workers currently run in-process using a retry/timeout scheduler.
- For horizontal scaling, migrate workers to an external queue (e.g. Redis/BullMQ).
- Runtime diagnostics are available to admin users through `system.runtime`.

## Security notes
- OAuth callback validates state origin before redirect.
- Session cookie is signed and HttpOnly.
- Request IDs are attached to every response and included in logs.
