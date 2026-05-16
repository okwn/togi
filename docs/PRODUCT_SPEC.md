# PRODUCT_SPEC.md - TOGI Telegram Security Platform

## Overview

TOGI (Togi) is a production-grade Telegram Security Platform designed for public group administrators who need fast, configurable protection against modern threats.

## Core Capabilities

### Threat Protection
- **Spam Detection** - Automatic identification and removal of promotional/spam content
- **Flood Protection** - Rate limiting to prevent message floods
- **Malicious Link Blocking** - URL scanning against blocklists and ML classification
- **Threat/Scam Detection** - NLP-based detection of threatening or scamming language
- **Raid Attack Prevention** - Mass-join detection and anti-raid policies
- **Suspicious Member Alerts** - Behavioral analysis of new joiners

### Management Features
- **Group-Level Security Policies** - Fully configurable per-group rule sets
- **Web Dashboard** - Modern UI for group owners to manage settings
- **Security Score (0-100)** - At-a-glance group security health metric
- **Explainable Moderation** - Every action has a clear, human-readable reason
- **Audit Log** - Complete history of moderation actions with full context

## Performance Requirements

| Metric | Target |
|--------|--------|
| Webhook p95 latency | < 120ms |
| Fast path decision p95 | < 20ms |
| Redis operations p95 | < 50ms |
| Telegram API dispatch | As fast as possible |

## Architecture Highlights

### Fast Path (Synchronous)
Handles 95%+ of messages with sub-20ms detection:
1. Redis-based flood check
2. Link domain blocklist
3. Basic pattern matching

### Async Path (Background Worker)
For complex analysis:
1. ML-based content classification
2. Behavioral analysis
3. Security score calculation
4. Report generation

## Database Schema

TOGI uses PostgreSQL with the following core tables:

| Table | Purpose |
|-------|---------|
| `users` | Telegram user profiles |
| `groups` | Telegram group configurations |
| `group_admins` | Admin roles and permissions per group |
| `group_policies` | Security policy configurations |
| `violations` | Detected violations with severity |
| `punishments` | Active/enabled punishments |
| `domain_rules` | Block/allow lists for domains |
| `audit_logs` | All moderation actions |
| `message_fingerprints` | Message hashes for duplicate detection |

## Policy Engine

### Policy Modes
- **RELAXED**: Low sensitivity, warn-first approach
- **BALANCED**: Recommended default for most groups
- **STRICT**: High sensitivity, faster actions
- **PARANOID**: Maximum protection, auto-bans for severe violations
- **CUSTOM**: Fully configurable per-section

### Policy Sections
Each policy mode has configurable sections:
- `spamProtection` - Spam message thresholds and actions
- `floodProtection` - Message rate limiting
- `linkProtection` - Shortener and domain filtering
- `newMemberProtection` - Probation period and restrictions
- `threatProtection` - Scam and threat pattern detection
- `raidProtection` - Mass-join detection and response
- `actionPolicy` - Warn/mute/ban escalation rules
- `adminAlerts` - Admin notification settings

## Redis Key Patterns

| Pattern | Purpose |
|---------|---------|
| `rate:user:{chatId}:{userId}` | User rate limiting |
| `duplicate:{chatId}:{hash}` | Duplicate message detection |
| `join_window:{chatId}` | New member join tracking |
| `raid_state:{chatId}` | Raid detection state |
| `policy_cache:{chatId}` | Cached policy config |
| `permissions_cache:{chatId}` | Bot permissions cache |
| `action_lock:{chatId}:{messageId}:{action}` | Action deduplication |

## Security Principles

1. **Raw Message Minimization** - Messages are processed and discarded, not stored
2. **Webhook Verification** - All Telegram updates verified with secret token
3. **Audit Trail** - Every moderation action logged with full context
4. **Bot Token Safety** - Tokens never logged or exposed

## Web Dashboard UI

### Design System
- **Theme**: Premium dark mode with soft slate background
- **Colors**: 
  - Background: `hsl(222.2 84% 4.9%)` - Deep slate
  - Card: `hsl(217.2 32.6% 9%)` - Elevated surface
  - Primary: `hsl(217.2 91.2% 59.8%)` - Blue accent
  - Destructive: `hsl(0 62.8% 50.6%)` - Red for warnings
- **Typography**: System font stack, clean and minimal
- **Layout**: Container-based, responsive to mobile

### Dashboard Pages
1. **`/`** - Landing page with hero, features, CTA
2. **`/dashboard`** - Overview with groups, scores, recent violations
3. **`/dashboard/groups`** - All protected groups list
4. **`/dashboard/groups/[id]`** - Group overview with security score, mode selector
5. **`/dashboard/groups/[id]/settings`** - Tabbed policy configuration
6. **`/dashboard/groups/[id]/logs`** - Violations table with filters
7. **`/dashboard/groups/[id]/domains`** - Allowlist/blocklist/watchlist management
8. **`/dashboard/groups/[id]/members`** - Punished users by type
9. **`/dashboard/groups/[id]/permissions`** - Bot permission checklist

### Security Score (0-100)
Visual circular progress indicator showing:
- Bot admin status (0-20 pts)
- Permissions (0-25 pts)
- Protections enabled (0-30 pts)
- Block/allow lists (0-10 pts)
- Audit logging (0-15 pts)

### Policy Modes
| Mode | Description | Best For |
|------|-------------|----------|
| RELAXED | Warn before delete | Friendly communities |
| BALANCED | Default recommended | Most groups |
| STRICT | Faster actions | Crypto, trading, public |
| PARANOID | Maximum protection | Raids, sensitive groups |

## Target Users

- Public Telegram group owners
- Community moderators
- Group administrators requiring automation
- Anti-abuse teams at scale

## Competitive Advantages

- **Speed First** - Built on Fastify + Redis for sub-ms decisions
- **Explainable AI** - Moderation reasons are transparent
- **Security Score** - Quantifiable group health metric
- **Production Ready** - Docker Compose, monitoring, graceful degradation

### Autonomous Agent (Phase 08)

- **Self-learning security**: Agent observes group patterns, recommends policy adjustments
- **Event-driven triggers**: Scheduled, raid, spike, or manual analysis
- **Graduated autonomy**: From observe-only to fully autonomous within policy bounds
- **Explainable AI**: Every recommendation includes human-readable reasoning
- **Admin control**: All high-impact actions require explicit approval
- **Audit trail**: Complete history of agent decisions and outcomes
