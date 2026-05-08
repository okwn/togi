# PHASE_04_ACTION_EXECUTOR.md - Action Executor

## Objectives

- [ ] Auto-ban and temp-ban execution
- [ ] Message deletion
- [ ] Warning system
- [ ] Audit log creation
- [ ] Explainable moderation output

## Action Types

### Ban Actions
| Action | Description | Duration |
|--------|-------------|----------|
| `ban` | Permanent ban | Permanent |
| `temp_ban` | Temporary ban | Configurable (1min - 366days) |
| `kick` | Remove from group | Next join allowed |

### Restriction Actions
| Action | Description |
|--------|-------------|
| `mute` | Cannot send messages |
| `permute` | Cannot send media |
| `tmute` | Temporary mute |

### Content Actions
| Action | Description |
|--------|-------------|
| `delete` | Delete offending message |
| `delete_ban` | Delete and ban |

### Warning Actions
| Action | Description |
|--------|-------------|
| `warn` | Send warning to user |
| `warn_limit` | Track warning count (3 = auto-ban) |

## Execution Flow

```
Policy Match Found
      │
      ▼
┌─────────────────┐
│  Classify       │
│  Severity       │── Determine action type
└─────────────────┘
      │
      ▼
┌─────────────────┐
│  Build Reason   │── Generate human-readable explanation
└─────────────────┘
      │
      ▼
┌─────────────────┐
│  Execute Action │── Telegram API call
│  (Async/Queue)  │
└─────────────────┘
      │
      ▼
┌─────────────────┐
│  Create Audit   │── Log to PostgreSQL
│  Entry          │
└─────────────────┘
      │
      ▼
┌─────────────────┐
│  Notify User    │── Send warning message
│  (if needed)    │
└─────────────────┘
```

## Reason Generation

Every moderation action includes a clear reason:

```typescript
function buildReason(policy: Policy, match: MatchResult): string {
  switch (policy.type) {
    case 'flood':
      return `Your messages were deleted because you sent more than ${policy.config.max_messages} messages in ${policy.config.window_seconds} seconds. This is your ${match.warnCount}th warning.`;
    case 'link':
      return `Your message was deleted because it contains a link to ${match.domain}, which is on our blocklist. Repeated violations may result in a ban.`;
    case 'threat':
      return `Your message was deleted because it was detected as threatening or harassing content. This violation has been logged.`;
    default:
      return `Your message was deleted because it violated the group rules (${policy.name}).`;
  }
}
```

## Audit Log Entry

```typescript
interface AuditEntry {
  id: string;
  groupId: string;
  userId: string;
  action: ActionType;
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata: {
    policyId: string;
    policyType: string;
    trigger?: string;      // What triggered (e.g., domain name)
    messageId?: string;    // Telegram message ID
    duration?: number;     // For temp actions
    warnCount?: number;    // Current warning count
  };
  createdAt: Date;
}
```

## Telegram API Calls

| Action | API Method | Parameters |
|--------|------------|------------|
| ban | `restrictChatMember` | chat_id, user_id, until_date |
| mute | `restrictChatMember` | chat_id, user_id, permissions |
| delete | `deleteMessage` | chat_id, message_id |
| kick | `banChatMember` | chat_id, user_id |
| warn | `sendMessage` | chat_id, text |

## Failure Handling

If Telegram API fails:
1. Log error with full context
2. Queue for retry (max 3 attempts)
3. Do not fail webhook response
4. Alert via monitoring

## Dependencies
- Phase 03: Fast Path Engine

## Verification
```bash
# Test ban action
curl -X POST http://localhost:4310/api/test/ban \
  -H "Content-Type: application/json" \
  -d '{"chat_id": -1001234567890, "user_id": 123456789}'

# Check audit log
psql "postgresql://..." -c "SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 1"
```

## Status: PENDING
