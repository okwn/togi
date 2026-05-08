# PHASE_02_DB_POLICY.md - Database & Policy Engine

## Objectives

- [x] PostgreSQL schema with migrations
- [x] Redis client setup
- [x] Policy CRUD API
- [x] Rule evaluation engine
- [x] Group/user management
- [x] Audit log infrastructure

## Completed Implementation

### Database Schema (Drizzle ORM)

All tables are implemented in `packages/db/src/schema.ts`:

| Table | Status |
|-------|--------|
| `users` | ✅ |
| `groups` | ✅ |
| `group_admins` | ✅ |
| `group_policies` | ✅ |
| `violations` | ✅ |
| `punishments` | ✅ |
| `domain_rules` | ✅ |
| `audit_logs` | ✅ |
| `message_fingerprints` | ✅ |

### Redis Key Factory

Implemented in `packages/db/src/redis.ts`:

| Pattern | Purpose |
|---------|---------|
| `rate:user:{chatId}:{userId}` | Rate limiting |
| `duplicate:{chatId}:{hash}` | Duplicate detection |
| `join_window:{chatId}` | Join tracking |
| `raid_state:{chatId}` | Raid detection |
| `policy_cache:{chatId}` | Policy cache |
| `permissions_cache:{chatId}` | Permissions cache |
| `action_lock:{chatId}:{messageId}:{action}` | Action deduplication |

### Policy Engine

Implemented in `packages/policy-engine/`:

| Function | Description |
|---------|-------------|
| `getDefaultPolicy(mode)` | Returns default config for mode |
| `validatePolicyConfig(config)` | Validates policy structure |
| `mergePolicy(base, custom)` | Merges custom with base |
| `getEffectivePolicy(groupId)` | Gets effective policy from DB |
| `calculateSecurityScore(...)` | Calculates 0-100 score |
| `isValidMode(mode)` | Validates mode string |

### Policy Modes

- [x] RELAXED - Low sensitivity, warn-first
- [x] BALANCED - Recommended default
- [x] STRICT - High sensitivity
- [x] PARANOID - Maximum protection
- [x] CUSTOM - User-defined

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/groups` | List all groups |
| GET | `/api/groups/:id` | Get group details |
| GET | `/api/groups/:id/policy` | Get group policy |
| PATCH | `/api/groups/:id/policy` | Update group policy |
| GET | `/api/groups/:id/security-score` | Get security score |
| GET | `/api/groups/:id/violations` | Get violations |
| GET | `/api/groups/:id/audit-logs` | Get audit logs |

### Bot Integration

- [x] `/my_chat_member` handler upserts groups
- [x] `/setup` creates default BALANCED policy
- [x] `/security_status` shows security score

### Development Auth

- [x] `DEV_ADMIN_TELEGRAM_ID` environment variable
- [x] Simple dev auth middleware for dashboard APIs
- [x] Production auth uses Telegram Login Widget (documented)

## Verification

```bash
# Run migrations
pnpm run db:migrate

# Check tables exist
psql "postgresql://togi:togi_dev_password@localhost:5544/togi" -c "\dt"

# Run tests
pnpm --filter @togi/policy-engine test
pnpm --filter @togi/db test

# Build check
pnpm -r build
```

## Status: COMPLETED
