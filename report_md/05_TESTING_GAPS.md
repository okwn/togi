# Testing Gaps

## Test Coverage Summary

| Package | Test Files | Coverage |
|---------|-----------|----------|
| packages/shared | 2 tests | NOT MEASURED |
| packages/telegram-client | 1 test | NOT MEASURED |
| packages/detection-engine | 0 tests | NOT MEASURED |
| packages/policy-engine | 0 tests | NOT MEASURED |
| packages/config | 0 tests | NOT MEASURED |
| packages/db | 0 tests | NOT MEASURED |
| apps/api | 0 tests | NOT MEASURED |
| apps/worker | 0 tests | NOT MEASURED |

**Verdict:** <10% code coverage. Critical paths untested.

---

## MISSING — Integration Tests

**Needed:**
- Webhook → Detection → Action end-to-end
- DB CRUD operations with real database
- Redis rate limiting with real Redis
- BullMQ job processing with real queue

**Current State:** No testcontainers, no integration test suite.

---

## MISSING — E2E Tests

**Needed:**
- Telegram bot → webhook → response flow
- Dashboard login → view groups → modify policy
- Manual moderation commands via Telegram

**Current State:** No Playwright, Cypress, or Puppeteer tests.

---

## MISSING — Load/Performance Tests

**Needed:**
- k6/Artillery scripts for webhook endpoint
- Redis throughput benchmark
- PostgreSQL write benchmark
- BullMQ queue backlog test

**Current State:** No performance validation.

---

## MISSING — Chaos Tests

**Needed:**
- Redis failure → fail-open behavior
- PostgreSQL failure → queued writes
- Telegram API failure → retry queue
- API crash → restart + recovery

---

## Action Executor Test Gaps

**Existing:** `packages/telegram-client/src/__tests__/action-executor.test.ts` — 24 test cases

**Gaps:**
- No test for `executeDecision` with `DELETE_MUTE` action (lines 594-605)
- No test for `unsetLockdown` with `previousPermissions` argument
- No test for concurrent action execution (race condition on lock)
- No test for `sendAdminAlert` with all alert types

---

## Detection Engine Test Gaps

**Existing:** None

**Needed:**
- `fast-path-engine.ts` — needs 10+ test cases covering all 8 detectors
- `link-detector.ts` — needs homoglyph/punycode test cases
- `threat-detector.ts` — needs Turkish/English pattern coverage
- `text-normalizer.ts` — needs Unicode normalization tests

---

## Worker Processor Test Gaps

**Existing:** None

**Needed:**
- `action-retry.ts` — retry backoff calculation
- `domain-intel.ts` — URL analysis logic
- `raid-correlation.ts` — cross-group correlation

---

## CI/CD Missing

**Status:** No `.github/workflows/` directory exists

**Implication:** No automated test runner on pull requests. Code can be merged with failing tests.

**Required:**
1. GitHub Actions workflow
2. Run `pnpm test` on PR
3. Run `pnpm typecheck` on PR
4. Run `pnpm lint` on PR
5. Docker build test
6. Optional: deploy to staging on merge to main