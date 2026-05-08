# LOCAL_DEVELOPMENT.md

## Prerequisites

- Node.js 20+ (check with `node -v`)
- pnpm 8+ (check with `pnpm -v`)
- Docker & Docker Compose (check with `docker -v`)
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))

## Port Safety Rules

**CRITICAL**: This project never assumes ports 3000, 3001, 5432, or 6379 are available.

### Port Selection Strategy

The setup script automatically detects and uses free ports:

| Service | Preferred Port | Fallback Range |
|---------|---------------|----------------|
| API | 4310 | 4000-6000 |
| Web | 4320 | 4000-6000 |
| PostgreSQL | 5543 | 5000-7000 |
| Redis | 6388 | 6000-7000 |
| Worker Metrics | 4390 | 4000-5000 |

### Why This Matters

Local development may have other services running:
- Port 3000: Often used by React/Vite dev servers
- Port 5432: Often used by system PostgreSQL
- Port 6379: Often used by system Redis

The auto-detection prevents conflicts without affecting existing services.

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Setup environment (detects ports, creates .env.local)
pnpm run setup:local

# 3. Add your Telegram bot token to .env.local
#    TELEGRAM_BOT_TOKEN=your_token_here

# 4. Start infrastructure only (no building)
pnpm run docker:up

# 5. Run database migrations
pnpm run db:migrate

# 6. Start development servers (in parallel)
pnpm run dev
```

## Setup Script Behavior

`pnpm run setup:local` will:

1. **Detect free ports** without affecting running services
2. **Create `.env.local`** with detected ports
3. **Back up existing `.env.local`** if present
4. **Print next steps** clearly

If `.env.local` already exists:
```
⚠️  .env.local already exists.
   Creating backup at .env.local.backup
```

## Environment Files

| File | Purpose | Gitignore |
|------|---------|-----------|
| `.env` | Default env (committed) | No |
| `.env.local` | Local overrides | Yes |
| `.env.test` | Test environment | Yes |

## Docker Container Names

All TOGI containers use project-specific names:

- `togi-postgres` - PostgreSQL database
- `togi-redis` - Redis cache
- `togi-api` - API server
- `togi-web` - Web dashboard
- `togi-worker` - Background worker

These names do not conflict with any existing containers.

## Development Commands

```bash
# Start all services in development mode
pnpm run dev

# Start only API
pnpm run dev:api

# Start only Web
pnpm run dev:web

# Start only Worker
pnpm run dev:worker

# Run database migrations
pnpm run db:migrate

# Seed database with test data
pnpm run db:seed

# Run type checking
pnpm run typecheck

# Run linting
pnpm run lint

# Run tests
pnpm run test

# Stop Docker services
pnpm run docker:down
```

## Database Commands

```bash
# Run migrations (creates tables)
pnpm run db:migrate

# Open Drizzle Studio (browser-based DB viewer)
pnpm --filter @togi/db studio

# Push schema to database (alternative to migrate)
pnpm --filter @togi/db push
```

## API Endpoints

Dashboard API endpoints (development auth enabled by default):

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/groups` | List all groups |
| GET | `/api/groups/:id` | Get group details |
| GET | `/api/groups/:id/policy` | Get group policy |
| PATCH | `/api/groups/:id/policy` | Update group policy |
| GET | `/api/groups/:id/security-score` | Get security score |
| GET | `/api/groups/:id/violations` | Get group violations |
| GET | `/api/groups/:id/audit-logs` | Get audit logs |

### Testing API

```bash
# Get all groups
curl http://localhost:4311/api/groups

# Get security score for a group
curl http://localhost:4311/api/groups/{groupId}/security-score
```

## Verifying Setup

```bash
# Check ports are set correctly
cat .env.local | grep PORT

# Check Docker containers are running
docker ps --filter "name=togi-"

# Check API health
curl http://localhost:4310/health

# Check Web is accessible
curl http://localhost:4320
```

## Troubleshooting

### Port Already in Use
Run `pnpm run setup:local` to find new free ports.

### Database Connection Failed
```bash
# Check Docker is running
docker ps

# Check Postgres container
docker logs togi-postgres

# Restart if needed
docker restart togi-postgres
```

### Bot Not Responding
1. Verify webhook is set: `curl http://localhost:4310/health`
2. Check Telegram token in `.env.local`
3. Check bot has admin permissions in group

## Cleaning Up

```bash
# Stop all containers
pnpm run docker:down

# Remove volumes (WARNING: deletes data)
docker compose down -v

# Remove generated files
rm .env.local
```

## Production Deployment

For production, use environment variables directly:

```bash
export API_PORT=4310
export WEB_PORT=4320
export POSTGRES_PORT=5543
export REDIS_PORT=6388
export WORKER_METRICS_PORT=4390
export TELEGRAM_BOT_TOKEN=your_token
# ... other vars
docker compose up -d
```
