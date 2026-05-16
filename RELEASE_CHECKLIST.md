# Release Checklist

This checklist must be completed before every production release.

---

## Tests

### Unit Tests
- [ ] All unit tests pass: `pnpm test`
- [ ] Test coverage > 70% (critical paths > 90%)
- [ ] No skipped or flaky tests

### Integration Tests
- [ ] Database migrations run successfully
- [ ] Redis connection works
- [ ] API endpoints respond correctly
- [ ] Worker queue processing works

### Service Tests
- [ ] API service starts and responds on /health
- [ ] Worker service starts and connects to queue
- [ ] Web service builds without errors

---

## Security

### Dependency Audit
- [ ] `pnpm audit` shows no critical vulnerabilities
- [ ] No known CVEs in dependencies
- [ ] Lockfile is up to date

### Container Scanning
- [ ] `docker scan togi-api:latest` passes (no critical CVEs)
- [ ] `docker scan togi-worker:latest` passes
- [ ] `docker scan togi-web:latest` passes

### Secrets Verification
- [ ] No hardcoded secrets in codebase
- [ ] `.env` files are in `.gitignore`
- [ ] `.env.example` contains only placeholder values
- [ ] No API keys or tokens in git history

---

## Docker Build Verification

### API Service
```bash
docker build -f apps/api/Dockerfile --target runner -t togi-api:test .
```
- [ ] Build succeeds
- [ ] No warnings during build
- [ ] Image size < 300MB

### Worker Service
```bash
docker build -f apps/worker/Dockerfile --target runner -t togi-worker:test .
```
- [ ] Build succeeds
- [ ] No warnings during build
- [ ] Image size < 300MB

### Web Service
```bash
docker build -f apps/web/Dockerfile --target runner -t togi-web:test .
```
- [ ] Build succeeds
- [ ] No warnings during build
- [ ] Image size < 500MB

---

## Environment Validation

### Required Variables
- [ ] `TELEGRAM_BOT_TOKEN` is set (not placeholder)
- [ ] `POSTGRES_PASSWORD` is strong (32+ chars)
- [ ] `REDIS_PASSWORD` is strong (32+ chars)
- [ ] `NODE_ENV=production` for production deployments

### Optional Variables
- [ ] `AI_PROVIDER` configured if using AI features
- [ ] `LOG_LEVEL` set appropriately (error/warn/info)

---

## Database

### Migration Plan
- [ ] Migration files exist for all schema changes
- [ ] `pnpm db:migrate` runs without errors
- [ ] Migration can be rolled back: `pnpm db:rollback`

### Rollback Plan
```bash
# To rollback last migration
pnpm db:rollback

# To rollback to specific migration
pnpm db:rollback --to 20240101000000_initial_schema
```

---

## Deployment Sign-Off

### Pre-Deployment
- [ ] All items above are checked
- [ ] Deployment time is communicated to stakeholders
- [ ] Rollback plan is documented and tested
- [ ] Monitoring alerts are configured

### Post-Deployment
- [ ] Health endpoints respond: `/health`, `/ready`
- [ ] Telegram webhook is active
- [ ] Logs show no errors
- [ ] Metrics are being collected

### Smoke Tests
```bash
# API health
curl -s http://localhost:4310/health | jq .

# API readiness
curl -s http://localhost:4310/ready | jq .

# Worker health (if exposed)
curl -s http://localhost:4390/health | jq .

# Web health
curl -s http://localhost:4320/health | jq .
```

---

## Version Bumping

- [ ] Version in `package.json` updated
- [ ] `RELEASE_NOTES.md` updated
- [ ] Git tag created: `git tag v0.x.x`
- [ ] Git push with tags: `git push --tags`

---

## Final Verification

| Check | Status |
|-------|--------|
| Tests pass | [ ] |
| Security audit clean | [ ] |
| Docker builds succeed | [ ] |
| Environment validated | [ ] |
| DB migrations ready | [ ] |
| Rollback plan tested | [ ] |
| Monitoring configured | [ ] |

**Release Manager Signature:** _________________

**Date:** _________________