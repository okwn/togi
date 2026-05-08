# TELEGRAM_LIMITATIONS.md

## Critical Requirements for Full Protection

### Bot Must Be Admin

For complete protection capabilities, the bot **must be an administrator** in the group with these permissions:

| Permission | Purpose |
|------------|---------|
| Delete Messages | Remove spam/threat content |
| Ban Users | Permanent removal of bad actors |
| Restrict Members | Time-limited restrictions (mute) |
| Change Group Info | Reserved for future use |
| Manage Video Messages | Reserved for future use |

### Why Admin Required

Telegram bots without admin status have severely limited abilities:
- Cannot delete any messages
- Cannot ban or restrict users
- Cannot see join requests
- Limited to only seeing messages directed at the bot

### Required Permissions for TOGI

TOGI requires these specific admin permissions for full functionality:

| Permission | Purpose | Checked By |
|------------|---------|------------|
| `can_delete_messages` | Delete spam/inappropriate messages | `/check_permissions` |
| `can_restrict_members` | Restrict/ban users | `/check_permissions` |
| `can_invite_users` | Process join requests | `/check_permissions` |
| `can_manage_chat` | Manage group settings | `/check_permissions` |
| `can_pin_messages` | Pin announcements | `/check_permissions` |
| `can_manage_topics` | Manage forum topics | `/check_permissions` |

Run `/check_permissions` in your group to verify all required permissions are granted.

## Privacy Mode Limitations

### What Bots CANNOT See (Privacy Mode Enabled)

When privacy mode is enabled (default for all bots):

- **Other bots' messages** - Bot sees no messages from other bots
- **Private group messages** - In groups with < 100 members
- **Messages before bot was added** - Historical messages
- **Some entity types** - Limited message entity visibility

### Privacy Mode Disabled

When privacy mode is disabled:
- Bot sees all messages in groups
- Bot sees all users' messages
- Required for full moderation

**To disable privacy mode**: @BotFather → /mybots → Select bot → Group privacy → Disable

## Telegram API Rate Limits

### Outgoing Messages (Bot to Chat)
| Scope | Limit |
|-------|-------|
| Per single chat | 30 messages/second |
| Global (all chats) | 30 messages/second |
| Broadcast | 6000 messages/hour |

### Incoming Updates
| Method | Limit |
|--------|-------|
| Webhook | 100 updates/second |
| Long polling | Unlimited but inefficient |

### Join Request Limits
- Bot can process up to 20 join requests per minute per chat
- Beyond limit: requests queued, processed as capacity available

## Bot API Response Failures

Telegram API calls can fail for many reasons. TOGI must handle these gracefully:

### Common Failure Codes

| Code | Meaning | TOGI Handling |
|------|---------|---------------|
| 429 | Too Many Requests | Retry with backoff |
| 403 | Bot blocked by user | Remove from active tracking |
| 400 | Chat not found | Log, stop retrying |
| 400 | Message not found | Log, message already deleted |
| 400 | User is deactivated | Remove from group tracking |
| 500 | Telegram server error | Retry with backoff |

### Failure Handling Principle

**Telegram API failures must never crash the service.**

```
API Call Fails
      │
      ▼
┌─────────────────┐
│  Classify Error  │
└────┌──────┬──────┘
     │      │
     ▼      ▼
┌────────┐ ┌────────┐
│ Retry  │ │ Fail   │
│able    │ │ Logged │
└───┬────┘ └───┬────┘
    │          │
    ▼          ▼
Retry    Webhook Response
w/backoff  Returned 200 OK
```

## Message Deletion Limitations

- Can only delete messages **younger than 48 hours** (or group setting)
- Bot cannot delete messages from before it was added as admin
- Messages from other admins may be protected

## Anti-Spam Limitations

- Telegram has built-in anti-spam that may conflict with bot actions
- Shadow banning (bot看不到用户但用户能看到bot) may conflict with ban detection
- Raid detection is limited by join request processing capacity

## Supergroup Considerations

Groups with > 100 members automatically become supergroups. Supergroups:
- Have different permission model
- Enable anti-spam by default
- Support join requests
- Support slow mode

## Recommended Bot Setup

1. **Disable privacy mode** via @BotFather
2. **Make bot admin** with all permissions
3. **Enable strict mode** for join requests
4. **Set group to "Public"** if tracking username changes
