# PHASE_00_FOUNDATION.md - Foundation

## Objectives

- [x] Initialize pnpm workspace
- [x] TypeScript base configuration
- [x] ESLint and Prettier setup
- [x] Docker Compose for PostgreSQL and Redis
- [x] Port auto-selection script
- [x] Environment configuration with .env.example

## Deliverables

### Project Structure
```
togi/
├── apps/
│   ├── api/
│   ├── web/
│   └── worker/
├── packages/
│   ├── shared/
│   ├── config/
│   ├── db/
│   ├── telegram-client/
│   ├── policy-engine/
│   └── detection-engine/
├── docs/
├── plans/
├── scripts/
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── .eslintrc.js
├── .prettierrc
├── .env.example
└── docker-compose.yml
```

### Port Selection
Preferred ports (auto-fallback if occupied):
- API_PORT: 4310
- WEB_PORT: 4320
- POSTGRES_PORT: 5543
- REDIS_PORT: 6388
- WORKER_METRICS_PORT: 4390

### Docker Containers
- togi-postgres (PostgreSQL 16)
- togi-redis (Redis 7)
- togi-api (Future API server)
- togi-web (Future Web dashboard)
- togi-worker (Future Background worker)

## Verification

```bash
pnpm install                    # Should complete without errors
pnpm run --filter togi-config build  # Should build
cat .env.example | grep PORT   # Should show all PORT vars
docker compose config           # Should validate docker-compose.yml
```

## Status: ✅ COMPLETE
