# Phased Roadmap

## Current Version: v0.1.0 MVP

## Phase Plan to v1.0

### Phase 1: Security Hardening (1-2 weeks)

**Goal:** Close critical security gaps before any production use.

| Item | Priority | Effort | Status |
|------|----------|--------|--------|
| Telegram Login Widget auth | P0 | 3 days | MISSING |
| Webhook replay protection | P0 | 1 day | MISSING |
| Per-IP rate limiting | P0 | 1 day | MISSING |
| RBAC enforcement | P0 | 2 days | MISSING |
| Dockerfiles (3 apps) | P0 | 2 days | MISSING |
| CI/CD pipeline | P1 | 2 days | MISSING |

### Phase 2: Bug Fixes & Polish (1 week)

**Goal:** Fix known broken features.

| Item | Priority | Effort | Status |
|------|----------|--------|--------|
| Command target resolution | P0 | 1 day | BROKEN |
| Join request screening | P1 | 2 days | STUB |
| Slow mode integration | P2 | 1 day | MISSING |
| Redis Cluster | P2 | 3 days | v1.3.0 |

### Phase 3: Performance Validation (1 week)

**Goal:** Validate performance claims.

| Item | Priority | Effort | Status |
|------|----------|--------|--------|
| Load testing setup | P0 | 2 days | MISSING |
| k6 scripts | P0 | 2 days | MISSING |
| Redis throughput test | P1 | 1 day | MISSING |
| PostgreSQL benchmark | P1 | 1 day | MISSING |
| Fast path profiling | P1 | 1 day | MISSING |

### Phase 4: Testing & Documentation (1 week)

**Goal:** Comprehensive test coverage.

| Item | Priority | Effort | Status |
|------|----------|--------|--------|
| Unit test coverage >70% | P0 | 3 days | 10% |
| Integration tests | P0 | 2 days | MISSING |
| E2E tests (Playwright) | P1 | 2 days | MISSING |
| API docs (Swagger) | P2 | 1 day | MISSING |
| README update | P2 | 0.5 day | PARTIAL |

### Phase 5: Production Release (1 week)

**Goal:** Ship v1.0.0.

| Item | Priority | Effort | Status |
|------|----------|--------|--------|
| Staging environment | P0 | 1 day | MISSING |
| Monitoring setup | P0 | 2 days | PARTIAL |
| Load test pass | P0 | 1 day | MISSING |
| Security audit | P1 | 2 days | MISSING |
| Penetration testing | P2 | 2 days | MISSING |

---

## v0.2.0 — Autonomous Agent Foundation

**Target:** 4-6 weeks after v1.0.0

### Features

| Feature | Description |
|---------|-------------|
| LLM Integration | Claude API for message classification |
| User Behavior Memory | Track per-user threat history |
| Cross-Group Intel | Shared blocklists between groups |
| Graduated Trust | New user → trusted based on behavior |
| Self-Improvement | Track false positives, adjust thresholds |

### Technical Work

| Item | Effort |
|------|--------|
| Anthropic SDK integration | 3 days |
| Prompt caching implementation | 2 days |
| Fallback heuristic classifier | 2 days |
| User threat history DB schema | 1 day |
| Cross-group blocklist API | 3 days |
| Behavior anomaly detection | 5 days |

---

## v0.3.0 — Scale & Reliability

**Target:** 8-10 weeks after v1.0.0

### Features

| Feature | Description |
|---------|-------------|
| Kubernetes manifests | HPA, deployments, services |
| Redis Cluster | Sharding, HA |
| PostgreSQL read replicas | Scaling reads |
| Multi-region deployment | Latency reduction |
| Advanced analytics | Grafana dashboard |

---

## v1.0.0 Feature Checklist

```
CORE (v0.1.0 MVP ✓):
[x] Monorepo workspace
[x] TypeScript base
[x] Docker Compose infra
[x] Telegram webhook receiver
[x] Fast path detection (8 detectors)
[x] Action executor with idempotency
[x] Policy engine with modes
[x] Basic dashboard (mock data)

AUTH & SECURITY (v0.2.0 TARGET):
[ ] Telegram Login Widget
[ ] Webhook replay protection
[ ] Per-IP rate limiting
[ ] RBAC enforcement
[ ] Dockerfiles
[ ] CI/CD

BUG FIXES:
[ ] Command target resolution
[ ] Join request screening
[ ] Slow mode integration

TESTING:
[ ] Unit tests (>70%)
[ ] Integration tests
[ ] Load tests
[ ] E2E tests

MONITORING:
[ ] Prometheus metrics (API)
[ ] Grafana dashboard
[ ] Alerting

v1.0.0 = Auth + Security + Testing + Monitoring
```