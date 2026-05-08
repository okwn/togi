# PHASE_09_TESTING_AND_RELEASE.md - Testing & Release

## Objectives

- [ ] Unit tests for core packages
- [ ] Integration tests for webhook flow
- [ ] Load testing
- [ ] Documentation completion
- [ ] Release process

## Test Coverage Targets

| Package | Target | Current |
|---------|--------|---------|
| detection-engine | 90% | 0% |
| policy-engine | 90% | 0% |
| telegram-client | 80% | 0% |
| API routes | 80% | 0% |
| Worker jobs | 70% | 0% |

## Test Types

### Unit Tests
For isolated functions:
- Flood detection algorithm
- Link scanning logic
- Pattern matching
- Policy evaluation
- Reason generation

### Integration Tests
End-to-end flows:
```typescript
describe('Webhook Flow', () => {
  it('should process message and create audit log', async () => {
    // Send test webhook
    // Verify DB state
    // Verify Redis state
  });

  it('should block flood and execute action', async () => {
    // Send 15 rapid messages
    // Verify ban action called
    // Verify audit log created
  });
});
```

### Load Tests
Using k6 or Artillery:
```typescript
// webhook-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '1m', target: 500 },
    { duration: '30s', target: 0 },
  ],
};

export default function () {
  const res = http.post(
    'http://localhost:4310/webhook/telegram',
    JSON.stringify({
      update_id: Date.now(),
      message: {
        chat: { id: -100123 },
        from: { id: 456 },
        text: 'Load test message',
      },
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(res, {
    'status is 200': (r) => r.status === 200,
    'latency < 200ms': (r) => r.timings.duration < 200,
  });

  sleep(0.1);
}
```

## Performance Testing

### Metrics to Capture
- Webhook p50/p95/p99 latency
- Fast path decision latency
- Redis operation latency
- Queue depth under load
- Error rate under load

### Success Criteria
- p95 webhook latency < 120ms
- p95 fast path < 20ms
- Error rate < 0.1%
- Queue depth < 100

## Documentation

### Required Docs
- [ ] README.md with quick start
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Deployment guide
- [ ] Monitoring guide
- [ ] Troubleshooting guide
- [ ] Changelog

### Changelog Format
```markdown
## [1.0.0] - 2024-XX-XX

### Added
- Flood detection with Redis sliding window
- Link scanning with blocklist support

### Changed
- API response time improved by 20%

### Fixed
- Race condition in rate limiting
- Memory leak in worker queue

### Security
- Added webhook signature verification
```

## Release Process

### Pre-release Checklist
- [ ] All tests passing
- [ ] Load tests passing
- [ ] No critical security issues
- [ ] Documentation complete
- [ ] Changelog updated
- [ ] Version bumped

### Release Steps
```bash
# 1. Create release branch
git checkout -b release/v1.0.0

# 2. Run tests
pnpm run test

# 3. Build all packages
pnpm run build

# 4. Create release tag
git tag v1.0.0
git push origin v1.0.0

# 5. Create GitHub release
gh release create v1.0.0 --generate-notes
```

### Post-release
- [ ] Deploy to staging
- [ ] Run smoke tests
- [ ] Deploy to production
- [ ] Monitor metrics

## Docker Release

### Multi-stage Build
```dockerfile
# Build stage
FROM node:20-alpine AS builder
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm run build

# Production stage
FROM node:20-alpine AS runner
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 4310
CMD ["node", "dist/api/server.js"]
```

### Image Tags
- `togi:latest` - Latest main
- `togi:v1.0.0` - Specific version
- `togi:next` - Main branch

## Dependencies
- Phase 08: Security Hardening

## Verification
```bash
# Run all tests
pnpm run test

# Run load test
k6 run scripts/webhook-load-test.js

# Check coverage
pnpm run test --coverage
```

## Status: PENDING
