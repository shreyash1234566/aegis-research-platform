# API Overview

All APIs are exposed through tRPC at `/api/trpc` unless noted.

## System
- `system.health` (public query)
  - Input: optional `{ timestamp?: number }`
  - Output: health signal, uptime, DB availability, job summary
- `system.notifyOwner` (admin mutation)
  - Input: `{ title: string, content: string }`
- `system.runtime` (admin query)
  - Input: optional `{ jobLimit?: number }`
  - Output: memory usage, uptime, recent jobs, job summary

## Auth
- `auth.me` (public query)
  - Returns authenticated user or `null`
- `auth.logout` (public mutation)
  - Clears session cookie

## Documents
- `documents.list` (protected query)
- `documents.get` (protected query)
- `documents.getSummary` (protected query)
- `documents.getUploadUrl` (protected mutation)
- `documents.upload` (protected mutation)
  - Input: filename, size, mime, base64 content
  - Starts async document processing
- `documents.markProcessed` (protected mutation)
- `documents.update` (protected mutation)
- `documents.delete` (protected mutation)

## Synthesis
- `synthesis.submitQuery` (protected mutation)
  - Creates async synthesis job
- `synthesis.getQuery` (protected query)
- `synthesis.listQueries` (protected query)
- `synthesis.getReportByQuery` (protected query)
- `synthesis.getReport` (protected query)
- `synthesis.createReport` (protected mutation)
- `synthesis.getDocumentSummaries` (protected query)

## Graph
- `graph.overview` (protected query)
- `graph.searchEntities` (protected query)
- `graph.getEntityGraph` (protected query)

## Analytics
- `analytics.overview` (protected query)
- `analytics.metrics` (protected query)
- `analytics.alerts` (protected query)

## OAuth callback
- `GET /api/oauth/callback`
  - Validates OAuth code and state
  - Creates session cookie and redirects to validated in-app path
