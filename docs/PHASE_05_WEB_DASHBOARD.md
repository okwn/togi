# PHASE_05_WEB_DASHBOARD.md - TOGI Web Dashboard

## Objectives

- [x] Premium dark mode security dashboard
- [x] Landing page with hero and feature cards
- [x] Group list and overview pages
- [x] Security score visualization
- [x] Policy settings with tabs
- [x] Violations logs with filters
- [x] Domain rules management (allowlist/blocklist/watchlist)
- [x] Member punishment management
- [x] Permission checklist
- [x] API client for backend integration
- [x] Mode selector with descriptions

## Routes

### `/` - Landing Page
- TOGI hero section
- "Real-time protection for Telegram groups"
- Feature cards (6 features)
- Add bot CTA
- Open dashboard CTA

### `/dashboard` - Main Dashboard
- Group list with security status
- Security score cards (total, groups, violations, system)
- Quick setup hints
- Recent violations table

### `/dashboard/groups` - Groups List
- All protected groups
- Status badges (Protected/Not Admin, Active/Left)
- Add group button

### `/dashboard/groups/[groupId]` - Group Overview
- Security score (circular progress)
- Protection mode selector
- Bot permission status
- Raid state
- Recent actions timeline

### `/dashboard/groups/[groupId]/settings` - Policy Settings
Tabs:
1. **Spam & Flood** - Enable toggle, delete threshold slider, flood detection (max messages, window)
2. **Link Protection** - Enable toggle, block shorteners, block new user links, block Telegram/Discord invites
3. **New Members** - Enable toggle, probation period, restrict new users, allow media
4. **Threats** - Enable toggle, scan messages, block keywords
5. **Raid Protection** - Enable toggle, join window, max joins, auto-lockdown
6. **Actions** - Warn threshold, mute duration, max warnings
7. **Admin Alerts** - Enable toggle, severity threshold selector

### `/dashboard/groups/[groupId]/logs` - Violations
- Filters: severity, label, action
- Table: time, user ID, message ID, labels, severity, action, risk score, reason

### `/dashboard/groups/[groupId]/domains` - Domain Rules
- Add domain form with validation
- Three tables: Allowlist, Blocklist, Watchlist
- Rule type explanations

### `/dashboard/groups/[groupId]/members` - Member Management
- Risky users
- Warned users
- Muted users
- Banned users
- Action buttons: view history, add to watchlist, revoke punishment

### `/dashboard/groups/[groupId]/permissions` - Permissions Checklist
- Required permissions list with status
- Status banner (complete/incomplete)
- How to fix instructions

## Components

| Component | Purpose |
|-----------|---------|
| AppShell | Main layout wrapper |
| SecurityScoreCard | Circular score display |
| ModeSelector | Protection mode switcher |
| PolicyToggleCard | Toggle with description |
| ThresholdSlider | Range slider with value display |
| DomainRuleTable | Domain list with actions |
| ViolationsTable | Filterable violations list |
| PermissionChecklist | Permission status list |
| RaidStatusBanner | Raid detection status |
| AuditTimeline | Recent actions display |
| SaveBar | Save button with status |
| RiskBadge | Risk score coloring |
| ActionBadge | Action type styling |

## API Client

```typescript
// apps/web/src/lib/api-client.ts
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

getGroups(): Promise<Group[]>
getGroup(id: string): Promise<Group>
getGroupPolicy(groupId: string): Promise<PolicyConfig>
updateGroupPolicy(groupId: string, policy: PolicyConfig): Promise<PolicyConfig>
getSecurityScore(groupId: string): Promise<SecurityScore>
getViolations(groupId: string, filters?: ViolationFilters): Promise<Violation[]>
getAuditLogs(groupId: string, limit?: number): Promise<AuditLog[]>
getDomainRules(groupId: string): Promise<DomainRule[]>
addDomainRule(groupId: string, domain: string, ruleType: string): Promise<DomainRule>
deleteDomainRule(groupId: string, ruleId: string): Promise<void>
getGroupMembers(groupId: string): Promise<Member[]>
revokePunishment(groupId: string, userId: number): Promise<void>
```

## Design System

### Colors
- Background: `hsl(222.2 84% 4.9%)` - Deep slate
- Card: `hsl(217.2 32.6% 9%)` - Elevated surface
- Primary: `hsl(217.2 91.2% 59.8%)` - Blue accent
- Destructive: `hsl(0 62.8% 50.6%)` - Red for warnings

### Typography
- Font: System font stack (no custom fonts needed)
- Headings: Bold, white
- Body: Regular, slate-400

### Spacing
- Container: max-w-7xl, centered
- Section gap: 24px (space-y-6)
- Card padding: 24px (p-6)

## Development

```bash
# Start dev server
cd apps/web && pnpm dev

# Production build
pnpm --filter togi-web build

# Run
pnpm --filter togi-web start
```

## Environment Variables

```
WEB_PORT=4321
API_BASE_URL=http://localhost:3000
DEV_ADMIN_TELEGRAM_ID=123456789  # Development auth
```

## Auth (Development)

Dev auth uses `DEV_ADMIN_TELEGRAM_ID` from environment.
Production auth will use Telegram Login Widget (see ROADMAP.md).

## Status: COMPLETED