# AUTH_RBAC Design Specification
**Date:** 2026-05-16
**Phase:** Phase 01 — Dashboard Authentication & RBAC
**Status:** Draft for review

---

## 1. Overview

Replace development-only dashboard access with production-grade Telegram Login Widget authentication and role-based access control (RBAC). Every dashboard API must enforce authenticated user and group-level authorization.

**Design decisions (confirmed):**

| Decision | Choice |
|----------|--------|
| OWNER bootstrapping | Telegram-verified creator → OWNER |
| CSRF protection | Double-submit cookie pattern |
| Session storage | PostgreSQL sessions table |
| Permission check on setup | Soft warn (group activates with reduced protection) |
| Telegram verification | Full HMAC-SHA256 per Telegram official spec |
| API protocol | REST + Zod runtime validation |

---

## 2. Architecture

### 2.1 Component Map

```
┌─────────────────────┐     ┌─────────────────────┐
│  Telegram Login     │     │   /setup in group    │
│  Widget (Frontend) │     │   (Telegram DM)      │
└──────────┬──────────┘     └──────────┬──────────┘
           │                          │
           ▼                          ▼
    POST /api/auth/            Bot verifies via
    telegram/callback          getChatMember API
           │                          │
           ▼                          ▼
    Validate HMAC-SHA256            │
    Verify auth_date                 ▼
    Create session            Upsert group with
    HTTP-only cookie        botAdminStatus check
           │                Promote to OWNER if first
           ▼                          │
┌──────────────────────────────────────┐
│           Auth Middleware            │
│  - Validates session cookie          │
│  - Loads user + groupAdmins           │
│  - Enforces RBAC per route            │
└──────────────────────────────────────┘
```

### 2.2 Security Invariants

1. **No dev auth in production** — `ENABLE_DEV_AUTH=true` causes fatal boot failure
2. **Server-side identity only** — Client-side Telegram user data never trusted without server validation
3. **Telegram hash validation** — Every login payload verified byte-by-byte via HMAC-SHA256
4. **auth_date freshness** — Logins older than 24 hours rejected
5. **OWNER cannot self-grant** — Role changes require existing OWNER or Telegram verification
6. **Session revocation** — All sessions can be revoked; revoked sessions are instantly invalid

---

## 3. Data Model

### 3.1 sessions — New Table

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT NOT NULL REFERENCES users(telegram_user_id),
  user_agent_hash VARCHAR(64) NOT NULL,  -- SHA-256 of User-Agent
  ip_hash VARCHAR(64) NOT NULL,          -- SHA-256 of client IP
  csrf_token VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ  -- NULL = active
);

CREATE INDEX idx_sessions_telegram_user_id ON sessions(telegram_user_id);
CREATE INDEX idx_sessions_csrf_token ON sessions(csrf_token);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

### 3.2 group_admins — Extended

| Column | Type | Notes |
|--------|------|-------|
| `role` | ENUM('OWNER','SUPERVISOR','MODERATOR','VIEWER') | NOT NULL |
| `permissions` | JSONB | Granular flags (see RBAC matrix) |
| `added_by_telegram_user_id` | BIGINT | Who granted this role |
| `verified_at` | TIMESTAMPTZ | When role was verified in group |
| `revoked_at` | TIMESTAMPTZ | NULL = active |

### 3.3 groups.status — Extended

| Status | Meaning |
|--------|---------|
| `ACTIVE` | Fully operational, bot has permissions |
| `SETUP_PENDING` | Bot added but permissions not confirmed |
| `DISABLED` | Manually disabled by OWNER |

### 3.4 audit_logs — Extended Actions

| action | When Logged |
|--------|------------|
| `LOGIN` | Successful Telegram Login Widget auth |
| `LOGOUT` | User logged out |
| `LOGIN_FAILED` | Invalid hash, expired auth_date, or revoked session |
| `ROLE_GRANT` | OWNER grants role to user |
| `ROLE_REVOKE` | OWNER revokes role from user |
| `OWNER_BOOTSTRAP` | Telegram-verified creator becomes first OWNER |
| `ACCESS_DENIED` | RBAC check failed for user |

### 3.5 users — Ensure Unique Constraint

```sql
-- telegram_user_id should already be unique, confirm schema has it
ALTER TABLE users ADD CONSTRAINT users_telegram_user_id_key UNIQUE (telegram_user_id);
```

---

## 4. Auth Endpoints

### 4.1 POST /api/auth/telegram/callback

**Purpose:** Verify Telegram Login Widget initData, create session.

**Request body:**
```typescript
{
  initData: string  // URL-encoded initData from Telegram Widget
}
```

**Validation steps:**
1. Parse URL-encoded initData into key-value pairs
2. Extract `auth_date`, `hash`, and all other fields
3. Reject if `auth_date` is older than 24 hours
4. Sort all fields alphabetically by key (excluding `hash`)
5. Build secret: `HMAC-SHA256(bot_token, "WebAppData")`
6. Build data check string: `key1=value1\nkey2=value2\n...` (sorted)
7. Compute `HMAC-SHA256(secret, data_check_string)`
8. Compare computed hash byte-by-byte with provided `hash`
9. If invalid → return 401 with `INVALID_HASH`
10. Look up or create user by `id` (telegram user id from initData)
11. Create session record in PostgreSQL
12. Generate CSRF token, store in session record
13. Set HTTP-only cookie with session ID

**Response (200):**
```typescript
{
  user: {
    id: string,
    telegramUserId: number,
    username: string | null,
    firstName: string,
    lastName: string | null
  },
  csrfToken: string  // One-time display — user must store in memory
}
```

**Errors:**
- `400` — Missing initData
- `401` — Invalid hash or expired auth_date

**Cookie:**
```http
Set-Cookie: session_id=<uuid>; HttpOnly; SameSite=Lax; Secure; Path=/; Max-Age=86400
```

---

### 4.2 GET /api/auth/me

**Purpose:** Return current authenticated user and their group memberships.

**Auth:** Session cookie required.

**Response (200):**
```typescript
{
  user: {
    id: string,
    telegramUserId: number,
    username: string | null,
    firstName: string,
    lastName: string | null,
    createdAt: string
  },
  groups: Array<{
    groupId: string,
    telegramChatId: number,
    title: string,
    role: 'OWNER' | 'SUPERVISOR' | 'MODERATOR' | 'VIEWER',
    permissions: string[],
    status: 'ACTIVE' | 'SETUP_PENDING' | 'DISABLED'
  }>
}
```

**Errors:**
- `401` — No valid session

---

### 4.3 POST /api/auth/logout

**Purpose:** Revoke current session.

**Auth:** Session cookie required.

**Response (200):**
```typescript
{ ok: true }
```

**Side effects:**
- Sets `revoked_at` on session record
- Clears session cookie

---

### 4.4 GET /api/auth/session

**Purpose:** Return session info and CSRF token for current session.

**Auth:** Session cookie required.

**Response (200):**
```typescript
{
  sessionId: string,
  expiresAt: string,
  csrfToken: string,
  user: { telegramUserId: number, username: string | null }
}
```

**Note:** CSRF token is persisted in the session record. It's returned on every call to support the double-submit pattern where the client stores it in memory.

---

### 4.5 POST /api/auth/groups/:groupId/role

**Purpose:** Grant or change a user's role within a group.

**Auth:** Session cookie + RBAC (`admins:manage` required, OWNER only).

**Request body:**
```typescript
{
  telegramUserId: number,
  role: 'SUPERVISOR' | 'MODERATOR' | 'VIEWER' | null,  // null = revoke
  grantedBy: number  // telegramUserId of grantor (from session)
}
```

**Response (200):**
```typescript
{
  ok: true,
  groupAdmin: { /* updated groupAdmin record */ }
}
```

**Authorization rules:**
- Only OWNER can change roles (including other OWNERs)
- Cannot revoke your own OWNER role
- Cannot grant OWNER role (only transfer)
- VIEWER and MODERATOR cannot access this endpoint

---

### 4.6 DELETE /api/auth/groups/:groupId/admins/:userId

**Purpose:** Remove an admin entirely (revoke role + delete record).

**Auth:** Session cookie + RBAC (`admins:manage` required, OWNER only).

**Response (200):**
```typescript
{ ok: true }
```

---

## 5. Middleware

### 5.1 Auth Middleware (`requireAuth`)

Applied to all `/api/auth/*` routes (except `/telegram/callback` which is public).

```typescript
async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  // 1. Read session_id cookie
  // 2. Lookup session in PostgreSQL — must be non-revoked, non-expired
  // 3. Load user record
  // 4. Load user's groupAdmins entries
  // 5. Attach to request: request.user, request.session, request.groupMemberships
  // 6. If invalid → 401 with appropriate error code
}
```

### 5.2 RBAC Middleware (`requirePermission(permission: string)`)

Applied to group-specific routes.

```typescript
function requirePermission(permission: string) {
  return async function(request: FastifyRequest, reply: FastifyReply) {
    // 1. requireAuth already called — user + memberships loaded
    // 2. Extract groupId from route params
    // 3. Find groupAdmin record for (user, groupId)
    // 4. Check if role has the requested permission
    // 5. If not → 403 ACCESS_DENIED, log to audit_logs
    // 6. If yes → proceed
  }
}
```

### 5.3 CSRF Middleware (`requireCsrf`)

```typescript
async function requireCsrf(request: FastifyRequest, reply: FastifyReply) {
  // 1. Read X-CSRF-Token header
  // 2. Read session.csrf_token from DB (loaded by requireAuth)
  // 3. timing-safe compare header value with stored token
  // 4. If mismatch → 403 CSRF_INVALID
  // 5. Also check Origin/Referer header
}
```

---

## 6. RBAC Matrix

| Permission | OWNER | SUPERVISOR | MODERATOR | VIEWER |
|------------|:------:|:----------:|:---------:|:------:|
| `policy:read` | ✅ | ✅ | ✅ | ✅ |
| `policy:write` | ✅ | ✅ | ❌ | ❌ |
| `admins:manage` | ✅ | ❌ | ❌ | ❌ |
| `admins:read` | ✅ | ✅ | ❌ | ❌ |
| `domainRules:manage` | ✅ | ❌ | ❌ | ❌ |
| `reviewQueue:read` | ✅ | ✅ | ✅ | ❌ |
| `reviewQueue:approve` | ✅ | ✅ | ✅ | ❌ |
| `punishments:create` | ✅ | ✅ | ✅* | ❌ |
| `punishments:read` | ✅ | ✅ | ✅ | ❌ |
| `logs:read` | ✅ | ✅ | ✅ | ❌ |
| `logs:export` | ✅ | ❌ | ❌ | ❌ |
| `group:settings` | ✅ | ✅ | ❌ | ❌ |

*MODERATOR `punishments:create` limited to max 1 hour duration

### 6.1 Default Role Permissions (JSONB in group_admins)

```typescript
const ROLE_PERMISSIONS = {
  OWNER: [
    'policy:read', 'policy:write',
    'admins:manage', 'admins:read',
    'domainRules:manage',
    'reviewQueue:read', 'reviewQueue:approve',
    'punishments:create', 'punishments:read',
    'logs:read', 'logs:export',
    'group:settings'
  ],
  SUPERVISOR: [
    'policy:read', 'policy:write',
    'admins:read',
    'reviewQueue:read', 'reviewQueue:approve',
    'punishments:create', 'punishments:read',
    'logs:read',
    'group:settings'
  ],
  MODERATOR: [
    'policy:read',
    'reviewQueue:read', 'reviewQueue:approve',
    'punishments:create', 'punishments:read',
    'logs:read'
  ],
  VIEWER: ['policy:read']
}
```

---

## 7. /setup Telegram Command Changes

**File:** `apps/api/src/routes/webhook.ts`

### 7.1 Setup Flow

```
1. User sends /setup in Telegram group
2. Bot calls getChatMember(chatId, userId) to verify user status
3. Bot calls getChatMember(chatId, botUserId) to verify its own permissions
4. Check if group exists in DB:
   a. If new group:
      - Create group record in SETUP_PENDING or ACTIVE (depending on bot perms)
      - Check if bot is creator/admin → if yes and no OWNER exists: promote user to OWNER
      - Write OWNER_BOOTSTRAP to audit_logs
   b. If existing group:
      - If OWNER already exists → do NOT auto-promote
      - Update bot admin status
5. If bot missing permissions → group status = SETUP_PENDING, warn user
6. Reply to user in group with setup status
```

### 7.2 Permission Check (Soft Warn)

```typescript
const REQUIRED_PERMISSIONS = ['can_delete_messages', 'can_restrict_members'];
const RECOMMENDED_PERMISSIONS = ['can_change_info', 'can_invite_users', 'can_pin_messages'];

async function checkBotPermissions(chatId: number) {
  const perms = await bot.checkPermissions(chatId);
  const missing = REQUIRED_PERMISSIONS.filter(p => !perms[p]);
  const warnings = RECOMMENDED_PERMISSIONS.filter(p => !perms[p]);

  return {
    isActive: missing.length === 0,
    status: missing.length === 0 ? 'ACTIVE' : 'SETUP_PENDING',
    missingRequired: missing,
    warnings
  };
}
```

---

## 8. Frontend Changes

### 8.1 Pages

| Page | Purpose |
|------|---------|
| `/login` | Telegram Login Widget button |
| `/dashboard` | Authenticated layout (redirects to /login if not auth) |
| `/dashboard/groups/[id]/settings` | OWNER/SUPERVISOR only |
| `/forbidden` | Shown when RBAC check fails |

### 8.2 Login Flow

```typescript
// 1. User clicks "Login with Telegram"
// 2. Telegram Widget opens, returns initData
// 3. POST /api/auth/telegram/callback with initData
// 4. Server validates, returns { user, csrfToken }
// 5. Frontend stores csrfToken in memory (NOT localStorage)
// 6. Redirect to /dashboard
// 7. All future requests include:
//    - Cookie: session_id (HttpOnly)
//    - Header: X-CSRF-Token: <stored csrfToken>
```

### 8.3 Auth Layout

```typescript
// apps/web/src/app/dashboard/layout.tsx
// Wraps all dashboard routes
// 1. Check for session cookie
// 2. GET /api/auth/me
// 3. If 401 → redirect to /login
// 4. Pass user + groups via React Context
// 5. Show user avatar/name in header
```

### 8.4 Permission Gating

```typescript
// usePermission(permission: string) hook
// Returns { allowed: boolean }
// Used to conditionally render UI controls:
// { allowed && <Button>Manage Policy</Button> }
```

---

## 9. Production Safety

### 9.1 Boot Validation

```typescript
// apps/api/src/server.ts
if (process.env.NODE_ENV === 'production') {
  if (process.env.ENABLE_DEV_AUTH === 'true') {
    throw new Error('FATAL: ENABLE_DEV_AUTH=true is not allowed in production');
  }
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error('FATAL: TELEGRAM_BOT_TOKEN is required');
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('FATAL: JWT_SECRET must be at least 32 characters');
  }
}
```

### 9.2 Dev Auth Guard

```typescript
// apps/api/src/middleware/auth.ts
// REMOVE all development-only auth bypasses
// No x-togi-dev-auth header, no NODE_ENV=development fallback

// Development auth ONLY if:
// 1. NODE_ENV=development
// 2. ENABLE_DEV_AUTH=true (must be explicitly set)
// 3. And only for local development, never in CI

if (process.env.NODE_ENV === 'production') {
  if (process.env.ENABLE_DEV_AUTH === 'true') {
    throw new Error('Dev auth explicitly disabled in production');
  }
}
```

---

## 10. Error Codes

| Code | HTTP Status | Description |
|------|------------|-------------|
| `AUTH_REQUIRED` | 401 | No valid session cookie |
| `SESSION_EXPIRED` | 401 | Session has expired |
| `SESSION_REVOKED` | 401 | Session was manually revoked |
| `INVALID_HASH` | 401 | Telegram initData hash mismatch |
| `AUTH_DATE_EXPIRED` | 401 | Login older than 24 hours |
| `ACCESS_DENIED` | 403 | RBAC check failed |
| `CSRF_INVALID` | 403 | CSRF token mismatch |
| `GROUP_NOT_FOUND` | 404 | Group does not exist |
| `OWNER_REQUIRED` | 403 | Operation requires OWNER role |
| `CANNOT_REVOKE_SELF` | 400 | Cannot revoke your own OWNER role |
| `VALIDATION_ERROR` | 400 | Invalid request payload |

---

## 11. Testing Requirements

### 11.1 Unit Tests

| Test | File |
|------|------|
| Valid Telegram login hash verification | `packages/auth/src/__tests__/verify-init-data.test.ts` |
| Invalid hash rejection | `packages/auth/src/__tests__/verify-init-data.test.ts` |
| Expired auth_date rejection | `packages/auth/src/__tests__/verify-init-data.test.ts` |
| Session creation | `packages/auth/src/__tests__/session.test.ts` |
| Session revocation | `packages/auth/src/__tests__/session.test.ts` |
| RBAC permission checks | `packages/auth/src/__tests__/rbac.test.ts` |
| CSRF validation | `packages/auth/src/__tests__/csrf.test.ts` |

### 11.2 Integration Tests

| Test | Description |
|------|-------------|
| `POST /api/auth/telegram/callback` → valid session | Full login flow |
| `GET /api/auth/me` → 401 without session | Auth guard |
| `POST /api/auth/logout` → session revoked | Logout flow |
| `POST /api/auth/groups/:id/role` → 403 as VIEWER | RBAC enforcement |
| `POST /api/auth/groups/:id/role` → 200 as OWNER | RBAC allowed |
| Dev auth fails in production | Boot validation |

---

## 12. Files to Create

```
packages/auth/                          # NEW package
├── src/
│   ├── index.ts                       # Exports
│   ├── verify-init-data.ts           # Telegram HMAC-SHA256 verification
│   ├── session.ts                    # Session CRUD operations
│   ├── csrf.ts                       # CSRF token generation/validation
│   ├── rbac.ts                       # Permission checking utilities
│   ├── middleware/
│   │   ├── auth.ts                  # requireAuth middleware
│   │   ├── csrf.ts                  # requireCsrf middleware
│   │   └── rbac.ts                  # requirePermission middleware
│   ├── routes/
│   │   └── auth.ts                  # Auth API routes
│   ├── __tests__/
│   │   ├── verify-init-data.test.ts
│   │   ├── session.test.ts
│   │   ├── rbac.test.ts
│   │   └── csrf.test.ts
│   └── types.ts                     # Auth-specific types

apps/api/src/
├── routes/
│   └── groups.ts                    # Update with RBAC middleware
├── middleware/
│   └── auth.ts                     # REMOVE dev auth, add production auth
├── server.ts                       # Add production boot validation
└── services/
    └── new-member-service.ts       # May need session context

packages/db/src/
├── schema.ts                       # Add sessions table, extend group_admins
└── migrate.ts                      # Migration for new tables
```

---

## 13. Spec Self-Review

- [ ] No "TODO" or "TBD" placeholders
- [ ] All error codes have HTTP status
- [ ] RBAC matrix covers all permissions listed in spec
- [ ] /setup flow handles all 9 rules from spec
- [ ] CSRF flow is complete (generation → storage → validation)
- [ ] Production boot failure is comprehensive
- [ ] No contradictory sections
- [ ] Scope is focused (auth + RBAC only, no unrelated features)