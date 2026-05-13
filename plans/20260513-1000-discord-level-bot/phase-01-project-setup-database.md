# Phase 01 — Project Setup & Database Schema

## Overview

- **Priority:** Critical — blocks all other phases
- **Status:** not-started
- **Description:** Initialize Node.js workspace, install dependencies, create SQLite schema, write shared db.js wrapper, scaffold .env

## Requirements

- Root workspace with two packages: `bot/` and `dashboard/`
- Shared SQLite database accessible by both packages
- Schema covers: users XP/level, rewards config, guild settings
- `.env.example` with all required variables documented
- `nodemon` for local hot-reload

## Database Schema

### Table: `users`
```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT NOT NULL,              -- Discord user ID
  guild_id TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 0,
  last_message_at INTEGER,       -- Unix timestamp ms, for cooldown
  updated_at INTEGER DEFAULT (unixepoch()),
  PRIMARY KEY (id, guild_id)
);
```

### Table: `rewards`
```sql
CREATE TABLE IF NOT EXISTS rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  level_required INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('role', 'badge')),
  role_id TEXT,                  -- Discord role ID (type=role)
  badge_url TEXT,                -- relative path or URL (type=badge)
  badge_name TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);
```

### Table: `guild_settings`
```sql
CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id TEXT PRIMARY KEY,
  xp_min INTEGER NOT NULL DEFAULT 15,
  xp_max INTEGER NOT NULL DEFAULT 25,
  cooldown_seconds INTEGER NOT NULL DEFAULT 60,
  level_up_channel_id TEXT,
  updated_at INTEGER DEFAULT (unixepoch())
);
```

## Architecture

```
shared/db.js
  ├── initDb()          — create tables if not exist
  ├── getUser()         — SELECT user by (id, guild_id)
  ├── upsertUser()      — INSERT OR REPLACE user
  ├── getRewards()      — SELECT rewards for guild
  ├── upsertReward()    — INSERT OR REPLACE reward
  ├── deleteReward()    — DELETE reward by id
  ├── getSettings()     — SELECT settings for guild
  └── upsertSettings()  — INSERT OR REPLACE settings
```

## Related Code Files

**Create:**
- `package.json` (root)
- `bot/package.json`
- `dashboard/package.json`
- `shared/db.js`
- `.env.example`
- `.gitignore`

## Implementation Steps

1. Create root `package.json` with workspaces config pointing to `bot/` and `dashboard/`
2. Create `bot/package.json` — deps: `discord.js@^14`, `dotenv`; devDeps: `nodemon`
3. Create `dashboard/package.json` — deps: `express`, `jsonwebtoken`, `bcryptjs`, `multer`, `cors`, `dotenv`; devDeps: `nodemon`
4. Create `shared/db.js`:
   - Import `better-sqlite3`
   - Resolve db path to project root: `../../database.sqlite`
   - `initDb()`: runs all CREATE TABLE IF NOT EXISTS statements
   - Export all CRUD helpers (sync API — better-sqlite3 is synchronous)
5. Create `.env.example` with all variables commented
6. Create `.gitignore` — ignore `node_modules/`, `.env`, `database.sqlite`, `uploads/`
7. Create empty `uploads/.gitkeep`
8. Run `npm install` at root to install all workspace deps

## Todo

- [ ] Root package.json with workspaces
- [ ] bot/package.json
- [ ] dashboard/package.json
- [ ] shared/db.js with schema + CRUD helpers
- [ ] .env.example
- [ ] .gitignore
- [ ] uploads/.gitkeep
- [ ] npm install

## Success Criteria

- `node shared/db.js` creates `database.sqlite` with all 3 tables
- `SELECT name FROM sqlite_master WHERE type='table'` returns all 3 tables
- No install errors

## Dependencies

- Node.js >= 18 installed locally
- No upstream plan dependencies
