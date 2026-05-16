# Threat Intelligence Documentation

## Overview

TOGI's threat intelligence system enables cross-group threat sharing while maintaining strict privacy boundaries.

## Privacy Model

### What IS Shared
- Threat indicator hashes (not raw values)
- Risk scores and labels
- Aggregate counts (groups affected, times seen)
- Indicator status (WATCH, BLOCK)

### What is NOT Shared
- Raw message content
- Usernames or user IDs
- Group identifiers for contributing groups
- Private conversation details

### Data Minimization
- All domain/URL/text values are hashed before sharing
- Only the hash is stored; original value is never persisted in threat indicators
- For domains, a "normalized" version is stored for matching

## Threat Indicator Lifecycle

1. **First Detection**: Indicator created with AUTO status
2. **Multi-Group**: Same indicator seen in another group → increment seenCount
3. **Promotion to WATCH**: When seen in 3+ groups
4. **Promotion to BLOCK**: When riskScore >= 70 AND seen in 3+ groups

## Cross-Group Configuration

| Config | Default | Description |
|--------|---------|-------------|
| enabled | true | Enable cross-group features |
| consumeGlobalWatchlist | true | Import global indicators |
| contributeAnonymousSignals | true | Export anonymous signals |
| autoBlockHighConfidenceIndicators | false | Auto-promote to BLOCK |
| minGroupsForGlobalWatch | 3 | Groups needed for WATCH |
| minRiskForGlobalBlock | 70 | Risk score for BLOCK |

## User Risk Profiles

**Stored (per user globally):**
- telegramUserId, globalRiskScore, totalViolations
- severeViolations, labels[], firstSeenAt, lastSeenAt

**NOT Stored:** Raw message text, message content hashes, private messages

## Group User Profiles

**Stored (per user per group, isolated):**
- groupId, telegramUserId, trustScore, riskScore
- messageCount, violationCount, warningCount, muteCount, banCount

**Privacy:** Group-specific profiles are NEVER shared between groups

## Retention

| Data Type | Retention | Auto-Delete |
|----------|-----------|-------------|
| User Risk Profiles | 90 days after last seen | Yes |
| Group User Profiles | 90 days after last activity | Yes |
| Threat Indicators (ACTIVE) | Until expired | After 30 days inactive |
| Threat Indicators (BLOCKED) | Indefinite | Manual review |
| Violation Records | 365 days | Yes |

## Opt-Out

Groups can opt out of:
1. Consuming global watchlist
2. Contributing anonymous signals