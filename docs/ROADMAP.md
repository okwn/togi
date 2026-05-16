# ROADMAP.md

## Version History

### v0.1.0 - Foundation (MVP)
- [x] Monorepo workspace with pnpm
- [x] TypeScript base configuration
- [x] ESLint and Prettier setup
- [x] Docker Compose infrastructure
- [x] Port auto-selection system
- [x] Environment configuration

### v0.2.0 - Telegram Webhook
- [x] Telegram webhook receiver
- [x] Message handling pipeline
- [x] Bot token validation
- [x] Health check endpoint
- [x] Webhook secret verification

### v0.3.0 - Database & Policy Engine
- [x] PostgreSQL schema with migrations
- [x] Redis client setup
- [x] Policy CRUD operations
- [x] Rule evaluation engine
- [x] Group/user management

### v0.4.0 - Fast Path Engine
- [x] Flood detection (rate limiting)
- [x] Link scanning and blocking
- [x] Cache-first lookup strategy
- [x] Sub-20ms detection latency

### v0.5.0 - Action Executor
- [x] Auto-ban / Temp ban
- [x] Message deletion
- [x] Warning system
- [x] Audit logging
- [x] Explainable moderation
- [x] Idempotency with Redis locks
- [x] Admin protection checks

### v0.6.0 - Web Dashboard
- [x] Group management interface
- [x] Policy editor with tabs
- [x] Security score display
- [x] Audit log viewer
- [ ] Real-time updates (SSE/WebSocket)
- [x] Domain rules management
- [x] Member punishment management
- [x] Permission checklist

### v0.7.0 - Async Worker
- [ ] BullMQ queue setup
- [ ] Async message analysis
- [ ] Security score calculation
- [ ] Report generation
- [ ] Periodic cleanup jobs

### v0.8.0 - Raid & New Member Protection
- [x] Join flood detection
- [x] Anti-raid policies
- [x] Bulk-ban capability
- [x] Suspicious member alerts
- [ ] Slow mode integration

### v0.9.0 - Security Hardening
- [x] Webhook signature verification
- [x] Input sanitization
- [ ] Rate limiting per IP
- [ ] Security audit
- [ ] Penetration testing

### v1.0.0 - Testing & Release
- [ ] Integration tests
- [ ] Load testing
- [ ] Documentation
- [ ] Release process
- [ ] Monitoring setup

---

## v0.2.0 — Auth & Security Hardening

**Target:** 4-6 weeks

### Priority 0 (Must Have)

- [ ] Telegram Login Widget integration
- [ ] JWT session management
- [ ] Webhook replay protection (update ID deduplication)
- [ ] Per-IP rate limiting
- [ ] RBAC enforcement (group admin verification)
- [ ] Dockerfiles for api/web/worker
- [ ] CI/CD pipeline (GitHub Actions)

### Priority 1 (Should Have)

- [ ] Command target resolution fix (/warn @username)
- [ ] Join request screening
- [ ] Prometheus metrics on API
- [ ] Load testing validation

### Priority 2 (Nice to Have)

- [ ] Slow mode integration
- [ ] Redis Cluster
- [ ] Prometheus on API

---

## Production Auth (Pending)

### Telegram Login Widget Integration

For production, authentication uses the Telegram Login Widget:

```html
<script async src="https://telegram.org/js/telegram-widget.js?21"
  data-telegram-login="YOUR_BOT_USERNAME"
  data-size="large"
  data-radius="10"
  data-request-access="write"
  data-onauth="onTelegramAuth(user)">
</script>
```

Callback handler:
```typescript
function onTelegramAuth(user: TelegramUser) {
  // Verify initData signature
  // Create session token
  // Redirect to dashboard
}
```

**Implementation Status:** NOT STARTED

---

## Captcha/Verification (Future)

Phase 07 implemented basic "I am human" verification button. Future enhancements:

### Math Captcha
- Simple arithmetic problems: "What is 3 + 5?"
- Random number generation
- 3 attempts before lockout

### Emoji Captcha
- Display 4-6 emojis
- Instruction: "Select all 🐱"
- Multiple correct answers possible

### Image-Based Captcha
- Select images containing specific object
- Use predefined image sets for reliability
- 9-grid layout

### Implementation Notes
- Captcha verification stored in Redis with 5-minute TTL
- Failed attempts tracked per user
- Auto-expire after max attempts
- Always allow manual admin approval

---

## Future Considerations

### v0.3.0 - Autonomous Agent
- [ ] LLM integration (Claude API)
- [ ] Prompt caching
- [ ] Fallback heuristic classifier
- [ ] User behavior memory
- [ ] Cross-group threat intelligence
- [ ] Graduated trust system

### v0.4.0 - Scale & Reliability
- [ ] Kubernetes deployment
- [ ] Horizontal pod autoscaling
- [ ] Redis Cluster
- [ ] PostgreSQL read replicas

### v0.5.0 - Advanced Features
- [ ] ML-based spam classification
- [ ] Advanced analytics dashboard
- [ ] Custom policy templates
- [ ] Multi-language support (i18n)

### v0.6.0 - Paid Tier
- [ ] Stripe integration
- [ ] Usage-based pricing
- [ ] Premium features
- [ ] Priority support

---

## Audit (2026-05-16)

### Completed
- v0.1.0-v0.6.0: Core MVP features implemented
- v0.8.0: Raid detection implemented
- v0.9.0: Partial security (signature verification, input sanitization)

### Missing/Incomplete
- v0.7.0: BullMQ processors not runtime-tested
- v0.9.0: Per-IP rate limiting, security audit, penetration testing
- v1.0.0: Integration tests, load testing, monitoring

### v0.2.0 Scope (Auth & Security)
- Telegram Login Widget
- Webhook replay protection
- Per-IP rate limiting
- RBAC enforcement
- Dockerfiles
- CI/CD pipeline