---
name: discord-level-bot
status: in-progress
created: 2026-05-13
blockedBy: []
blocks: []
---

# Discord Level Bot — Implementation Plan

## Overview

Build a Discord level/XP bot for a server <100 members with a simple web dashboard
to manage rewards. Local dev first, VPS deploy later.

## Tech Stack

| Layer | Local Dev | VPS (later) |
|-------|-----------|-------------|
| Bot runtime | discord.js v14 | same |
| Database | SQLite (better-sqlite3) | PostgreSQL |
| Image storage | ./uploads/ local | Cloudflare R2 |
| Dashboard backend | Express.js | same |
| Dashboard frontend | Alpine.js + Tailwind CDN | same |
| Dashboard auth | Username/Password + JWT | same |
| Process manager | nodemon | PM2 |

## Phases

| Phase | Description | Status |
|-------|-------------|--------|
| [Phase 01](./phase-01-project-setup-database.md) | Project setup + Database schema | not-started |
| [Phase 02](./phase-02-bot-core-xp-level.md) | Bot core: XP system, level up, role assign | not-started |
| [Phase 03](./phase-03-slash-commands.md) | Slash commands: /rank, /leaderboard | not-started |
| [Phase 04](./phase-04-dashboard-api.md) | Dashboard REST API (Express + JWT auth) | not-started |
| [Phase 05](./phase-05-dashboard-ui.md) | Dashboard UI (Alpine.js + Tailwind) | not-started |

## Key Decisions

- **SQLite** locally, WAL mode — no concurrent write issues at this scale
- **20 levels** using exponential formula: `5 * level² + 50 * level + 100`
- **Cooldown**: 60s anti-spam per user
- **XP range**: 15–25 random per valid message
- **Level-up notify**: dedicated `#level-up` channel
- **Rewards**: level → role (auto-assign) OR level → badge (embed image in level-up msg)
- **Role hierarchy**: Bot role MUST be above reward roles in Discord server settings
- **Dashboard auth**: single admin user via env vars, JWT token expiry 7 days

## Files to Create

```
discord-bot/
├── bot/
│   ├── src/
│   │   ├── index.js
│   │   ├── deploy-commands.js
│   │   ├── events/message-create.js
│   │   ├── commands/rank.js
│   │   ├── commands/leaderboard.js
│   │   └── services/level-service.js
│   └── package.json
├── dashboard/
│   ├── server.js
│   ├── middleware/auth.js
│   ├── routes/auth.js
│   ├── routes/rewards.js
│   ├── routes/members.js
│   ├── routes/settings.js
│   ├── public/
│   │   ├── index.html
│   │   ├── login.html
│   │   └── js/app.js
│   └── package.json
├── shared/
│   └── db.js
├── uploads/
├── database.sqlite          (auto-created)
├── .env
├── .env.example
└── package.json             (root workspace)
```

## Environment Variables (.env)

```env
# Discord
BOT_TOKEN=
CLIENT_ID=
GUILD_ID=
LEVELUP_CHANNEL_ID=

# Roles
ROLE_DONG=
ROLE_BAC=
ROLE_VANG=

# Dashboard
DASHBOARD_PORT=3001
DASHBOARD_SECRET=change_this_to_a_long_random_string
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=your_password_here
```
