# Next 72 Hours Plan

## Immediate Priorities (72-hour sprint)

### Day 1: Security Hardening

**Morning (4h):**
- [ ] Implement webhook replay protection (`apps/api/src/routes/webhook.ts`)
  - Add Redis set `webhook:processed-ids` with 24h TTL
  - Check update_id before processing
- [ ] Add per-IP rate limiting middleware (`apps/api/src/middleware/security.ts`)
  - Add `RateLimiter` instance with per-IP key
  - Block IPs exceeding threshold

**Afternoon (4h):**
- [ ] Create Dockerfiles for all 3 apps
  - `apps/api/Dockerfile`
  - `apps/web/Dockerfile`
  - `apps/worker/Dockerfile`
- [ ] Update `docker-compose.yml` to reference correct Dockerfiles

---

### Day 2: Auth & Bug Fixes

**Morning (4h):**
- [ ] Implement Telegram Login Widget auth flow
  - Create `apps/web/src/app/login/page.tsx`
  - Create `apps/api/src/routes/auth.ts`
  - Implement `verifyInitData` for backend verification
  - Issue JWT on successful auth

**Afternoon (4h):**
- [ ] Fix command target resolution in webhook handler
  - Parse `/warn @username` correctly
  - Look up user ID via `getChatMember` or `resolveUsername`
  - Execute action on correct target
- [ ] Test all moderation commands with real Telegram test group

---

### Day 3: CI/CD & Testing

**Morning (4h):**
- [ ] Set up GitHub Actions workflow (`.github/workflows/ci.yml`)
  - Run `pnpm typecheck` on PR
  - Run `pnpm lint` on PR
  - Run `pnpm test` on PR
  - Run `docker build` on PR merge
- [ ] Add basic unit tests for detection engine
  - Test `fast-path-engine.ts` with mock Redis
  - Test `link-detector.ts` with sample URLs
  - Test `threat-detector.ts` with Turkish/English patterns

**Afternoon (4h):**
- [ ] Create load test scripts with k6
  - `tests/load/webhook.js` — webhook endpoint stress test
  - `tests/load/fast-path.js` — detection engine benchmark
- [ ] Validate fast path <20ms p95 claim

---

## Success Criteria (72h)

| Metric | Target | Measured |
|--------|--------|----------|
| Security gaps closed | 5/5 P0 items | Yes |
| Docker builds pass | All 3 apps | Yes |
| CI/CD passes | PR checks run | Yes |
| Command resolution | `/warn @user` works | Yes |
| Fast path latency | <20ms p95 | k6 validated |

---

## Owner Notes

**Do Not:**
- Modify unrelated services
- Change Docker port mappings
- Add new features beyond scope
- Merge untested code

**Do:**
- Test each fix locally before commit
- Update `FINAL_LOCAL_VALIDATION.md` with results
- Keep commit messages descriptive
- Mark items [x] when complete