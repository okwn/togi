# CI/CD Pipeline

This document describes the GitHub Actions workflows for TOGI CI/CD.

---

## Workflow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    GitHub Actions CI/CD                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    │
│  │  Push   │───▶│  PR     │───▶│  Main   │───▶│  Tag    │    │
│  │ (Any)   │    │         │    │ Branch  │    │ Release │    │
│  └─────────┘    └────┬────┘    └────┬────┘    └────┬────┘    │
│                     │               │               │          │
│                     ▼               ▼               ▼          │
│              ┌──────────┐    ┌──────────┐    ┌──────────┐     │
│              │   CI     │    │   CI     │    │ Release  │     │
│              │ Workflow │    │ Workflow │    │ Pipeline  │     │
│              └──────────┘    └──────────┘    └──────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## CI Pipeline Jobs

### Trigger Conditions
- Every push to any branch
- Every pull request

### Job Stages

```
┌─────────────────────────────────────────┐
│            CI Pipeline                  │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────┐   ┌─────────┐   ┌───────┐│
│  │ Install │──▶│  Lint   │──▶│ Type  ││
│  │         │   │         │   │ Check ││
│  └─────────┘   └─────────┘   └───┬───┘│
│                                  │     │
│                    ┌─────────────┼─────┘
│                    ▼             ▼
│              ┌─────────┐   ┌─────────┐
│              │  Test   │   │ Build   │
│              │         │   │         │
│              └────┬────┘   └────┬────┘
│                   │             │
│                   └──────┬──────┘
│                          ▼
│                   ┌─────────────┐
│                   │ Docker API  │
│                   │   Build     │
│                   └─────┬───────┘
│                         ▼
│                   ┌─────────────┐
│                   │Docker Worker│
│                   │   Build     │
│                   └─────┬───────┘
│                         ▼
│                   ┌─────────────┐
│                   │ Docker Web  │
│                   │   Build     │
│                   └─────────────┘
└─────────────────────────────────────────┘
```

### Job Details

#### Install
```yaml
name: Install Dependencies
run: pnpm install --frozen-lockfile
```
- Uses pnpm with frozen lockfile for reproducible builds
- Caches node_modules for faster subsequent runs

#### Lint
```yaml
name: Lint
run: pnpm lint
```
- ESLint for TypeScript/JavaScript
- Prettier for code formatting
- Runs on all packages (api, worker, web, shared packages)

#### Type Check
```yaml
name: Type Check
run: pnpm typecheck
```
- TypeScript compiler check
- No emit mode (types only)
- Runs across all workspaces

#### Test
```yaml
name: Test
run: pnpm test
```
- Unit tests via Vitest
- Coverage report generated
- Runs in parallel across packages

#### Docker Build (API)
```yaml
name: Docker API Build
run: docker build -f apps/api/Dockerfile --target runner -t togi-api:test .
```
- Multi-stage build for production image
- Runs after tests pass

#### Docker Build (Worker)
```yaml
name: Docker Worker Build
run: docker build -f apps/worker/Dockerfile --target runner -t togi-worker:test .
```

#### Docker Build (Web)
```yaml
name: Docker Web Build
run: docker build -f apps/web/Dockerfile --target runner -t togi-web:test .
```

---

## Security Pipeline

### Trigger Conditions
- Every push to any branch
- Weekly schedule (Wednesday 00:00 UTC)
- Manual trigger

### Job Stages

```
┌─────────────────────────────────────────┐
│         Security Pipeline               │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────┐   ┌────────────────┐ │
│  │ Dependency   │──▶│   Docker       │ │
│  │    Audit     │   │  Build Check   │ │
│  └──────────────┘   └───────┬────────┘ │
│                             │          │
│              ┌──────────────┴──────────┐│
│              ▼                         ▼│
│     ┌───────────────┐        ┌─────────┐│
│     │ Secret        │        │ Static  ││
│     │ Scanning      │        │Analysis ││
│     └───────────────┘        └─────────┘│
└─────────────────────────────────────────┘
```

### Job Details

#### Dependency Audit
```yaml
name: Dependency Audit
run: pnpm audit --audit-level=high
```
- Checks for known vulnerabilities
- Fails on high/critical severity
- Generates SARIF report for GitHub Security tab

#### Docker Build Check
```yaml
name: Docker Build Check
run: |
  docker build -f apps/api/Dockerfile --target runner togi-api:security-test
  docker build -f apps/worker/Dockerfile --target runner togi-worker:security-test
  docker build -f apps/web/Dockerfile --target runner togi-web:security-test
  docker scout cves togi-api:security-test
  docker scout cves togi-worker:security-test
  docker scout cves togi-web:security-test
```
- Builds Docker images without pushing
- Runs Docker Scout CVE scan on each image

#### Secret Scanning
```yaml
name: Secret Scanning
run: |
  git diff --name-only origin/main...HEAD | xargs git log -p --follow | git secret scanning
  git diff --cached | git secret scanning
```
- Scans for committed secrets
- Uses git-secret or similar tool
- Fails if any secrets detected

#### Static Analysis
```yaml
name: Static Analysis
run: pnpm run static-analysis
```
- Runs code analysis tools
- Checks for potential security issues
- Generates report for review

---

## Docker Image Tags

| Tag | Description | Example |
|-----|-------------|---------|
| `latest` | Most recent build | `togi-api:latest` |
| `main` | Latest from main branch | `togi-api:main` |
| `sha-abc1234` | Commit SHA (first 7 chars) | `togi-api:sha-abc1234` |
| `v0.1.0` | Semantic version tag | `togi-api:v0.1.0` |

### Image Naming Convention
```
ghcr.io/okwn/togi/{service}:{tag}
```

---

## Local Docker Commands

### Build Images
```bash
# Build all services
pnpm docker:build

# Build specific service
docker build -f apps/api/Dockerfile --target runner -t togi-api:local .
```

### Run Containers
```bash
# Start all services
docker compose up -d

# Start specific service
docker compose up -d api

# View logs
docker compose logs -f api
```

### Stop Containers
```bash
# Stop all services (keep data)
docker compose down

# Stop and remove volumes (DANGER!)
docker compose down -v
```

### Clean Up
```bash
# Remove unused images
docker image prune -f

# Remove unused volumes
docker volume prune -f

# Full system cleanup (CAREFUL!)
docker system prune -a
```

### Push to Registry
```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u okwn --password-stdin

# Tag images
docker tag togi-api:latest ghcr.io/okwn/togi/api:v0.1.0
docker tag togi-worker:latest ghcr.io/okwn/togi/worker:v0.1.0
docker tag togi-web:latest ghcr.io/okwn/togi/web:v0.1.0

# Push images
docker push ghcr.io/okwn/togi/api:v0.1.0
docker push ghcr.io/okwn/togi/worker:v0.1.0
docker push ghcr.io/okwn/togi/web:v0.1.0
```

---

## CI Limitations

### Current Limitations
- No deployment automation (manual approval required for production)
- No canary deployment strategy
- No rollback automation
- No load testing in CI
- No infrastructure as code (IaC) for cloud deployment

### Missing Features (Future)
- [ ] Automated deployment to cloud provider
- [ ] Canary release with percentage-based traffic splitting
- [ ] Automated rollback on health check failure
- [ ] Integration tests in CI pipeline
- [ ] E2E tests in CI pipeline
- [ ] Load testing with k6 or similar
- [ ] Infrastructure as code (Terraform/Pulumi)

---

## Troubleshooting CI

### Build Fails
```bash
# Check workflow logs in GitHub Actions tab
# Common causes:
# - pnpm lockfile out of sync -> git pull && pnpm install
# - TypeScript errors -> pnpm typecheck locally
# - Test failures -> pnpm test locally
```

### Docker Build Fails
```bash
# Build locally first
docker build -f apps/api/Dockerfile --target runner -t togi-api:test .

# Check for multi-stage build errors
docker build --progress=plain -f apps/api/Dockerfile -t togi-api:debug .
```

### Test Coverage Too Low
```bash
# Check coverage locally
pnpm test --coverage

# Update coverage threshold in vitest.config.ts if needed
```

### Cache Miss
```bash
# Clear GitHub Actions cache (Settings > Actions > General > Cache management)
# Or wait for cache to expire (7 days)
```

---

## Environment Variables for CI

| Variable | Description | Required |
|----------|-------------|----------|
| `GITHUB_TOKEN` | GitHub PAT for container registry | Yes |
| `TELEGRAM_BOT_TOKEN` | Bot token for integration tests | No |
| `NODE_ENV` | Set to `test` | Yes |

---

## Versioning Strategy

1. Semantic versioning (MAJOR.MINOR.PATCH)
2. Tags on main branch trigger release
3. Docker images tagged with version
4. Changelog auto-generated from commit messages

### Release Flow
```
main branch push
    │
    ▼
GitHub Actions CI (tests + build)
    │
    ▼
Tag created (v0.1.0)
    │
    ▼
Release workflow triggered
    │
    ▼
Docker images built + pushed
    │
    ▼
Release notes generated
```