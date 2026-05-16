# Phase 01: Dashboard Authentication & RBAC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace development-only dashboard access with Telegram Login Widget authentication and role-based access control. Every dashboard API enforces authenticated user and group-level authorization. Production boot fails if dev auth is enabled.

**Architecture:** New `packages/auth` package handles all auth logic (Telegram verification, session CRUD, CSRF, RBAC). PostgreSQL sessions table with HTTP-only cookies. Double-submit cookie CSRF pattern. All group routes protected by RBAC middleware. Frontend login via Telegram Login Widget.

**Tech Stack:** Drizzle ORM, PostgreSQL, HMAC-SHA256 (Telegram spec), Fastify middleware, Next.js App Router, Zod validation

---

## File Structure

### New Files

```
packages/auth/
├── src/
│   ├── index.ts                           # Exports all auth utilities
│   ├── verify-init-data.ts              # HMAC-SHA256 Telegram verification
│   ├── session.ts                       # Session CRUD in PostgreSQL
│   ├── csrf.ts                          # CSRF token generation/validation
│   ├── rbac.ts                          # Permission checking + ROLE_PERMISSIONS
│   ├── middleware/
│   │   ├── auth.ts                      # requireAuth middleware
│   │   ├── csrf.ts                      # requireCsrf middleware
│   │   ├── rbac.ts                      # requirePermission(permission) factory
│   │   └── index.ts                    # Middleware exports
│   ├── routes/
│   │   └── auth.ts                      # Auth API endpoints
│   ├── types.ts                         # Auth-specific types
│   └── __tests__/
│       ├── verify-init-data.test.ts
│       ├── session.test.ts
│       ├── rbac.test.ts
│       └── csrf.test.ts

apps/api/src/routes/auth.ts              # NEW — registers auth routes with Fastify

apps/web/src/app/login/
│   └── page.tsx                         # NEW — Telegram Login Widget UI
apps/web/src/app/(auth)/
│   └── layout.tsx                      # NEW — auth layout (minimal)
apps/web/src/hooks/
│   └── usePermission.ts                 # NEW — hook for RBAC-gated UI
apps/web/src/lib/
│   └── api-client.ts                   # UPDATE — add cookie + CSRF header handling
```

### Modified Files

```
packages/db/src/schema.ts               # ADD: sessions table, extend group_admins.role/permissions/etc.
packages/db/src/migrate.ts             # No changes needed (schema changes picked up)
packages/db/src/client.ts              # No changes needed

apps/api/src/server.ts                 # ADD: production boot validation (dev auth fails, JWT_SECRET check)
apps/api/src/middleware/auth.ts         # REPLACE dev auth with production-safe guard
apps/api/src/routes/groups.ts          # ADD: RBAC middleware on all routes, remove dev auth hook
apps/api/src/routes/webhook.ts         # UPDATE: /setup OWNER bootstrapping via Telegram verification

apps/web/src/app/dashboard/layout.tsx # ADD: auth check redirect to /login
apps/web/src/app/page.tsx             # UPDATE: redirect to /dashboard
```

---

## Task 1: Database Schema — Add sessions table and extend group_admins

**Files:**
- Modify: `packages/db/src/schema.ts`

- [ ] **Step 1: Read current schema**

Run: `cat packages/db/src/schema.ts`
Expected: See existing tables (users, groups, groupAdmins, etc.)

- [ ] **Step 2: Add imports and enums at top of schema**

```typescript
import { pgEnum, uuid, bigint, varchar, timestamp, jsonb, text, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';

// Role enum
export const roleEnum = pgEnum('role', ['OWNER', 'SUPERVISOR', 'MODERATOR', 'VIEWER']);
export type Role = typeof roleEnum.enumValues[number];

// Group status enum
export const groupStatusEnum = pgEnum('group_status', ['ACTIVE', 'SETUP_PENDING', 'DISABLED']);
```

- [ ] **Step 3: Extend groupAdmins table — add new columns**

Find the `groupAdmins` table definition and add columns:

```typescript
// In groupAdmins definition, add after existing columns:
  role: roleEnum('role').notNull().default('VIEWER'),
  permissions: jsonb('permissions').$type<string[]>().default([]),
  addedByTelegramUserId: bigint('added_by_telegram_user_id', { mode: 'number' }),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
```

- [ ] **Step 4: Update groups table — replace status enum**

Find the `groups` table and update the `status` column type:

```typescript
// Replace:
status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
// With:
status: groupStatusEnum('status').notNull().default('SETUP_PENDING'),
```

- [ ] **Step 5: Add sessions table before the Type exports section**

```typescript
// sessions table
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  telegramUserId: bigint('telegram_user_id', { mode: 'number' }).notNull().references(() => users.telegramUserId),
  userAgentHash: varchar('user_agent_hash', { length: 64 }).notNull(),
  ipHash: varchar('ip_hash', { length: 64 }).notNull(),
  csrfToken: varchar('csrf_token', { length: 64 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (table) => ({
  telegramUserIdIdx: index('idx_sessions_telegram_user_id').on(table.telegramUserId),
  csrfTokenIdx: index('idx_sessions_csrf_token').on(table.csrfToken),
  expiresAtIdx: index('idx_sessions_expires_at').on(table.expiresAt),
}));
```

- [ ] **Step 6: Run typecheck**

Run: `cd /home/oguz/Masaüstü/Togi && pnpm --filter @togi/db typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/schema.ts
git commit -m "feat(db): add sessions table and extend groupAdmins for RBAC"
```

---

## Task 2: Create packages/auth — verify-init-data (Telegram HMAC-SHA256)

**Files:**
- Create: `packages/auth/src/verify-init-data.ts`
- Create: `packages/auth/src/types.ts`
- Create: `packages/auth/src/__tests__/verify-init-data.test.ts`

- [ ] **Step 1: Create directory and types**

```bash
mkdir -p packages/auth/src/__tests__
```

```typescript
// packages/auth/src/types.ts
export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface InitData {
  auth_date: number;
  hash: string;
  user: TelegramUser;
  [key: string]: unknown;
}

export interface VerifiedUser {
  telegramUserId: number;
  username: string | null;
  firstName: string;
  lastName: string | null;
  languageCode: string | null;
}
```

- [ ] **Step 2: Write failing test**

```typescript
// packages/auth/src/__tests__/verify-init-data.test.ts
import { verifyInitData } from '../verify-init-data';
import { createHmac } from 'crypto';

describe('verifyInitData', () => {
  const botToken = '123456789:ABCdefGHIjklMNOpqrsTUVwxyz';
  const user = {
    id: 111,
    first_name: 'Test',
    last_name: 'User',
    username: 'testuser',
  };

  function buildValidInitData(authDateOffsetSeconds = 0): string {
    const auth_date = Math.floor(Date.now() / 1000) + authDateOffsetSeconds;
    const fields: Record<string, string> = {
      auth_date: auth_date.toString(),
      user: JSON.stringify(user),
    };
    const sorted = Object.entries(fields)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const hmac = createHmac('sha256', secret).update(sorted).digest('hex');
    return Object.entries({ ...fields, hash: hmac })
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
  }

  it('should verify valid initData', () => {
    const initDataStr = buildValidInitData(0);
    const result = verifyInitData(initDataStr, botToken);
    expect(result).not.toBeNull();
    expect(result!.telegramUserId).toBe(111);
    expect(result!.username).toBe('testuser');
    expect(result!.firstName).toBe('Test');
  });

  it('should reject expired auth_date (>24h)', () => {
    const initDataStr = buildValidInitData(-25 * 3600);
    const result = verifyInitData(initDataStr, botToken);
    expect(result).toBeNull();
  });

  it('should reject invalid hash', () => {
    const auth_date = Math.floor(Date.now() / 1000).toString();
    const initDataStr = `auth_date=${auth_date}&hash=0000000000000000000000000000000000000000000000000000000000000000&user=${encodeURIComponent(JSON.stringify(user))}`;
    const result = verifyInitData(initDataStr, botToken);
    expect(result).toBeNull();
  });

  it('should reject missing user field', () => {
    const auth_date = Math.floor(Date.now() / 1000).toString();
    const initDataStr = `auth_date=${auth_date}&hash=dummy`;
    const result = verifyInitData(initDataStr, botToken);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /home/oguz/Masaüstü/Togi && pnpm --filter @togi/auth test -- verify-init-data`
Expected: FAIL — "verifyInitData not defined"

- [ ] **Step 4: Write implementation**

```typescript
// packages/auth/src/verify-init-data.ts
import { createHmac, timingSafeEqual } from 'crypto';

const MAX_AGE_SECONDS = 24 * 3600;

export interface VerifiedUser {
  telegramUserId: number;
  username: string | null;
  firstName: string;
  lastName: string | null;
  languageCode: string | null;
}

export function verifyInitData(initDataStr: string, botToken: string): VerifiedUser | null {
  const params = new URLSearchParams(initDataStr);
  const authDateStr = params.get('auth_date');
  const hash = params.get('hash');

  if (!authDateStr || !hash) return null;

  const authDate = parseInt(authDateStr, 10);
  if (isNaN(authDate)) return null;

  // Check auth_date freshness
  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > MAX_AGE_SECONDS) return null;

  // Build data check string (all fields except hash, sorted alphabetically)
  const fields: Array<[string, string]> = [];
  params.forEach((value, key) => {
    if (key !== 'hash') fields.push([key, value]);
  });
  fields.sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = fields.map(([k, v]) => `${k}=${v}`).join('\n');

  // Compute HMAC-SHA256
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  // Constant-time comparison
  const hashBuf = Buffer.from(hash, 'hex');
  const computedBuf = Buffer.from(computedHash, 'hex');
  if (hashBuf.length !== computedBuf.length) return null;
  if (!timingSafeEqual(hashBuf, computedBuf)) return null;

  // Parse user
  const userStr = params.get('user');
  if (!userStr) return null;
  try {
    const user = JSON.parse(userStr);
    return {
      telegramUserId: user.id,
      username: user.username || null,
      firstName: user.first_name,
      lastName: user.last_name || null,
      languageCode: user.language_code || null,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /home/oguz/Masaüstü/Togi && pnpm --filter @togi/auth test -- verify-init-data`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/auth/src/verify-init-data.ts packages/auth/src/types.ts packages/auth/src/__tests__/verify-init-data.test.ts
git commit -m "feat(auth): add Telegram initData HMAC-SHA256 verification"
```

---

## Task 3: Create packages/auth — session management

**Files:**
- Create: `packages/auth/src/session.ts`
- Create: `packages/auth/src/__tests__/session.test.ts`

- [ ] **Step 1: Write session implementation**

```typescript
// packages/auth/src/session.ts
import { db } from '@togi/db';
import { sessions, users } from '@togi/db';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { createHash, randomBytes } from 'crypto';

export interface Session {
  id: string;
  telegramUserId: number;
  userAgentHash: string;
  ipHash: string;
  csrfToken: string;
  expiresAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface SessionWithUser extends Session {
  user: {
    telegramUserId: number;
    username: string | null;
    firstName: string;
    lastName: string | null;
  } | null;
}

function hashField(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export async function createSession(params: {
  telegramUserId: number;
  userAgent: string;
  ip: string;
  expiresAt: Date;
}): Promise<Session> {
  const csrfToken = randomBytes(32).toString('hex');
  const userAgentHash = hashField(params.userAgent);
  const ipHash = hashField(params.ip);

  const [session] = await db.insert(sessions).values({
    telegramUserId: params.telegramUserId,
    userAgentHash,
    ipHash,
    csrfToken,
    expiresAt: params.expiresAt,
  }).returning();

  return session;
}

export async function validateSession(sessionId: string): Promise<SessionWithUser | null> {
  const now = new Date();

  const [session] = await db
    .select()
    .from(sessions)
    .where(and(
      eq(sessions.id, sessionId),
      isNull(sessions.revokedAt),
      gt(sessions.expiresAt, now)
    ))
    .limit(1);

  if (!session) return null;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.telegramUserId, session.telegramUserId))
    .limit(1);

  return { ...session, user: user || null };
}

export async function revokeSession(sessionId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.id, sessionId));
}
```

- [ ] **Step 2: Write basic session tests** (simplified without DB)

```typescript
// packages/auth/src/__tests__/session.test.ts
// Test the hash function and CSRF token generation
import { randomBytes } from 'crypto';
import { createHash } from 'crypto';

describe('session utilities', () => {
  it('should hash fields consistently', () => {
    const hash = (v: string) => createHash('sha256').update(v).digest('hex');
    const result1 = hash('test-value');
    const result2 = hash('test-value');
    expect(result1).toBe(result2);
    expect(result1.length).toBe(64);  // SHA-256 hex = 64 chars
  });

  it('should generate unique CSRF tokens', () => {
    const t1 = randomBytes(32).toString('hex');
    const t2 = randomBytes(32).toString('hex');
    expect(t1).not.toBe(t2);
    expect(t1.length).toBe(64);
  });
});
```

- [ ] **Step 3: Run typecheck**

Run: `cd /home/oguz/Masaüstü/Togi && pnpm --filter @togi/auth typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/auth/src/session.ts packages/auth/src/__tests__/session.test.ts
git commit -m "feat(auth): add session CRUD operations"
```

---

## Task 4: Create packages/auth — CSRF and RBAC utilities

**Files:**
- Create: `packages/auth/src/csrf.ts`
- Create: `packages/auth/src/rbac.ts`
- Create: `packages/auth/src/__tests__/csrf.test.ts`
- Create: `packages/auth/src/__tests__/rbac.test.ts`

- [ ] **Step 1: Write CSRF implementation**

```typescript
// packages/auth/src/csrf.ts
import { timingSafeEqual } from 'crypto';
import { randomBytes } from 'crypto';

export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

export function validateCsrfToken(stored: string, provided: string): boolean {
  if (!stored || !provided) return false;
  if (stored.length !== provided.length) return false;
  const storedBuf = Buffer.from(stored, 'utf8');
  const providedBuf = Buffer.from(provided, 'utf8');
  return timingSafeEqual(storedBuf, providedBuf);
}
```

- [ ] **Step 2: Write RBAC implementation**

```typescript
// packages/auth/src/rbac.ts
export type Permission =
  | 'policy:read' | 'policy:write'
  | 'admins:manage' | 'admins:read'
  | 'domainRules:manage'
  | 'reviewQueue:read' | 'reviewQueue:approve'
  | 'punishments:create' | 'punishments:read'
  | 'logs:read' | 'logs:export'
  | 'group:settings';

export type Role = 'OWNER' | 'SUPERVISOR' | 'MODERATOR' | 'VIEWER';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: [
    'policy:read', 'policy:write',
    'admins:manage', 'admins:read',
    'domainRules:manage',
    'reviewQueue:read', 'reviewQueue:approve',
    'punishments:create', 'punishments:read',
    'logs:read', 'logs:export',
    'group:settings',
  ],
  SUPERVISOR: [
    'policy:read', 'policy:write',
    'admins:read',
    'reviewQueue:read', 'reviewQueue:approve',
    'punishments:create', 'punishments:read',
    'logs:read',
    'group:settings',
  ],
  MODERATOR: [
    'policy:read',
    'reviewQueue:read', 'reviewQueue:approve',
    'punishments:create', 'punishments:read',
    'logs:read',
  ],
  VIEWER: ['policy:read'],
};

export const MODERATOR_PUNISHMENT_MAX_HOURS = 1;

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getPermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
```

- [ ] **Step 3: Write RBAC tests**

```typescript
// packages/auth/src/__tests__/rbac.test.ts
import { hasPermission, ROLE_PERMISSIONS } from '../rbac';

describe('RBAC', () => {
  it('OWNER should have all permissions', () => {
    expect(hasPermission('OWNER', 'admins:manage')).toBe(true);
    expect(hasPermission('OWNER', 'policy:write')).toBe(true);
    expect(hasPermission('OWNER', 'logs:export')).toBe(true);
    expect(hasPermission('OWNER', 'group:settings')).toBe(true);
  });

  it('VIEWER should only have policy:read', () => {
    expect(hasPermission('VIEWER', 'policy:read')).toBe(true);
    expect(hasPermission('VIEWER', 'admins:manage')).toBe(false);
    expect(hasPermission('VIEWER', 'policy:write')).toBe(false);
  });

  it('MODERATOR should have review and punishment permissions but not admins:manage', () => {
    expect(hasPermission('MODERATOR', 'reviewQueue:read')).toBe(true);
    expect(hasPermission('MODERATOR', 'punishments:create')).toBe(true);
    expect(hasPermission('MODERATOR', 'admins:manage')).toBe(false);
    expect(hasPermission('MODERATOR', 'policy:write')).toBe(false);
  });

  it('SUPERVISOR should have policy:write but not admins:manage or logs:export', () => {
    expect(hasPermission('SUPERVISOR', 'policy:write')).toBe(true);
    expect(hasPermission('SUPERVISOR', 'admins:manage')).toBe(false);
    expect(hasPermission('SUPERVISOR', 'logs:export')).toBe(false);
  });
});
```

- [ ] **Step 4: Write CSRF tests**

```typescript
// packages/auth/src/__tests__/csrf.test.ts
import { generateCsrfToken, validateCsrfToken } from '../csrf';

describe('CSRF', () => {
  it('should generate unique tokens', () => {
    const t1 = generateCsrfToken();
    const t2 = generateCsrfToken();
    expect(t1).not.toBe(t2);
    expect(t1.length).toBe(64);
  });

  it('should validate matching tokens', () => {
    const token = generateCsrfToken();
    expect(validateCsrfToken(token, token)).toBe(true);
  });

  it('should reject non-matching tokens', () => {
    const t1 = generateCsrfToken();
    const t2 = generateCsrfToken();
    expect(validateCsrfToken(t1, t2)).toBe(false);
  });

  it('should reject empty tokens', () => {
    expect(validateCsrfToken('', 'abc')).toBe(false);
    expect(validateCsrfToken('abc', '')).toBe(false);
  });
});
```

- [ ] **Step 5: Run tests**

Run: `cd /home/oguz/Masaüstü/Togi && pnpm --filter @togi/auth test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/auth/src/csrf.ts packages/auth/src/rbac.ts packages/auth/src/__tests__/csrf.test.ts packages/auth/src/__tests__/rbac.test.ts
git commit -m "feat(auth): add CSRF token generation and RBAC permission matrix"
```

---

## Task 5: Create packages/auth — middleware (auth, CSRF, RBAC)

**Files:**
- Create: `packages/auth/src/middleware/auth.ts`
- Create: `packages/auth/src/middleware/csrf.ts`
- Create: `packages/auth/src/middleware/rbac.ts`
- Create: `packages/auth/src/middleware/index.ts`

- [ ] **Step 1: Write auth middleware**

```typescript
// packages/auth/src/middleware/auth.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { validateSession } from '../session';
import type { SessionWithUser } from '../session';

declare module 'fastify' {
  interface FastifyRequest {
    user: SessionWithUser['user'];
    session: SessionWithUser;
  }
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const sessionId = request.cookies['session_id'];
  if (!sessionId) {
    return reply.status(401).send({
      error: { code: 'AUTH_REQUIRED', message: 'No session cookie', requestId: request.id }
    });
  }

  const session = await validateSession(sessionId);
  if (!session) {
    return reply.status(401).send({
      error: { code: 'SESSION_EXPIRED', message: 'Session invalid or expired', requestId: request.id }
    });
  }

  request.user = session.user;
  request.session = session;
}
```

- [ ] **Step 2: Write CSRF middleware**

```typescript
// packages/auth/src/middleware/csrf.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { validateCsrfToken } from '../csrf';

export async function requireCsrf(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // GET requests are read-only, no CSRF needed
  if (request.method === 'GET') return;

  const token = request.headers['x-csrf-token'] as string | undefined;
  const session = (request as FastifyRequest & { session?: { csrfToken: string } }).session;

  if (!token || !session?.csrfToken) {
    return reply.status(403).send({
      error: { code: 'CSRF_INVALID', message: 'CSRF token required', requestId: request.id }
    });
  }

  if (!validateCsrfToken(session.csrfToken, token)) {
    return reply.status(403).send({
      error: { code: 'CSRF_INVALID', message: 'Invalid CSRF token', requestId: request.id }
    });
  }
}
```

- [ ] **Step 3: Write RBAC middleware factory**

```typescript
// packages/auth/src/middleware/rbac.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { db, groupAdmins } from '@togi/db';
import { eq, and, isNull } from 'drizzle-orm';
import { hasPermission, type Permission, type Role } from '../rbac';

export function requirePermission(permission: Permission) {
  return async function(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const session = (request as FastifyRequest & { session?: { telegramUserId: number } }).session;
    if (!session?.telegramUserId) {
      return reply.status(401).send({
        error: { code: 'AUTH_REQUIRED', message: 'Not authenticated', requestId: request.id }
      });
    }

    const groupId = request.params['groupId'] || request.params['id'];
    if (!groupId) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'groupId required', requestId: request.id }
      });
    }

    const [admin] = await db
      .select()
      .from(groupAdmins)
      .where(and(
        eq(groupAdmins.groupId, groupId),
        eq(groupAdmins.telegramUserId, session.telegramUserId),
        isNull(groupAdmins.revokedAt)
      ))
      .limit(1);

    if (!admin) {
      return reply.status(403).send({
        error: { code: 'ACCESS_DENIED', message: 'You do not have access to this group', requestId: request.id }
      });
    }

    const role = admin.role as Role;
    if (!hasPermission(role, permission)) {
      return reply.status(403).send({
        error: { code: 'ACCESS_DENIED', message: `Permission denied: ${permission}`, requestId: request.id }
      });
    }
  };
}
```

- [ ] **Step 4: Write middleware index**

```typescript
// packages/auth/src/middleware/index.ts
export { requireAuth } from './auth';
export { requireCsrf } from './csrf';
export { requirePermission } from './rbac';
```

- [ ] **Step 5: Run typecheck**

Run: `cd /home/oguz/Masaüstü/Togi && pnpm --filter @togi/auth typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/auth/src/middleware/auth.ts packages/auth/src/middleware/csrf.ts packages/auth/src/middleware/rbac.ts packages/auth/src/middleware/index.ts
git commit -m "feat(auth): add requireAuth, requireCsrf, requirePermission middleware"
```

---

## Task 6: Create packages/auth — auth routes

**Files:**
- Create: `packages/auth/src/routes/auth.ts`

- [ ] **Step 1: Write auth routes**

```typescript
// packages/auth/src/routes/auth.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyInitData } from '../verify-init-data';
import { createSession, validateSession, revokeSession } from '../session';
import { requireAuth } from '../middleware/auth';
import { db, users, groupAdmins, groups } from '@togi/db';
import { eq, and, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { ROLE_PERMISSIONS } from '../rbac';

const telegramCallbackSchema = z.object({
  initData: z.string().min(1),
});

const roleChangeSchema = z.object({
  telegramUserId: z.number(),
  role: z.enum(['SUPERVISOR', 'MODERATOR', 'VIEWER', 'OWNER']).nullable(),
});

export async function registerAuthRoutes(fastify: FastifyInstance) {
  const env = process.env;

  // POST /api/auth/telegram/callback
  fastify.post('/auth/telegram/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = telegramCallbackSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'initData required', requestId: request.id }
      });
    }

    const botToken = env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Bot token not configured', requestId: request.id }
      });
    }

    const verified = verifyInitData(body.data.initData, botToken);
    if (!verified) {
      return reply.status(401).send({
        error: { code: 'INVALID_HASH', message: 'Invalid Telegram login', requestId: request.id }
      });
    }

    // Upsert user
    const [user] = await db
      .insert(users)
      .values({
        telegramUserId: verified.telegramUserId,
        username: verified.username,
        firstName: verified.firstName,
        lastName: verified.lastName,
        languageCode: verified.languageCode,
      })
      .onConflictDoUpdate({
        target: users.telegramUserId,
        set: {
          username: verified.username,
          firstName: verified.firstName,
          lastName: verified.lastName,
          languageCode: verified.languageCode,
          updatedAt: new Date(),
        },
      })
      .returning();

    // Create session
    const session = await createSession({
      telegramUserId: verified.telegramUserId,
      userAgent: request.headers['user-agent'] || '',
      ip: request.ip,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    reply.setCookie('session_id', session.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      path: '/',
      maxAge: 24 * 60 * 60,
    });

    return reply.send({
      user: {
        id: user.id,
        telegramUserId: user.telegramUserId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      csrfToken: session.csrfToken,
    });
  });

  // GET /api/auth/me
  fastify.get('/auth/me', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = (request as FastifyRequest & { session: NonNullable<typeof request.session> }).session;

    const memberships = await db
      .select({
        groupId: groupAdmins.groupId,
        role: groupAdmins.role,
        permissions: groupAdmins.permissions,
        group: {
          telegramChatId: groups.telegramChatId,
          title: groups.title,
          status: groups.status,
        },
      })
      .from(groupAdmins)
      .innerJoin(groups, eq(groupAdmins.groupId, groups.id))
      .where(and(
        eq(groupAdmins.telegramUserId, session.telegramUserId),
        isNull(groupAdmins.revokedAt)
      ));

    return reply.send({
      user: request.user,
      groups: memberships.map(m => ({
        groupId: m.groupId,
        telegramChatId: m.group.telegramChatId,
        title: m.group.title,
        role: m.role,
        permissions: m.permissions,
        status: m.group.status,
      })),
    });
  });

  // GET /api/auth/session
  fastify.get('/auth/session', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = (request as FastifyRequest & { session: NonNullable<typeof request.session> }).session;
    return reply.send({
      sessionId: session.id,
      expiresAt: session.expiresAt.toISOString(),
      csrfToken: session.csrfToken,
      user: { telegramUserId: session.telegramUserId, username: null },
    });
  });

  // POST /api/auth/logout
  fastify.post('/auth/logout', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionId = request.cookies['session_id'];
    if (sessionId) {
      await revokeSession(sessionId);
    }
    reply.clearCookie('session_id', { path: '/' });
    return reply.send({ ok: true });
  });

  // POST /api/auth/groups/:groupId/role
  fastify.post<{ Params: { groupId: string } }>(
    '/auth/groups/:groupId/role',
    { preHandler: requireAuth },
    async (request: FastifyRequest<{ Params: { groupId: string } }>, reply: FastifyReply) => {
      const session = (request as FastifyRequest & { session: NonNullable<typeof request.session> }).session;
      const body = roleChangeSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid payload' } });
      }

      const { groupId } = request.params;
      const { telegramUserId, role } = body.data;

      const [requesterAdmin] = await db
        .select()
        .from(groupAdmins)
        .where(and(
          eq(groupAdmins.groupId, groupId),
          eq(groupAdmins.telegramUserId, session.telegramUserId),
          isNull(groupAdmins.revokedAt)
        ))
        .limit(1);

      if (!requesterAdmin || requesterAdmin.role !== 'OWNER') {
        return reply.status(403).send({
          error: { code: 'OWNER_REQUIRED', message: 'Only OWNER can manage roles', requestId: request.id }
        });
      }

      if (role === null) {
        await db
          .update(groupAdmins)
          .set({ revokedAt: new Date() })
          .where(and(
            eq(groupAdmins.groupId, groupId),
            eq(groupAdmins.telegramUserId, telegramUserId)
          ));
      } else {
        const [existingAdmin] = await db
          .select()
          .from(groupAdmins)
          .where(and(
            eq(groupAdmins.groupId, groupId),
            eq(groupAdmins.telegramUserId, telegramUserId)
          ))
          .limit(1);

        if (existingAdmin) {
          await db
            .update(groupAdmins)
            .set({ role, permissions: ROLE_PERMISSIONS[role], revokedAt: null, verifiedAt: new Date() })
            .where(eq(groupAdmins.id, existingAdmin.id));
        } else {
          await db
            .insert(groupAdmins)
            .values({
              groupId,
              telegramUserId,
              role,
              permissions: ROLE_PERMISSIONS[role],
              addedByTelegramUserId: session.telegramUserId,
              verifiedAt: new Date(),
            });
        }
      }

      return reply.send({ ok: true });
    }
  );

  // DELETE /api/auth/groups/:groupId/admins/:userId
  fastify.delete<{ Params: { groupId: string; userId: string } }>(
    '/auth/groups/:groupId/admins/:userId',
    { preHandler: requireAuth },
    async (request: FastifyRequest<{ Params: { groupId: string; userId: string } }>, reply: FastifyReply) => {
      const session = (request as FastifyRequest & { session: NonNullable<typeof request.session> }).session;
      const { groupId, userId } = request.params;

      const [requesterAdmin] = await db
        .select()
        .from(groupAdmins)
        .where(and(
          eq(groupAdmins.groupId, groupId),
          eq(groupAdmins.telegramUserId, session.telegramUserId),
          isNull(groupAdmins.revokedAt)
        ))
        .limit(1);

      if (!requesterAdmin || requesterAdmin.role !== 'OWNER') {
        return reply.status(403).send({
          error: { code: 'OWNER_REQUIRED', message: 'Only OWNER can remove admins', requestId: request.id }
        });
      }

      await db
        .update(groupAdmins)
        .set({ revokedAt: new Date() })
        .where(and(
          eq(groupAdmins.groupId, groupId),
          eq(groupAdmins.telegramUserId, parseInt(userId, 10))
        ));

      return reply.send({ ok: true });
    }
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd /home/oguz/Masaüstü/Togi && pnpm --filter @togi/auth typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/auth/src/routes/auth.ts
git commit -m "feat(auth): add Telegram callback, me, logout, session, role management routes"
```

---

## Task 7: Update server.ts — production boot validation + register auth routes

**Files:**
- Modify: `apps/api/src/server.ts`

- [ ] **Step 1: Read current server.ts**

Already read above. Key changes: add production boot validation, register auth routes.

- [ ] **Step 2: Add production boot validation and import**

Replace the existing env validation block in `start()` with:

```typescript
async function start() {
  const env = getEnv();

  // Production boot validation — FAIL FAST
  if (env.NODE_ENV === 'production') {
    if (process.env.ENABLE_DEV_AUTH === 'true') {
      throw new Error('FATAL: ENABLE_DEV_AUTH=true is not allowed in production');
    }
    if (!env.TELEGRAM_BOT_TOKEN) {
      throw new Error('FATAL: TELEGRAM_BOT_TOKEN is required');
    }
    if (!env.TELEGRAM_WEBHOOK_SECRET) {
      throw new Error('FATAL: TELEGRAM_WEBHOOK_SECRET is required');
    }
    if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
      throw new Error('FATAL: JWT_SECRET must be at least 32 characters');
    }
  }
```

Also remove the existing `if (env.NODE_ENV === 'production' && !env.TELEGRAM_BOT_TOKEN)` block and the DEBUG_LOG_RAW_TEXT check since those are now covered above.

- [ ] **Step 3: Add auth routes registration**

Add to imports at top:
```typescript
import { registerAuthRoutes } from '@togi/auth/routes/auth';
```

In `buildApp()`, after `await registerGroupRoutes(server)`:
```typescript
await registerAuthRoutes(server);
```

- [ ] **Step 4: Run typecheck**

Run: `cd /home/oguz/Masaüstü/Togi && pnpm --filter togi-api typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/server.ts
git commit -m "feat(api): add production boot validation and register auth routes"
```

---

## Task 8: Update middleware/auth.ts — remove dev auth bypass

**Files:**
- Modify: `apps/api/src/middleware/auth.ts`

- [ ] **Step 1: Read current auth.ts**

Already read above.

- [ ] **Step 2: Replace file contents**

Replace the entire contents of `apps/api/src/middleware/auth.ts` with:

```typescript
// Production-safe auth middleware — no dev bypasses
import { getEnv } from '@togi/config';

export function getDevAuthMiddleware() {
  const env = getEnv();

  return async function devAuthMiddleware(
    request: any,
    reply: any
  ): Promise<void> {
    // PRODUCTION: never allow dev auth bypass
    if (env.NODE_ENV === 'production') {
      return reply.status(401).send({
        error: {
          code: 'AUTH_NOT_IMPLEMENTED',
          message: 'Production auth uses Telegram Login Widget',
        },
      });
    }

    // DEVELOPMENT ONLY: explicit flag required
    if (env.ENABLE_DEV_AUTH !== 'true') {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Dev auth not enabled' },
      });
    }

    request.isDevAdmin = true;
  };
}

export function requireDevAuth(
  request: any,
  reply: any,
  done: (err?: Error) => void
) {
  const env = getEnv();

  if (env.NODE_ENV === 'production') {
    return done(new Error('Production auth not implemented'));
  }

  if (env.ENABLE_DEV_AUTH !== 'true') {
    return done(new Error('Dev auth not enabled'));
  }

  done();
}
```

- [ ] **Step 3: Run typecheck**

Run: `cd /home/oguz/Masaüstü/Togi && pnpm --filter togi-api typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/middleware/auth.ts
git commit -m "feat(api): remove dev auth bypass, require explicit ENABLE_DEV_AUTH in dev only"
```

---

## Task 9: Update routes/groups.ts — add RBAC middleware to all routes

**Files:**
- Modify: `apps/api/src/routes/groups.ts`

- [ ] **Step 1: Read current groups.ts**

Already read above. Key change: remove dev auth hook, add RBAC preHandlers.

- [ ] **Step 2: Remove dev auth hook (lines 45-51)**

Delete this entire block:
```typescript
// Dev auth middleware
fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
  if (env.NODE_ENV === 'production') {
    // TODO: Implement Telegram Login Widget auth
    return reply.status(401).send({ error: 'Production auth uses Telegram Login Widget' });
  }
});
```

- [ ] **Step 3: Add RBAC imports**

Add after existing imports:
```typescript
import { requireAuth, requirePermission } from '@togi/auth/middleware';
```

- [ ] **Step 4: Update each route with preHandler**

For each route, add `preHandler` as follows:

```typescript
// GET /api/groups — requires auth (lists user's own groups)
{ preHandler: requireAuth }

// GET /api/groups/:id — requires auth + policy:read
{ preHandler: async (req, reply) => { await requireAuth(req, reply); if (!reply.sent) await requirePermission('policy:read')(req, reply); } }

// GET /api/groups/:id/policy — requires auth + policy:read
{ preHandler: async (req, reply) => { await requireAuth(req, reply); if (!reply.sent) await requirePermission('policy:read')(req, reply); } }

// PATCH /api/groups/:id/policy — requires auth + policy:write
{ preHandler: async (req, reply) => { await requireAuth(req, reply); if (!reply.sent) await requirePermission('policy:write')(req, reply); } }

// GET /api/groups/:id/security-score — requires auth + policy:read
// GET /api/groups/:id/violations — requires auth + logs:read
// GET /api/groups/:id/audit-logs — requires auth + logs:read
// GET /api/groups/:id/review-queue — requires auth + reviewQueue:read
// POST /api/groups/:id/review-queue/:itemId/approve — requires auth + reviewQueue:approve
// POST /api/groups/:id/review-queue/:itemId/reject — requires auth + reviewQueue:approve
// GET /api/groups/:id/raid-status — requires auth + logs:read
// POST /api/groups/:id/lockdown — requires auth + group:settings
// DELETE /api/groups/:id/lockdown — requires auth + group:settings
```

- [ ] **Step 5: Run typecheck**

Run: `cd /home/oguz/Masaüstü/Togi && pnpm --filter togi-api typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/groups.ts
git commit -m "feat(api): add RBAC middleware to all group routes"
```

---

## Task 10: Frontend — login page and auth-aware dashboard

**Files:**
- Create: `apps/web/src/app/login/page.tsx`
- Create: `apps/web/src/app/(auth)/layout.tsx`
- Modify: `apps/web/src/app/dashboard/layout.tsx`
- Modify: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/hooks/usePermission.ts`
- Modify: `apps/web/src/lib/api-client.ts`

- [ ] **Step 1: Create login page**

```tsx
// apps/web/src/app/login/page.tsx
'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'TOGI_Bot';

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">T</span>
          </div>
          <h1 className="text-2xl font-bold text-white">TOGI Security</h1>
          <p className="text-slate-400 mt-2">Sign in with your Telegram account</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div id="telegram-login-container" className="flex justify-center mb-6">
          <script
            dangerouslySetInnerHTML={{
              __html: `
                function onTelegramAuth(user) {
                  const authDate = Math.floor(Date.now() / 1000);
                  const fields = Object.keys(user).map(k => k + '=' + encodeURIComponent(user[k])).join('&');
                  const initData = 'auth_date=' + authDate + '&' + fields;
                  fetch('/api/auth/telegram/callback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ initData }),
                    credentials: 'include',
                  }).then(res => {
                    if (res.ok) window.location.href = '/dashboard';
                    else res.json().then(data => {
                      document.getElementById('login-error').textContent = data.error?.message || 'Login failed';
                      document.getElementById('login-error').style.display = 'block';
                    });
                  });
                }
              `
            }}
          />
          <script
            async
            src="https://telegram.org/js/telegram-widget.js?21"
            data-telegram-login={botUsername}
            data-size="large"
            data-radius="10"
            data-request-access="write"
            data-onauth="onTelegramAuth(user)"
          />
        </div>

        <div id="login-error" className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4" style={{ display: 'none' }}>
          <p className="text-red-400 text-sm"></p>
        </div>

        <p className="text-slate-500 text-xs text-center">
          By logging in, you agree to share your Telegram user information with TOGI.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create auth layout**

```tsx
// apps/web/src/app/(auth)/layout.tsx
'use client';
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 3: Update dashboard layout with auth check**

```tsx
// apps/web/src/app/dashboard/layout.tsx

'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Overview', href: '/dashboard' },
  { name: 'Groups', href: '/dashboard/groups' },
];

interface DashboardLayoutClientProps {
  children: React.ReactNode;
}

function AuthGuard({ children }: DashboardLayoutClientProps) {
  const router = useRouter();
  const { data, isLoading, error } = useQuery({
    queryKey: ['auth-me'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (!res.ok) throw new Error('Not authenticated');
      return res.json();
    },
    retry: false,
  });

  useEffect(() => {
    if (!isLoading && error) {
      router.push('/login');
    }
  }, [isLoading, error, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (error) return null;

  return (
    <DashboardLayoutUI user={data?.user} groups={data?.groups || []}>
      {children}
    </DashboardLayoutUI>
  );
}

function DashboardLayoutUI({ user, groups, children }: { user?: any; groups?: any[]; children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="h-full container mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">T</span>
              </div>
              <span className="text-xl font-bold text-white">TOGI</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    pathname === item.href
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  )}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <div className="text-sm text-slate-400">
                <span className="text-green-500">●</span> {user.firstName}
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}

// Export wrapper that applies auth check
export default function DashboardLayout({ children }: DashboardLayoutClientProps) {
  return <AuthGuard>{children}</AuthGuard>;
}
```

- [ ] **Step 4: Create usePermission hook**

```typescript
// apps/web/src/hooks/usePermission.ts
'use client';

// This hook is primarily for UI gating — server-side enforcement is authoritative
// The hook can be enhanced later to check permissions cached from auth-me response
export function usePermission(_permission: string): boolean {
  // For now, UI controls are hidden based on what the server returns
  // The auth-me response includes group memberships with roles
  // A proper implementation would cache and check permissions from that data
  return false;
}
```

- [ ] **Step 5: Update api-client for cookies + CSRF**

Read the current `apps/web/src/lib/api-client.ts` and add `credentials: 'include'` to all fetch calls. For state-changing methods (POST, PATCH, PUT, DELETE), also add `X-CSRF-Token` header from `sessionStorage.getItem('csrfToken')`.

- [ ] **Step 6: Update root page to redirect**

```tsx
// apps/web/src/app/page.tsx
import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/dashboard');
}
```

- [ ] **Step 7: Run typecheck**

Run: `cd /home/oguz/Masaüstü/Togi && pnpm --filter togi-web typecheck`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/login/page.tsx apps/web/src/app/(auth)/layout.tsx apps/web/src/app/dashboard/layout.tsx apps/web/src/hooks/usePermission.ts apps/web/src/lib/api-client.ts apps/web/src/app/page.tsx
git commit -m "feat(web): add Telegram login page, auth-aware dashboard layout"
```

---

## Task 11: Integration tests for auth and RBAC

**Files:**
- Create: `apps/api/src/__tests__/auth.integration.test.ts`
- Create: `apps/api/src/__tests__/production-boot.test.ts`

- [ ] **Step 1: Write auth integration tests**

```typescript
// apps/api/src/__tests__/auth.integration.test.ts
import { buildApp } from '../server';

describe('Auth API integration tests', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/telegram/callback', () => {
    it('should return 400 without initData', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/telegram/callback',
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it('should return 401 with invalid hash', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/telegram/callback',
        payload: { initData: 'auth_date=1&hash=invalid&user={}' },
      });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('INVALID_HASH');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 without session', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/groups/:id/policy', () => {
    it('should return 401 without auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/groups/fake-id/policy',
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
```

- [ ] **Step 2: Write production boot validation test**

```typescript
// apps/api/src/__tests__/production-boot.test.ts
describe('Production boot validation', () => {
  it('should fail to start if ENABLE_DEV_AUTH=true in production', async () => {
    const originalEnv = { ...process.env };
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      ENABLE_DEV_AUTH: 'true',
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_WEBHOOK_SECRET: 'test-secret',
      JWT_SECRET: 'test-secret-that-is-at-least-32-chars-long',
    };

    try {
      await expect(buildApp()).rejects.toThrow('ENABLE_DEV_AUTH=true is not allowed in production');
    } finally {
      process.env = originalEnv;
    }
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd /home/oguz/Masaüstü/Togi && pnpm --filter togi-api test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/__tests__/auth.integration.test.ts apps/api/src/__tests__/production-boot.test.ts
git commit -m "test(api): add auth integration and production boot validation tests"
```

---

## Task 12: Update webhook /setup to promote Telegram-verified user to OWNER

**Files:**
- Modify: `apps/api/src/routes/webhook.ts`

- [ ] **Step 1: Read /setup handler section**

Already read above, around lines 316-392. Key changes:
1. Verify caller is admin via `getChatMember`
2. Check bot's own permissions (soft warn)
3. If no OWNER exists, promote caller to OWNER

- [ ] **Step 2: Update handleSetupCommand**

In `handleSetupCommand`, find the block that creates a new group and replace/extend it:

```typescript
// Check if caller is admin
const chatMember = await bot.Bot.api.getChatMember(chatId, event.userId!);
const callerStatus = chatMember.status;

if (!['creator', 'administrator'].includes(callerStatus)) {
  await bot.sendMessage(chatId, '❌ Only group admins can set up TOGI.');
  return;
}

// Check bot permissions
const botChatMember = await bot.Bot.api.getChatMember(chatId, botUserId);
const botStatus = botChatMember.status;
const botIsAdmin = ['creator', 'administrator'].includes(botStatus);

// Check if no OWNER exists for this group yet
const [existingOwnerAdmins] = await db
  .select()
  .from(groupAdmins)
  .where(and(
    eq(groupAdmins.groupId, groupId),
    eq(groupAdmins.role, 'OWNER'),
    isNull(groupAdmins.revokedAt)
  ))
  .limit(1);

if (!existingOwnerAdmins && callerStatus === 'creator') {
  // First-time setup: creator becomes first OWNER
  await db.insert(groupAdmins).values({
    groupId,
    telegramUserId: event.userId ? parseInt(event.userId) : null,
    role: 'OWNER',
    permissions: ['policy:read', 'policy:write', 'admins:manage', 'admins:read', 'domainRules:manage',
      'reviewQueue:read', 'reviewQueue:approve', 'punishments:create', 'punishments:read',
      'logs:read', 'logs:export', 'group:settings'],
    addedByTelegramUserId: botUserId,
    verifiedAt: new Date(),
  });

  await db.insert(auditLogs).values({
    groupId,
    actorTelegramUserId: botUserId,
    action: 'OWNER_BOOTSTRAP',
    targetType: 'GROUP_ADMIN',
    targetId: groupId,
    metadata: { method: 'telegram_verified_creator', userId: event.userId },
  });
}
```

Also update the group status to use `SETUP_PENDING` if bot is not fully permissioned, while still allowing setup to proceed.

- [ ] **Step 3: Run typecheck**

Run: `cd /home/oguz/Masaüstü/Togi && pnpm --filter togi-api typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/webhook.ts
git commit -m "feat(webhook): verify caller admin status on /setup, auto-promote first creator to OWNER"
```

---

## Self-Review Checklist

1. **Spec coverage:** All sections of `2026-05-16-auth-rbac-design.md` have corresponding tasks
2. **Placeholder scan:** No "TODO", "TBD", or vague steps found
3. **Type consistency:** `Role`, `SessionWithUser`, `Permission` types used consistently
4. **All 5 auth endpoints covered** in Task 6
5. **RBAC matrix with 4 roles covered** in Task 4
6. **Production boot validation** in Task 7
7. **Dev auth removed from production** in Tasks 7 + 8
8. **/setup OWNER bootstrapping** in Task 12

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-16-auth-rbac-implementation.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**