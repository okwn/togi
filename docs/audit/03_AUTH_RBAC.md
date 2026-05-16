# Authentication & RBAC

**Version:** 1.0.0
**Last Updated:** 2026-05-16

---

## Authentication

### Dashboard Authentication (JWT)

**Flow:**
1. User initiates Telegram auth via dashboard
2. Dashboard calls `/api/v1/auth/telegram` endpoint
3. API verifies Telegram user via bot API
4. API creates JWT session with user claims
5. API sets HttpOnly cookie: `togi_session=<jwt>`

**Session Configuration:**
```typescript
{
  httpOnly: true,
  secure: true, // HTTPS only in production
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
  domain: process.env.COOKIE_DOMAIN || undefined
}
```

**JWT Claims:**
```typescript
{
  sub: userId,           // UUID
  telegramUserId: number, // Telegram user ID
  sessionId: string,     // UUID for session tracking
  iat: number,           // Issued at
  exp: number            // Expiration
}
```

### Session Validation

Every API request validates:
1. JWT signature (HS256)
2. JWT expiration
3. Session not revoked (checked against DB)

### Session Revocation

Sessions can be revoked by:
- User logout (session deleted from DB)
- Password change (all sessions invalidated)
- Admin forced logout (future feature)

---

## RBAC (Role-Based Access Control)

### Role Hierarchy

| Role | Level | Description |
|------|-------|-------------|
| OWNER | 4 | Full control, policy management, agent control |
| SUPERVISOR | 3 | Moderate actions, report viewing |
| MODERATOR | 2 | Limited actions, warn/mute only |
| VIEWER | 1 | Read-only access |

### Permission Matrix

| Permission | OWNER | SUPERVISOR | MODERATOR | VIEWER |
|------------|-------|------------|-----------|--------|
| view_reports | ✓ | ✓ | ✓ | ✓ |
| view_audit_logs | ✓ | ✓ | ✓ | ✗ |
| manage_group_settings | ✓ | ✗ | ✗ | ✗ |
| change_policy | ✓ | ✗ | ✗ | ✗ |
| manage_admins | ✓ | ✗ | ✗ | ✗ |
| warn_user | ✓ | ✓ | ✓ | ✗ |
| mute_user | ✓ | ✓ | ✓ | ✗ |
| kick_user | ✓ | ✓ | ✗ | ✗ |
| ban_user | ✓ | ✓ | ✗ | ✗ |
| unban_user | ✓ | ✓ | ✓ | ✗ |
| manage_captchas | ✓ | ✓ | ✗ | ✗ |
| view_trust_scores | ✓ | ✓ | ✓ | ✓ |
| manage_trust | ✓ | ✓ | ✗ | ✗ |
| control_agent | ✓ | ✗ | ✗ | ✗ |
| approve_agent_actions | ✓ | ✓ | ✗ | ✗ |
| view_recommendations | ✓ | ✓ | ✓ | ✗ |
| apply_recommendation | ✓ | ✓ | ✗ | ✗ |

### RBAC Implementation

**Permission Check Flow:**
```
Request → JWT Validation → Session Check → Role Lookup → Permission Verify → Handler
```

**Code Location:** `apps/api/src/middleware/auth.ts`

```typescript
// Permission check example
async function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await getSession(request);
    if (!session) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const role = await getRole(session.userId, request.chatId);
    if (!hasPermission(role, permission)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    request.userRole = role;
  };
}
```

### Telegram Command Authorization

Bot commands are authorized based on:
1. User's role in the group
2. Command permission requirements

| Command | Required Permission |
|---------|---------------------|
| /setup | - (public to non-admin) |
| /warn | warn_user |
| /mute | mute_user |
| /ban | ban_user |
| /unban | unban_user |
| /lockdown | kick_user |
| /verify | manage_captchas |
| /trust | manage_trust |
| /weekly_report | view_reports |
| /security_status | view_reports |

---

## Webhook Authentication

### Telegram Webhook Verification

**Flow:**
1. Telegram sends POST to `/webhooks/telegram`
2. Request includes `X-Telegram-Bot-Api-Secret-Token` header
3. API compares header against `TELEGRAM_WEBHOOK_SECRET`
4. Invalid/missing secret → 401 Unauthorized

**Validation Code:**
```typescript
const secretHeader = request.headers['x-telegram-bot-api-secret-token'];
const expectedSecret = env.TELEGRAM_WEBHOOK_SECRET;

if (env.NODE_ENV === 'production' && !expectedSecret) {
  throw new Error('FATAL: TELEGRAM_WEBHOOK_SECRET not set');
}

if (expectedSecret && secretHeader !== expectedSecret) {
  return reply.status(401).send({ error: 'Unauthorized' });
}
```

---

## CSRF Protection

### CSRF Token Validation

State-changing endpoints validate CSRF token:
- Cookie: `csrf_token` (HttpOnly, Secure)
- Header: `X-CSRF-Token`

**Validation:**
```typescript
if (!csrfToken || csrfToken !== session.csrfToken) {
  return reply.status(403).send({ error: 'CSRF validation failed' });
}
```

---

## Rate Limiting on Auth

### Login Rate Limiting

```typescript
RATE_LIMIT_ABUSE_FAILED_LOGIN_WINDOW_MS: 900000  // 15 minutes
RATE_LIMIT_ABUSE_FAILED_LOGIN_MAX: 5            // 5 attempts
RATE_LIMIT_ABUSE_BLOCK_DURATION_MS: 3600000     // 1 hour block
```

After 5 failed login attempts in 15 minutes:
- User blocked for 1 hour
- Admin notification sent
- Audit log entry created

---

## Security Considerations

### Token Storage

- JWT secret: Minimum 32 characters
- Stored in environment variable
- Never logged or exposed in responses

### Session Security

- Sessions stored in PostgreSQL (not Redis)
- CSRF tokens are single-use (rotated)
- Concurrent session limit: 3 per user

### Password Requirements

For future password-based auth:
- Minimum 12 characters
- Must include: uppercase, lowercase, number, special char
- Breach detection (future: HaveIBeenPwned API)

---

## Audit Checklist

- [ ] JWT signature algorithm is HS256
- [ ] JWT secret is >= 32 characters
- [ ] Sessions expire after 7 days
- [ ] CSRF tokens validated on state-changing endpoints
- [ ] Rate limiting on login attempts
- [ ] RBAC checked server-side (not client-side)
- [ ] Webhook secret required in production
- [ ] HttpOnly, Secure, SameSite=Strict on cookies
- [ ] Failed auth logged for anomaly detection
- [ ] Session revocation works correctly