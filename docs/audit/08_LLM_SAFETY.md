# LLM Safety

**Version:** 1.0.0
**Last Updated:** 2026-05-16

---

## Overview

TOGI uses LLMs for message classification and agent planning. This document details safety controls for LLM integration.

---

## LLM Integration Points

### 1. Message Classification

**Purpose:** Classify message as safe/unsafe/doubtful

**Provider:** OpenAI GPT-4o-mini (configurable)

**Timeout:** 1200ms

**Safety Role:** Pre-action validation, no direct user impact

### 2. Agent Planning

**Purpose:** Generate action recommendations

**Provider:** OpenAI GPT-4o-mini or Anthropic Claude (configurable)

**Timeout:** 5000ms

**Safety Role:** Creates recommendations, requires human approval

---

## LLM Safety Controls

### 1. Input Validation

Before sending to LLM:

```typescript
// Sanitize user input
function sanitizeForLLM(text: string): string {
  // Remove potential prompt injection markers
  return text
    .replace(/\[SYSTEM\]/g, '')
    .replace(/\[SYSTEM\]/gi, '')
    .replace(/\b(role|prompt|instruction)\b/gi, '')
    .substring(0, 4000); // Max input length
}
```

### 2. Output Validation

After receiving from LLM:

```typescript
interface LLMClassification {
  verdict: 'SAFE' | 'UNSAFE' | 'DOUBTFUL' | 'ERROR';
  confidence: number; // 0-1
  reasoning: string;
  labels?: string[];
}

// Validate classification
if (!['SAFE', 'UNSAFE', 'DOUBTFUL', 'ERROR'].includes(result.verdict)) {
  throw new Error('Invalid LLM verdict');
}

if (result.confidence < 0 || result.confidence > 1) {
  throw new Error('Invalid confidence value');
}
```

### 3. Circuit Breaker

```typescript
const AI_CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5;
const AI_CIRCUIT_BREAKER_RESET_SECONDS = 60;

class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.failures >= AI_CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
      const elapsed = Date.now() - this.lastFailure;
      if (elapsed < AI_CIRCUIT_BREAKER_RESET_SECONDS * 1000) {
        throw new Error('Circuit breaker open - LLM unavailable');
      }
      this.failures = 0; // Reset after timeout
    }

    try {
      return await fn();
    } catch (err) {
      this.failures++;
      this.lastFailure = Date.now();
      throw err;
    }
  }
}
```

### 4. Timeout Enforcement

```typescript
async function callWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('LLM timeout')), timeoutMs)
  );

  return Promise.race([fn(), timeoutPromise]);
};
```

---

## Prompt Injection Prevention

### Threat Model

Attackers may attempt to manipulate LLM behavior through:
- Embedded instructions in messages
- Role confusion prompts
- Multi-turn conversation attacks

### Mitigations

**1. Strict Prompt Structure**
```typescript
const CLASSIFICATION_PROMPT = `
[SYSTEM]
You are a Telegram group security classifier.
Classify the message as SAFE, UNSAFE, or DOUBTFUL.
Respond with JSON only, no additional text.

[CONTEXT]
Group policy mode: {mode}
Safety level: {safetyLevel}

[MESSAGE]
{userId}: {text}

[RULES]
- SAFE: No violation detected
- UNSAFE: Clear policy violation
- DOUBTFUL: Uncertain, requires human review

Output:
`;
```

**2. Input Sanitization**
```typescript
function sanitizeMessage(text: string): string {
  // Remove potential instruction injection
  let sanitized = text.trim();

  // Remove common injection patterns
  if (sanitized.startsWith('ignore') || sanitized.startsWith('forget')) {
    sanitized = '[FLAGGED] ' + sanitized;
  }

  return sanitized.substring(0, 2000);
}
```

**3. Output Parsing Sandboxing**
```typescript
// Parse LLM output in try-catch
let classification;
try {
  // Attempt JSON parse
  classification = JSON.parse(llmOutput);
} catch {
  // Default to DOUBTFUL on parse failure
  classification = { verdict: 'DOUBTFUL', confidence: 0, reasoning: 'Parse failed' };
}
```

---

## LLM Provider Security

### API Key Management

- Stored as environment variable
- Never logged
- Never displayed in UI

```bash
OPENAI_API_KEY=sk-...
# or
ANTHROPIC_API_KEY=sk-ant-...
```

### Provider Selection

```typescript
const AI_PROVIDER = process.env.AI_PROVIDER || 'none'; // 'none' | 'openai' | 'local'
```

### Local LLM Support

For privacy-sensitive deployments:

```bash
AI_PROVIDER=local
LOCAL_LLM_URL=http://localhost:11434
LOCAL_LLM_MODEL=llama3
```

---

## Fallback Behavior

### LLM Unavailable

When LLM is unavailable (circuit breaker open or timeout):

**Classification:**
- Default to DOUBTFUL
- Queue for human review
- Log for monitoring

**Agent Planning:**
- No recommendations generated
- Admin notified of degraded capability

```typescript
async function classifyMessage(text: string): Promise<Classification> {
  try {
    return await callLLM(classificationPrompt);
  } catch (err) {
    // Fallback to rule-based + human review
    return {
      verdict: 'DOUBTFUL',
      confidence: 0,
      reasoning: 'LLM unavailable, human review required',
    };
  }
}
```

---

## Cost Controls

### Monthly Spend Limit

```typescript
const AI_COST_LIMIT_PER_MONTH_USD = process.env.AI_COST_LIMIT_PER_MONTH_USD;
// If set, track and enforce monthly spend limit
```

### Token Limits

```typescript
const AI_MAX_TOKENS_PER_REQUEST = 500;
```

### Feature Flags

Control which features use LLM:

```bash
AI_ENABLED_FEATURES=message_classification,agent_recommendations,policy_tuning
```

---

## Monitoring

### LLM Metrics

Track for anomaly detection:
- Request latency (p50, p95, p99)
- Error rate by provider
- Token usage per day
- Cost per day

### Alerts

- LLM error rate > 10% → Alert
- Latency p95 > 5s → Alert
- Cost > 80% of monthly limit → Alert

---

## Audit Checklist

- [ ] LLM circuit breaker implemented
- [ ] Timeout enforced (1200ms classification, 5000ms planning)
- [ ] Prompt injection patterns sanitized
- [ ] Output validation prevents invalid responses
- [ ] Fallback behavior defined when LLM unavailable
- [ ] API keys not logged
- [ ] Token limits enforced
- [ ] Cost monitoring in place
- [ ] Error rate monitoring configured