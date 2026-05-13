# Phase 04 — Dashboard REST API

## Overview

- **Priority:** High
- **Status:** not-started
- **Depends on:** Phase 01 (shared/db.js)
- **Description:** Express.js REST API for the web dashboard. Covers auth (JWT), rewards CRUD, members read/reset, settings read/write, badge image upload.

## Security Model

- Single admin user defined in `.env` (DASHBOARD_USERNAME, DASHBOARD_PASSWORD)
- `POST /api/auth/login` → returns JWT (7 days expiry)
- All other `/api/*` routes require `Authorization: Bearer <token>` header
- `bcryptjs` to hash password comparison (hash compared against bcrypt hash stored, or plain if simple)
- CORS restricted to same origin (`localhost:3001`)
- File upload via `multer` — only `image/jpeg`, `image/png`, `image/gif` accepted, max 2MB
- Uploaded files stored in `/uploads/` with UUID filename

## API Endpoints

### Auth
```
POST   /api/auth/login          { username, password } → { token }
```

### Rewards
```
GET    /api/rewards             → list all rewards for guild
POST   /api/rewards             create reward (role or badge)
PUT    /api/rewards/:id         update reward
DELETE /api/rewards/:id         delete reward
POST   /api/rewards/upload      multipart upload badge image → { url }
```

### Members
```
GET    /api/members             → list all members (XP, level, last_active)
DELETE /api/members/:id/xp      reset XP for member to 0
```

### Settings
```
GET    /api/settings            → guild settings
PUT    /api/settings            update settings
```

### Discord Roles (helper for dashboard dropdowns)
```
GET    /api/discord/roles       → fetch guild roles via Discord REST API
```

## Architecture

```
dashboard/
├── server.js                    — Express app entry, register routes, static files
├── middleware/
│   └── auth.js                  — JWT verify middleware
└── routes/
    ├── auth.js                  — POST /api/auth/login
    ├── rewards.js               — CRUD + upload
    ├── members.js               — list + reset
    ├── settings.js              — read/write
    └── discord-roles.js         — proxy Discord API for guild roles
```

## Implementation Steps

1. **`dashboard/middleware/auth.js`**:
   - Extract `Bearer <token>` from Authorization header
   - `jwt.verify(token, DASHBOARD_SECRET)`
   - If invalid → 401 `{ error: 'Unauthorized' }`
   - Attach `req.user = payload` on success

2. **`dashboard/routes/auth.js`**:
   - Compare `username === process.env.DASHBOARD_USERNAME`
   - `bcrypt.compare(password, hashedStoredPassword)` OR for simplicity: direct compare with `DASHBOARD_PASSWORD` env var (acceptable for single-admin local tool)
   - On success: `jwt.sign({ username }, DASHBOARD_SECRET, { expiresIn: '7d' })`
   - Return `{ token }`

3. **`dashboard/routes/rewards.js`**:
   - `GET /` → `db.getRewards(guildId)` — return array
   - `POST /` → validate body (level_required, type, role_id OR badge_url+badge_name) → `db.upsertReward()`
   - `PUT /:id` → `db.upsertReward()` with id
   - `DELETE /:id` → `db.deleteReward(id)` — also delete file from uploads if type=badge
   - `POST /upload` → multer middleware → save to `/uploads/<uuid>.<ext>` → return `{ url: '/uploads/filename' }`

4. **`dashboard/routes/members.js`**:
   - `GET /` → `db.getAllUsers(guildId)` ORDER BY xp DESC
   - `DELETE /:id/xp` → `db.upsertUser({ id, guild_id: guildId, xp: 0, level: 0, last_message_at: null })`

5. **`dashboard/routes/settings.js`**:
   - `GET /` → `db.getSettings(guildId)`
   - `PUT /` → validate (xp_min < xp_max, cooldown > 0) → `db.upsertSettings()`

6. **`dashboard/routes/discord-roles.js`**:
   - Use `node-fetch` or built-in `fetch` (Node 18+)
   - `GET https://discord.com/api/v10/guilds/${GUILD_ID}/roles` with `Authorization: Bot ${BOT_TOKEN}`
   - Return filtered list: `{ id, name, color }` — exclude @everyone and managed roles

7. **`dashboard/server.js`**:
   - `express.static('public')` for frontend
   - `express.static('../uploads')` at `/uploads`
   - JSON body parser
   - CORS for same origin
   - Mount all routes under `/api/`
   - Listen on `DASHBOARD_PORT`

8. **Add to `shared/db.js`**:
   - `getAllUsers(guildId)` — SELECT all users for guild
   - `deleteUserXp(userId, guildId)` — UPDATE xp=0, level=0

## Todo

- [ ] middleware/auth.js — JWT verify
- [ ] routes/auth.js — login endpoint
- [ ] routes/rewards.js — CRUD + file upload
- [ ] routes/members.js — list + reset XP
- [ ] routes/settings.js — read/write
- [ ] routes/discord-roles.js — proxy Discord guild roles
- [ ] server.js — Express app assembly
- [ ] db.getAllUsers(), db.deleteUserXp() helpers

## Success Criteria

- `POST /api/auth/login` returns token with correct credentials
- `POST /api/auth/login` returns 401 with wrong credentials
- All protected routes return 401 without token
- `GET /api/rewards` returns array (empty is fine)
- Badge image upload saves file, returns correct URL
- Settings update persists to SQLite

## Security Considerations

- multer: strict MIME type check + max file size 2MB
- JWT secret must be long random string (warn in startup if too short)
- Never return password hash in any response
- DELETE /members/:id/xp resets XP only — does not delete the user record
