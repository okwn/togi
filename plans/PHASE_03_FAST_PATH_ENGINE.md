# PHASE_03_FAST_PATH_ENGINE.md - Fast Path Detection Engine

## Objectives

- [x] Flood detection (Redis sliding window)
- [x] Link scanning and blocking
- [x] Threat/keyword pattern matching
- [x] Duplicate detection
- [x] New member protection
- [x] Mention spam detection
- [x] Media flood detection
- [x] Raid signal detection
- [x] Text normalization (Turkish/English)
- [x] Obfuscation handling
- [x] Sub-20ms detection target
- [x] Policy mode modifiers
- [x] Decision thresholds

## Implemented Components

### Detection Engine Structure

```
packages/detection-engine/
├── src/
│   ├── index.ts              # Main exports
│   ├── types.ts               # Core types (DetectionResult, DetectionContext, etc.)
│   ├── text-normalizer.ts     # Turkish/English normalization, obfuscation handling
│   ├── risk-score.ts          # Risk score calculation, threshold modifiers
│   ├── decision-engine.ts     # Action determination, result merging
│   ├── fast-path-engine.ts   # Main orchestrator for all detectors
│   ├── detectors/
│   │   ├── index.ts
│   │   ├── rate-limit-detector.ts    # Flood detection
│   │   ├── duplicate-detector.ts     # Duplicate message detection
│   │   ├── link-detector.ts          # URL analysis, shorteners, blocked domains
│   │   ├── threat-detector.ts        # Threat/harassment keyword detection
│   │   ├── new-member-detector.ts    # New user restriction violations
│   │   ├── mention-spam-detector.ts  # Excessive mentions
│   │   ├── media-flood-detector.ts    # Sticker/GIF burst detection
│   │   └── raid-detector.ts          # Mass join detection
│   └── static-lists/
│       ├── index.ts
│       ├── suspicious-shorteners.ts   # Known URL shorteners
│       ├── scam-patterns.ts          # Scam keywords/patterns
│       ├── threat-patterns.ts         # Threat/harassment keywords
│       └── suspicious-tlds.ts        # High-risk TLDs
└── package.json
```

## Fast Path Detection Flow

```
Message Received
      │
      ▼
┌─────────────────┐
│ Parse Message   │── Extract text, URLs, mentions, media
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ Get Policy      │── Load from Redis cache or DB
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ Rate Limit      │── Redis flood check (< 5ms)
│ Flood Check     │
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ Duplicate Check │── Hash-based dedup (< 5ms)
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ Link Analysis   │── Shortener, blocked domain check (< 5ms)
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ Threat Check    │── Keyword/pattern matching (< 5ms)
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ New Member      │── Probation restriction check
│ Mention Spam    │── Excessive mention check
│ Media Flood     │── Sticker/GIF burst check
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ Merge & Decide  │── Combine scores, apply mode thresholds
└─────────────────┘
      │
      ▼
   PASS / ACTION
```

## Detection Rules Implemented

### Flood Detection
| Condition | Score |
|----------|-------|
| 4+ messages in 5 seconds | +30 |
| 7+ messages in 10 seconds | +45 |
| 15+ messages in 60 seconds | +60 |

### Duplicate Detection
| Condition | Score |
|----------|-------|
| Same text hash within 120s | +35 |
| Same user repeats 3+ times | +50 |

### Link Detection
| Condition | Score |
|----------|-------|
| URL shortener | +45 |
| Blocklisted domain | +90 |
| Suspicious TLD | +30 |
| New user posting links | +50 |
| Telegram invite | +20 |
| Discord invite | +35 |
| Scam pattern in URL | +70 |

### Threat Detection
| Condition | Score |
|----------|-------|
| Direct threat | +75 |
| Doxxing pattern | +80 |
| Severe harassment | +45 |

### Mention Spam
| Condition | Score |
|----------|-------|
| 5+ mentions | +35 |
| 10+ mentions | +60 |

### Decision Thresholds by Mode

| Mode | ALLOW | WARN | DELETE | DELETE_MUTE | DELETE_BAN |
|------|-------|------|--------|--------------|------------|
| RELAXED | 0-39 | 40-59 | 60-79 | 80-89 | 90-100 |
| BALANCED | 0-29 | 30-49 | 50-69 | 70-89 | 90-100 |
| STRICT | 0-19 | 20-39 | 40-59 | 60-79 | 80-100 |
| PARANOID | 0-9 | 10-29 | 30-49 | 50-69 | 70-100 |

## Static Lists

### Suspicious Shorteners
bit.ly, tinyurl.com, goo.gl, t.co, ow.ly, etc.

### Scam Patterns
Crypto airdrop scams, fake updates, impersonation, general scams

### Threat Patterns
Direct threats, severe harassment, doxxing, suicide/self-harm

### Suspicious TLDs
.top, .xyz, .buzz, .cyou, .sbs, and many more

## API Integration

Fast path is integrated into webhook handler:

```typescript
// In handleMessageEvent:
const result = await runFastPath(context, policyConfig);

// If action needed:
if (result.detection.recommendedAction !== 'ALLOW') {
  await takeAction(bot, event, result.detection);
  await db.insert(violations).values({...});
}

// If deeper analysis needed:
if (result.shouldEnqueue) {
  // Enqueue async analysis job
}
```

## Performance Targets

- [x] Risk decision p95 < 20ms
- [x] Redis operations p95 < 50ms
- [x] No AI calls in fast path
- [x] No external reputation calls

## Status: COMPLETED
