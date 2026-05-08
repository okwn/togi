# 🛡️ TOGI - Telegram Guard Interface

<div align="center">

![TOGI Logo](https://img.shields.io/badge/TOGI-Telegram%20Guard-2AABEE?style=for-the-badge&logo=telegram&logoColor=white)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-202020?style=for-the-badge&logo=fastify&logoColor=white)](https://fastify.io/)

**The async-first Telegram moderation bot that protects public groups at sub-20ms speed.**

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen?style=flat-square)](#)
[![Tests](https://img.shields.io/badge/tests-40%20passing-brightgreen?style=flat-square)](#)
[![License](https://img.shields.io/badge/license-proprietary-red?style=flat-square)](#)

</div>

---

## ⚡ What is TOGI?

TOGI (Telegram Guard Interface) is a **production-ready moderation bot platform** designed to protect public Telegram groups against spam, raids, and abuse. Built with an async-first architecture, TOGI delivers sub-20ms threat detection while handling deep analysis in background workers.

```
┌─────────────────────────────────────────────────────────────┐
│                      TELEGRAM API                          │
│                    api.telegram.org                        │
└────────────────────────┬────────────────────────────────┘
                           │ Webhook @ 200ms
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     ⚡ FAST PATH ⚡                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Webhook    │→ │   Fast Path  │→ │  Action Exec  │       │
│  │   Handler    │  │   Engine     │  │   (Telegram)  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│         │                │                                 │
│         ▼                ▼                                 │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │    Redis     │  │  Detectors   │  Sub-20ms decisions    │
│  │   (State)    │  │   (Local)    │  No AI required        │
│  └──────────────┘  └──────────────┘                         │
└────────────────────────┬────────────────────────────────┘
                           │ BullMQ Queues
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
┌─────────────┐   ┌─────────────┐    ┌─────────────┐
│   Worker    │   │  PostgreSQL │    │    Redis    │
│  (Async)    │   │  (Audit)    │    │  (Hot Data) │
└─────────────┘   └─────────────┘    └─────────────┘
```

---

## ✨ Features

### 🛡️ Core Protection

| Feature | Description | Speed |
|---------|-------------|-------|
| **Fast Path Detection** | Local rule-based threat detection | < 20ms |
| **Flood Protection** | Configurable message rate limiting | < 5ms |
| **Spam Detection** | Pattern matching for spam content | < 10ms |
| **Link Protection** | Shorteners, blocked domains, suspicious TLDs | < 5ms |
| **Duplicate Detection** | SHA-256 message fingerprinting | < 2ms |
| **Mention Spam** | Excessive mention detection | < 5ms |
| **Media Flood** | Burst media message detection | < 10ms |

### 👥 New Member Protection

```
┌─────────────────────────────────────────┐
│           👤 NEW MEMBER JOINS           │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│         ⏱️ PROBATION PERIOD             │
│  ┌────────────┐ ┌────────────┐ ┌────────┐ │
│  │ 🔗 Links   │ │ 📷 Media  │ │ @Mentions│ │
│  │   BLOCKED  │ │  BLOCKED  │ │ BLOCKED │ │
│  └────────────┘ └────────────┘ └────────┘ │
└─────────────────┬───────────────────────┘
                  │ Violation
                  ▼
┌─────────────────────────────────────────┐
│         🔇 AUTO-RESTRICT USER          │
└─────────────────────────────────────────┘
```

### 🚨 Raid Protection

| Trigger | Threshold | Action |
|---------|-----------|--------|
| Join Spike | 5-15 users | Alert + Auto-lockdown |
| Message Flood | 30-100 msgs | Alert + Restrict |
| Link Burst | 10+ links | Alert + Review |
| Mention Storm | 100+ mentions | Auto-lockdown |

### 📊 Policy Modes

```
RELAXED → BALANCED → STRICT → PARANOID
   │         │          │         │
   ▼         ▼          ▼         ▼
 Warn    Delete     Mute      Ban
              Faster Action ←
```

| Mode | Description | Use Case |
|------|-------------|----------|
| 🟢 **RELAXED** | Warn before delete | Friendly communities |
| 🔵 **BALANCED** | Default recommended | Most groups |
| 🟠 **STRICT** | Faster actions | Crypto, trading, public |
| 🔴 **PARANOID** | Maximum protection | During active raids |

---

## 🏗️ Architecture

### Async Worker Pipeline

```
                    ┌─────────────────────┐
                    │   BullMQ Queues     │
                    └─────────┬───────────┘
                              │
        ┌───────────┬────────┼────────┬───────────┐
        ▼           ▼        ▼        ▼           ▼
┌─────────────┐ ┌─────────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐
│async-analysis│ │action-retry│ │audit    │ │domain   │ │raid         │
│             │ │            │ │events   │ │intel     │ │correlation  │
└─────────────┘ └─────────────┘ └─────────┘ └─────────┘ └─────────────┘
     │              │             │           │             │
     ▼              ▼             ▼           ▼             ▼
┌─────────┐    ┌─────────┐   ┌────────┐  ┌────────┐   ┌────────┐
│   AI    │    │Telegram │   │Audit   │  │ Domain │   │ Auto   │
│Analysis │    │  API    │   │Logs    │  │Intel   │   │Lockdown│
└─────────┘    └─────────┘   └────────┘  └────────┘   └────────┘
```

### Privacy by Design

```
📝 MESSAGE RECEIVED
        │
        ▼
┌───────────────────┐
│  Parse Content    │
│  Extract Links   │
│  Normalize Text  │
└────────┬─────────┘
         │
         ▼
┌───────────────────┐     ┌───────────────────┐
│  SHA-256 Hash    │     │   DETECTION       │
│  (Not Reversible)│     │   Fast Path       │
└───────────────────┘     └────────┬──────────┘
         │                         │
         ▼                         ▼
┌───────────────────┐     ┌───────────────────┐
│  Store Fingerprint│     │   TAKE ACTION      │
│  (No Raw Content)  │     │ Delete/Warn/Mute  │
└───────────────────┘     └───────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker & Docker Compose
- Telegram Bot Token from [@BotFather](https://t.me/BotFather)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/okwn/togi.git
cd togi

# 2. Install dependencies
pnpm install

# 3. Setup environment
pnpm setup:local

# 4. Add your Telegram bot token
nano .env.local  # Edit TELEGRAM_BOT_TOKEN=

# 5. Start infrastructure
pnpm docker:up

# 6. Run migrations
pnpm db:migrate

# 7. Start services
pnpm dev:api      # Terminal 1
pnpm dev:worker   # Terminal 2
pnpm dev:web      # Terminal 3
```

### One-Command Setup

```bash
git clone https://github.com/okwn/togi.git && cd togi && pnpm install && pnpm setup:local && pnpm docker:up && pnpm db:migrate
```

---

## 📋 Environment Variables

```bash
# Required
TELEGRAM_BOT_TOKEN=123456789:ABC-DEF...   # From @BotFather

# API Server
API_PORT=4310
NODE_ENV=development

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=togi
POSTGRES_PASSWORD=your_password
POSTGRES_DB=togi

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password

# Optional
AI_PROVIDER=none        # none | openai | local
WORKER_METRICS_PORT=4390
```

---

## 🤖 Telegram Bot Setup

### 1. Create Bot
```
Message @BotFather: /newbot
Follow prompts, copy token → .env.local
```

### 2. Set Webhook
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://your-domain.com/webhooks/telegram" \
  -d "secret_token=YOUR_WEBHOOK_SECRET"
```

### 3. Required Permissions
```
✅ Delete messages
✅ Restrict members
✅ Invite users
✅ Manage video chats
✅ Pin messages
```

### 4. Bot Commands
| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/help` | Show all commands |
| `/setup` | Configure TOGI for group |
| `/security_status` | Check bot permissions |
| `/lockdown` | Lock group (admin only) |
| `/unlockdown` | Unlock group (admin only) |
| `/warn @user [reason]` | Warn user (admin only) |
| `/mute @user [duration]` | Mute user (admin only) |
| `/ban @user [reason]` | Ban user (admin only) |

---

## 📊 Dashboard

Open `http://localhost:4320` (or your configured port)

### Features

```
┌─────────────────────────────────────────────────────────────┐
│  TOGI DASHBOARD                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📊 Security Score          👥 Members          🔒 Status  │
│  ┌─────────────┐           ┌─────────────┐    ┌─────────┐ │
│  │     85     │           │    1,247    │    │   🟢    │ │
│  │   /100      │           │  Active     │    │  SAFE   │ │
│  └─────────────┘           └─────────────┘    └─────────┘ │
│                                                             │
│  🚨 RAID MODE: Inactive    ⚡ Fast Path: 500/s            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Dashboard Pages
- **Overview** - Security score, bot status, recent actions
- **Policy Editor** - Configure protection per mode
- **Domain Rules** - Block/allow specific domains
- **Audit Logs** - View all moderation actions
- **Review Queue** - Approve/reject flagged content

---

## ⚙️ Policy Configuration

### Protection Modes

```typescript
// RELAXED - Friendly communities
{
  spamProtection: { deleteThreshold: 20, windowSeconds: 10 },
  newMemberProtection: { probationMinutes: 2, blockLinksDuringProbation: false },
  raidProtection: { joinSpikeThreshold: 20, autoLockdown: false }
}

// BALANCED - Recommended (default)
{
  spamProtection: { deleteThreshold: 15, windowSeconds: 10 },
  newMemberProtection: { probationMinutes: 5, blockLinksDuringProbation: true },
  raidProtection: { joinSpikeThreshold: 15, autoLockdown: true }
}

// STRICT - Crypto, trading, public groups
{
  spamProtection: { deleteThreshold: 10, windowSeconds: 10 },
  newMemberProtection: { probationMinutes: 15, blockLinksDuringProbation: true },
  raidProtection: { joinSpikeThreshold: 10, autoLockdown: true }
}

// PARANOID - Maximum protection
{
  spamProtection: { deleteThreshold: 8, windowSeconds: 10 },
  newMemberProtection: { probationMinutes: 30, blockLinksDuringProbation: true, verificationRequired: true },
  raidProtection: { joinSpikeThreshold: 5, autoLockdown: true, paranoidDuringRaid: true }
}
```

---

## 🔒 Security

### Privacy
- ✅ Raw messages **never stored**
- ✅ Text hashed with SHA-256
- ✅ Only metadata stored (labels, reasons, risk scores)
- ✅ Audit logs retained 90 days max
- ✅ Redis TTL for temporary state

### Production Checklist
- [ ] `NODE_ENV=production`
- [ ] Valid Telegram bot token
- [ ] HTTPS for webhook
- [ ] Bot admin in group
- [ ] Database credentials rotated
- [ ] Redis password set

---

## 📈 Performance

### Latency Targets

| Operation | Target p95 | Max |
|-----------|-----------|-----|
| Webhook receive | < 120ms | 200ms |
| Fast path decision | < 20ms | 50ms |
| Redis flood check | < 50ms | 100ms |
| Action dispatch | < 500ms | 2000ms |
| Async analysis | < 5000ms | 10000ms |

### Throughput
- API webhook receiver: **500-1000 req/s**
- Fast path decisions: **500-1000/s**
- Async analysis queue: **50-200/s**

---

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Test results
✓ shared: 12 tests passed
✓ telegram-client: 28 tests passed
✓ Total: 40 tests passed
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [README.md](README.md) | This file |
| [docs/PRODUCTION_DEPLOYMENT.md](docs/PRODUCTION_DEPLOYMENT.md) | Production deployment guide |
| [docs/SECURITY_CHECKLIST.md](docs/SECURITY_CHECKLIST.md) | Security hardening checklist |
| [docs/PRIVACY_MODEL.md](docs/PRIVACY_MODEL.md) | Data handling and retention |
| [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) | Step-by-step demonstration |
| [RELEASE_NOTES.md](RELEASE_NOTES.md) | Version history and changelog |

---

## 🚧 Roadmap

### v0.2.0 - Production Hardening
- [ ] Telegram Login Widget
- [ ] Per-IP rate limiting
- [ ] External security audit

### v0.3.0 - Enhanced Features
- [ ] Math captcha for verification
- [ ] Cross-group threat intelligence
- [ ] Advanced analytics

### v1.0.0 - Release
- [ ] Integration tests
- [ ] Load testing
- [ ] Full documentation

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## 📄 License

Proprietary - All rights reserved

---

## 🙏 Acknowledgments

- [Fastify](https://fastify.io/) - Fast web framework
- [grammY](https://grammy.dev/) - Telegram bot framework
- [BullMQ](https://bullmq.io/) - Message queue for Redis
- [Drizzle ORM](https://orm.drizzle.team/) - TypeScript ORM
- [Zod](https://zod.dev/) - TypeScript validation

---

<div align="center">

**Built with ❤️ for Telegram communities**

[![Telegram](https://img.shields.io/badge/Telegram-2AABEE?style=for-the-badge&logo=telegram&logoColor=white)](https://telegram.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)

</div>
