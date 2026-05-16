# Critical Gaps

## Authentication & Authorization

| Item | Status | Notes |
|------|--------|-------|
| Dashboard Authentication | **MISSING** | Uses mock data + dev auth header only |
| Telegram Login Widget | **MISSING** | `requireProductionAuth()` returns 401, marked TODO |
| RBAC Model | **NOT VERIFIED** | groupAdmins table exists, no middleware enforcement |
| API Authentication | **PARTIAL** | `x-togi-dev-auth` header in dev only |

### Details

**Dashboard Auth:**
- `apps/web/src/app/dashboard/page.tsx` uses hardcoded mock data (lines 8-70)
- No actual authentication flow implemented
- `/dashboard` accessible without login
- `apps/api/src/middleware/auth.ts:138` — `requireProductionAuth()` returns 401 with `AUTH_NOT_IMPLEMENTED`

**RBAC:**
- `packages/db/src/schema.ts:29-40` defines `groupAdmins` table with `role` and `permissions` JSONB
- No middleware in `apps/api/src/routes/groups.ts` checks admin role before CRUD operations
- Anyone with API access can modify any group's policy

## Webhook Security

| Item | Status | Notes |
|------|--------|-------|
| Webhook Secret Verification | **DONE** | `x-telegram-bot-api-secret-token` checked in webhook.ts:59-70 |
| Replay Protection | **MISSING** | No update ID deduplication in Redis |
| Update Idempotency | **PARTIAL** | Action locks prevent duplicate actions, but update IDs not tracked |

### Details

**Replay Protection:**
- `SECURITY_MODEL.md:25-28` specifies storing last 1000 update IDs in Redis
- `apps/api/src/routes/webhook.ts` does NOT check/update Redis for update IDs
- Replay attack possible: same update sent multiple times would be processed each time

**Action Idempotency:**
- `TelegramActionExecutor` uses Redis locks per (chatId, messageId, action) — **GOOD**
- But the lock is per-action, not per-update — a replayed DELETE would execute again

## Rate Limiting

| Item | Status | Notes |
|------|--------|-------|
| Global API Throttle | **DONE** | `checkGlobalApiThrottle()` in security.ts:93-102 |
| Per-Group Action Rate | **DONE** | `checkGroupActionRateLimit()` in security.ts:49-68 |
| Per-User Command Rate | **DONE** | `checkUserCommandRateLimit()` in security.ts:71-90 |
| Per-IP Rate Limiting | **NOT IMPLEMENTED** | IP logging exists but no blocking |

### Details

**Per-IP Rate Limiting:**
- `security.ts:110-125` `ipLoggingMiddleware` only logs IP, does not rate limit
- No `checkIpRateLimit()` function exists
- An attacker could exhaust API from single IP

## Infrastructure

| Item | Status | Notes |
|------|--------|-------|
| Dockerfiles | **MISSING** | `docker-compose.yml` references `apps/api/Dockerfile` etc. but none exist |
| CI/CD | **MISSING** | No `.github/workflows/` directory |
| Kubernetes | **NOT PLANNED** | v1.3.0 roadmap item |

## Testing

| Item | Status | Notes |
|------|--------|-------|
| Unit Tests | **PARTIAL** | 3 test files only |
| Integration Tests | **MISSING** | No DB + API integration tests |
| E2E Tests | **MISSING** | No Playwright/Cypress tests |
| Load Tests | **MISSING** | No k6 or artillery tests |
| Test Coverage | **NOT MEASURED** | No coverage report |

## Monitoring

| Item | Status | Notes |
|------|--------|-------|
| Prometheus Metrics | **PARTIAL** | Worker exposes metrics, API does not |
| Health Check Endpoint | **DONE** | `/health` returns 200 |
| Structured Logging | **DONE** | Uses Pino via Fastify |
| Alerting | **MISSING** | No Pagerduty/OpsGenie integration |