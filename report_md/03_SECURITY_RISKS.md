# Security Risks

## CRITICAL — Authentication Bypass

**Risk:** Development auth middleware active in production.

**Location:** `apps/api/src/middleware/auth.ts:37-43`

```typescript
if (env.NODE_ENV === 'development') {
  request.server.addHook('onRequest', (req, _res, done) => {
    (req as FastifyRequest & AuthContext).isDevAdmin = true;
    done();
  });
  return;
}
```

**Issue:** `NODE_ENV=development` set via environment variable. If misconfigured, entire API is accessible without authentication.

**Fix Required:** Remove development auth fallback. Require Telegram Login Widget signature verification for all production requests.

---

## CRITICAL — Webhook Replay Attack

**Risk:** No deduplication of update IDs. Attackers can replay old updates.

**Location:** `apps/api/src/routes/webhook.ts`

**Issue:** `SECURITY_MODEL.md` specifies replay protection but code does not implement it. The `normalizeUpdate()` function extracts `update_id` but it is never checked against a Redis set of processed IDs.

**Impact:** Old delete-message requests could be replayed, flooding the chat.

**Fix Required:** Maintain a Redis set `webhook:processed-ids` with TTL matching Telegram's 24-hour window. Check and insert on each webhook request.

---

## HIGH — No Per-IP Rate Limiting on API

**Risk:** Single IP can exhaust API resources.

**Location:** `apps/api/src/middleware/security.ts`

**Issue:** Only per-group and per-user rate limiting exists. `ipLoggingMiddleware` logs but does not block.

**Fix Required:** Add `RateLimiter` instance for API endpoints with per-IP key. Block IPs exceeding threshold.

---

## HIGH — RBAC Not Enforced

**Risk:** Any API caller can modify any group's policies.

**Location:** `apps/api/src/routes/groups.ts`

**Issue:** `groupAdmins` table exists but no middleware checks if the requester is an admin of the target group.

**Fix Required:** Add `requireGroupAdmin(groupId, userId)` middleware that queries `groupAdmins` table.

---

## MEDIUM — Bot Token Logged in Error Messages

**Risk:** Sensitive credential in logs.

**Location:** `apps/api/src/logger.ts` and `packages/telegram-client/src/client.ts`

**Issue:** Potential for bot token appearing in error stack traces if initialization fails.

**Mitigation:** `SECURITY_MODEL.md:5-11` documents bot token safety rules. Need to verify no logging occurs.

---

## MEDIUM — Admin Command Target Resolution Flawed

**Risk:** `/warn`, `/mute`, `/ban` commands cannot resolve target users.

**Location:** `apps/api/src/routes/webhook.ts:601-885`

**Issue:** Commands like `/warn @username` parse the username but the code falls back to `event.userId` (the command sender) rather than looking up the target user's ID via Telegram API.

```typescript
// Line 623-641
const targetUserId = event.userId; // Placeholder - would need API lookup
// ...later...
const targetId = targetUserId; // Still placeholder
```

**Impact:** Moderation commands silently fail or target the wrong user.

---

## MEDIUM — Rate Limiter Uses Random in Key

**Risk:** Unnecessary Redis writes, potential key explosion.

**Location:** `apps/api/src/middleware/security.ts:37`

```typescript
await redis.zadd(key, now, `${now}_${Math.random().toString(36).slice(2)}`);
```

**Issue:** Using random suffix means keys cannot be cleaned by score alone. Should use monotonic timestamp or incremental counter.

**Fix Required:** Use timestamp as score, member as `${ip}:${requestId}` for deduplication.

---

## LOW — Unicode/Homoglyph Detection Missing

**Risk:** Attackers can disguise malicious domains using lookalike characters.

**Location:** `packages/detection-engine/src/detectors/link-detector.ts`

**Issue:** No IDN/punycode normalization or homoglyph detection. `tele-gram.com` (e with accent) passes through.

**Fix Required:** Use a library like `url-parse` with IDN support or `icu4x` for Unicode segmentation.

---

## LOW — Session Token Expiry Not Enforced

**Risk:** Stale sessions may remain valid.

**Location:** Dashboard auth (not yet implemented)

**Issue:** `SECURITY_MODEL.md:96` says "Session tokens expire after 24 hours" but no auth implementation exists to enforce this.

---

## LOW — Database Password in Container Env

**Risk:** Credentials visible in `docker-compose.yml`.

**Location:** `docker-compose.yml:8-10`

**Issue:** `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-togi_dev_password}` — default password in compose file.

**Fix Required:** Require secrets via environment, fail if not provided in production.