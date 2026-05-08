# PHASE_05_WEB_DASHBOARD.md - Web Dashboard

## Objectives

- [ ] Group management interface
- [ ] Policy editor with visual builder
- [ ] Security score display with history
- [ ] Audit log viewer with filters
- [ ] Real-time updates (SSE)

## Tech Stack

- **Framework**: Vite + React 18
- **Language**: TypeScript
- **Data Fetching**: TanStack Query v5
- **Styling**: TailwindCSS
- **Components**: shadcn/ui
- **State**: Zustand (lightweight)
- **Charts**: Recharts

## Pages

### 1. Dashboard (`/`)
Landing page after login:
- Overall security score (all groups)
- Recent incidents across all groups
- Quick actions (disable/enable policies)
- Active alerts count

### 2. Groups (`/groups`)
Group list with search:
- Group name, security score, member count
- Quick enable/disable protection
- Link to group settings

### 3. Group Settings (`/groups/:id`)
Per-group management:
- Group info card
- Security score with history chart
- Policy list with enable/disable toggles
- Add new policy button

### 4. Policy Editor (`/groups/:id/policies/:policyId`)
Visual policy editor:
- Policy type selector
- Configuration fields (dynamic per type)
- Test simulation input
- Preview of policy behavior
- Save / Reset buttons

### 5. Audit Log (`/groups/:id/audit`)
Filterable log viewer:
- Date range filter
- Action type filter
- User filter
- Severity filter
- Export to CSV

### 6. Settings (`/settings`)
- Telegram bot connection status
- API token management
- Notification preferences
- Account settings

## Security Score Display

```
┌────────────────────────────────────────────────────────┐
│  🔒 Security Score: 85/100          ████████████░░░  │
│                                          Good          │
├────────────────────────────────────────────────────────┤
│  Incidents (7d): 12         Flood blocks: 8          │
│  Link blocks: 3              Threat blocks: 1        │
├────────────────────────────────────────────────────────┤
│                    Score History                       │
│  100 │╭─────────────────────────────────────────╮     │
│   80 │ │ ╭──╮                                    │     │
│   60 │ │╭╯  ╰──╮      ╭──╮                      │     │
│   40 │ ││      ╰────╮╭╯  ╰──╮      ╭──╮         │     │
│   20 │ ││             │      ╰────╮╭╯  ╰────╮    │     │
│    0 │╰─╯              ╰──────────╯         ╰────╯     │
│       └──────────────────────────────────────────────► │
│       Mon    Tue    Wed    Thu    Fri    Sat    Sun     │
└────────────────────────────────────────────────────────┘
```

## Real-time Updates

Server-Sent Events (SSE) for:
- New incidents appearing
- Security score changes
- Policy updates from other admins
- Telegram connection status

## API Endpoints Used

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/groups | List groups |
| GET | /api/groups/:id | Group details |
| PATCH | /api/groups/:id | Update settings |
| GET | /api/groups/:id/policies | List policies |
| POST | /api/groups/:id/policies | Create policy |
| PATCH | /api/policies/:id | Update policy |
| DELETE | /api/policies/:id | Delete policy |
| GET | /api/groups/:id/audit | Audit log |
| GET | /api/groups/:id/score | Score history |
| GET | /api/groups/:id/incidents | Incident list |
| GET | /api/events | SSE stream |

## Dependencies
- Phase 04: Action Executor
- Phase 02: Database (API ready)

## Verification
```bash
pnpm run dev:web
# Open http://localhost:4320
# Should see login/dashboard
```

## Status: PENDING
