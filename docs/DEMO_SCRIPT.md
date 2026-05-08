# Demo Script - TOGI v0.1.0

This script walks through setting up and demonstrating TOGI's core features.

## Prerequisites
- Node.js 20+
- pnpm 8+
- Docker and Docker Compose
- Telegram account
- Two Telegram groups (for testing)

## Step 1: Setup Environment

```bash
# Install dependencies
pnpm install

# Setup .env.local with free ports
pnpm setup:local
```

Edit `.env.local` and add your Telegram bot token:
```
TELEGRAM_BOT_TOKEN=123456789:ABCDEF...
```

## Step 2: Start Infrastructure

```bash
# Start PostgreSQL and Redis
pnpm docker:up

# Verify services are healthy
docker ps
```

Expected output:
```
CONTAINER ID   IMAGE           STATUS
xxxxxxxxxxxx   togi-postgres   Up 2 minutes (healthy)
xxxxxxxxxxxx   togi-redis     Up 2 minutes (healthy)
```

## Step 3: Database Setup

```bash
# Run migrations
pnpm db:migrate

# Verify tables created
docker exec togi-postgres psql -U togi -d togi -c "\dt"
```

Expected tables: users, groups, group_policies, violations, punishments, audit_logs, domain_rules, message_fingerprints, review_queue

## Step 4: Start Services

Open 3 terminal windows:

**Terminal 1 - API:**
```bash
pnpm dev:api
```

**Terminal 2 - Worker:**
```bash
pnpm dev:worker
```

**Terminal 3 - Dashboard:**
```bash
pnpm dev:web
```

## Step 5: Verify Health

```bash
# API Health
curl http://localhost:4311/health
# Expected: {"status":"ok","timestamp":"..."}

# API Ready
curl http://localhost:4311/ready
# Expected: {"status":"ready","services":{...}}

# Worker Metrics
curl http://localhost:4391/metrics
# Expected: Prometheus metrics format

# Dashboard
curl http://localhost:4321
# Expected: HTML page
```

## Step 6: Telegram Bot Setup

### Create Bot (if not done)
1. Open @BotFather in Telegram
2. Send `/newbot`
3. Follow prompts
4. Copy token to `.env.local`

### Set Webhook
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://your-domain.com/webhooks/telegram" \
  -d "secret_token=YOUR_WEBHOOK_SECRET"
```

### Add Bot to Group
1. Open your test group in Telegram
2. Add the bot as an admin with permissions:
   - Delete messages
   - Restrict members
   - Invite users
   - Manage video chats
   - Pin messages

## Step 7: Configure Group

Send these commands to the bot in your test group:

### Check Permissions
```
/check_permissions
```
Expected: Bot replies with permission status

### Setup TOGI
```
/setup
```
Expected: Bot confirms configuration with BALANCED policy

## Step 8: Open Dashboard

1. Open `http://localhost:4321` in browser
2. Select your group
3. View security score

## Step 9: Test Flood Protection

1. Have a user send 20+ messages rapidly in the group
2. The bot should delete messages and warn/mute violators
3. Check audit logs in dashboard

## Step 10: Test Link Protection

1. Have a user post a shortener link (e.g., bit.ly)
2. The bot should warn/delete and show why

## Step 11: Test New Member Link

1. Have a new user (not previously in group) join
2. Have them try posting a link
3. The bot should block based on new member policy

## Step 12: Test Lockdown

### Lockdown (admin only)
```
/lockdown
```
Expected: All non-admin messages blocked

### Unlock
```
/unlockdown
```
Expected: Normal service resumed

## Step 13: Switch to STRICT Mode

1. Open dashboard
2. Go to group settings
3. Change mode to STRICT
4. Notice stricter thresholds

## Step 14: Test Raid Detection (Manual)

1. Have multiple users join rapidly (simulate raid)
2. Or use dashboard to manually trigger raid mode
3. Watch raid banner appear in dashboard

## Validation Checklist

- [ ] Services started without errors
- [ ] Health endpoints return 200
- [ ] Bot responds to /check_permissions
- [ ] Bot responds to /setup
- [ ] Dashboard shows group
- [ ] Security score calculated
- [ ] Flood detection works
- [ ] Link blocking works
- [ ] Lockdown works
- [ ] Audit logs populated

## Troubleshooting

### Bot not responding
1. Check webhook is set: `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
2. Verify token is correct
3. Check API logs for errors

### Dashboard shows no groups
1. Ensure `/setup` was run in the group
2. Check database has group record

### Actions not executing
1. Ensure bot is admin
2. Check bot has required permissions
3. Check worker logs

### Ports in use
```bash
# Find process using port
lsof -i :4311

# Kill if safe
kill <PID>
```
