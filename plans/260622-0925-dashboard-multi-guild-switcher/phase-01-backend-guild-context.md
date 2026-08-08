---
phase: 1
name: Backend Guild Context + 22 Routes + Global Slash Commands
status: pending
priority: high
effort: M
---

# Phase 1: Backend

## Overview
1. Tạo `guild-context.js` middleware (chỉ query param, không header)
2. Pre-warm cache Discord guild list ở `server.js`
3. Refactor 22 routes thay `process.env.GUILD_ID` bằng `req.guildId`
4. Chuyển slash command từ guild-scope sang **global**

## Files

### Create
- `dashboard/middleware/guild-context.js`

### Modify

**Slash command (1 file):**
- `bot/src/index.js` — đổi `applicationGuildCommands` → `applicationCommands`

**Server entry:**
- `dashboard/server.js` — mount middleware + pre-warm cache

**Routes (22 files):**
- `dashboard/routes/analytics.js`
- `dashboard/routes/automod.js`
- `dashboard/routes/commands.js` *(thêm — red-team H4)*
- `dashboard/routes/discord-channels.js` *(thêm — red-team M3)*
- `dashboard/routes/discord-roles.js` *(thêm — red-team M3)*
- `dashboard/routes/events.js`
- `dashboard/routes/honor.js`
- `dashboard/routes/level-react.js`
- `dashboard/routes/level-up-template.js`
- `dashboard/routes/links.js`
- `dashboard/routes/managed-bots.js` *(thêm — red-team H4)*
- `dashboard/routes/members.js`
- `dashboard/routes/moderation.js`
- `dashboard/routes/rewards.js`
- `dashboard/routes/roll-history.js`
- `dashboard/routes/scheduled-messages.js`
- `dashboard/routes/settings.js`
- `dashboard/routes/voice-log.js`
- `dashboard/routes/voice-stats.js`
- `dashboard/routes/welcome-template.js`
- `dashboard/routes/worldcup.js`
- (+ 1 nếu grep còn — verify cuối phase)

**Skip middleware** (cross-guild / public): `/api/auth`, `/api/servers`, `/api/license`, `/api/admin/licenses`

## Implementation

### Step 1: `dashboard/middleware/guild-context.js`
```js
const https = require('https')

let cachedGuildIds = null    // Array<string>
let cachedAt = 0
const CACHE_TTL = 60_000

function fetchBotGuilds() {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'discord.com',
      path: '/api/v10/users/@me/guilds',
      method: 'GET',
      headers: { Authorization: `Bot ${process.env.BOT_TOKEN}` },
    }, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try {
          const arr = JSON.parse(data)
          resolve(Array.isArray(arr) ? arr.map(g => g.id) : null)
        } catch { resolve(null) }
      })
    })
    req.on('error', () => resolve(null))
    req.end()
  })
}

// Stale fallback: nếu fetch fail, GIỮ cache cũ thay vì reset null
async function refreshGuildCache() {
  const fresh = await fetchBotGuilds()
  if (fresh) {
    cachedGuildIds = fresh
    cachedAt = Date.now()
    return fresh
  }
  console.warn('[guild-context] Discord fetch fail, giữ stale cache')
  return cachedGuildIds  // có thể null nếu chưa từng warm
}

async function getAllowedGuilds() {
  if (cachedGuildIds && Date.now() - cachedAt < CACHE_TTL) return cachedGuildIds
  const result = await refreshGuildCache()
  return result || []
}

// Pre-warm: gọi từ server.js trước khi listen
async function prewarmGuildCache() {
  await refreshGuildCache()
  console.log(`[guild-context] Pre-warmed ${cachedGuildIds?.length || 0} guild(s)`)
}

function getGuildId(req) {
  // Chỉ query param + env fallback (BC). Không hỗ trợ header — YAGNI
  const g = req.query.guildId || process.env.GUILD_ID
  if (!g) {
    const err = new Error('Missing guildId')
    err.status = 400
    throw err
  }
  return String(g)
}

async function requireGuildAccess(req, res, next) {
  try {
    const guildId = getGuildId(req)
    const allowed = await getAllowedGuilds()
    // Fail-open có log: nếu cache rỗng hoàn toàn (Discord down ngay từ đầu), allow nhưng warn
    if (allowed.length === 0) {
      console.warn('[guild-context] Cache rỗng, fail-open cho guildId=' + guildId)
    } else if (!allowed.includes(guildId)) {
      return res.status(403).json({ error: 'Guild không thuộc bot' })
    }
    req.guildId = guildId
    next()
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message })
  }
}

module.exports = { getGuildId, requireGuildAccess, prewarmGuildCache }
```

### Step 2: `server.js` mount + pre-warm
```js
const { requireGuildAccess, prewarmGuildCache } = require('./middleware/guild-context')

// Cho 22 route cần guild context
app.use('/api/rewards', auth, requireGuildAccess, require('./routes/rewards'))
app.use('/api/members', auth, requireGuildAccess, require('./routes/members'))
app.use('/api/settings', auth, requireGuildAccess, require('./routes/settings'))
app.use('/api/discord/roles', auth, requireGuildAccess, require('./routes/discord-roles'))
app.use('/api/discord/channels', auth, requireGuildAccess, require('./routes/discord-channels'))
app.use('/api/commands', auth, requireGuildAccess, require('./routes/commands'))
app.use('/api/links', auth, requireGuildAccess, require('./routes/links'))
app.use('/api/level-up-template', auth, requireGuildAccess, require('./routes/level-up-template'))
app.use('/api/level-react', auth, requireGuildAccess, require('./routes/level-react'))
app.use('/api/welcome-template', auth, requireGuildAccess, require('./routes/welcome-template'))
app.use('/api/moderation', auth, requireGuildAccess, require('./routes/moderation'))
app.use('/api/analytics', auth, requireGuildAccess, require('./routes/analytics'))
app.use('/api/scheduled-messages', auth, requireGuildAccess, require('./routes/scheduled-messages'))
app.use('/api/honor', auth, requireGuildAccess, require('./routes/honor'))
app.use('/api/automod', auth, requireGuildAccess, require('./routes/automod'))
app.use('/api/events', auth, requireGuildAccess, require('./routes/events'))
app.use('/api/managed-bots', auth, requireGuildAccess, require('./routes/managed-bots'))
app.use('/api/roll-history', auth, requireGuildAccess, require('./routes/roll-history'))
app.use('/api/voice-log', auth, requireGuildAccess, require('./routes/voice-log'))
app.use('/api/voice-stats', auth, requireGuildAccess, require('./routes/voice-stats'))
app.use('/api/worldcup', auth, requireGuildAccess, require('./routes/worldcup'))

// KHÔNG middleware cho: /api/auth, /api/servers, /api/license, /api/admin/licenses

// Pre-warm trước listen
prewarmGuildCache().finally(() => {
  app.listen(PORT, '0.0.0.0', () => { /* ... */ })
})
```

### Step 3: Refactor route files
**Pattern replace:**
```js
// Before
const GUILD_ID = () => process.env.GUILD_ID
router.get('/', (req, res) => res.json(db.getX(GUILD_ID())))

// After (req.guildId set bởi middleware)
router.get('/', (req, res) => res.json(db.getX(req.guildId)))
```

Xóa toàn bộ `const GUILD_ID = ...` ở 22 file. Replace `GUILD_ID()` → `req.guildId`.

### Step 4: Slash commands — parallel rollout (global + guild-scope 24h)
[bot/src/index.js:57-67]:
```js
// Sau khi check CLIENT_ID
const rest = new REST().setToken(process.env.BOT_TOKEN)

// 1. Register GLOBAL (propagate ~1h, scale tự động mọi guild)
const globalData = await rest.put(
  Routes.applicationCommands(process.env.CLIENT_ID),
  { body: commandsData }
)
console.log(`[Commands] Registered ${globalData.length} GLOBAL command(s)`)

// 2. Parallel: vẫn register GUILD-SCOPE cho env.GUILD_ID (nếu có)
//    → user guild A vẫn thấy /rank ngay không phải đợi 1h propagation.
//    Sau 24h chạy cleanup-guild-scope-commands.js để xóa duplicate.
if (process.env.GUILD_ID) {
  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commandsData }
    )
    console.log(`[Commands] Also registered guild-scope cho ${process.env.GUILD_ID} (parallel 24h)`)
  } catch (e) {
    console.warn('[Commands] Guild-scope register fail:', e.message)
  }
}
```

Update check ở line 57: cần `CLIENT_ID`. `GUILD_ID` optional (chỉ dùng cho guild-scope parallel).

### Step 4b: Cleanup script (chạy sau ~24h)
Tạo `scripts/cleanup-guild-scope-commands.js`:
```js
require('dotenv').config()
const { REST, Routes } = require('discord.js')

;(async () => {
  const rest = new REST().setToken(process.env.BOT_TOKEN)
  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: [] }  // empty → xóa hết
  )
  console.log('[Cleanup] Đã xóa guild-scope commands. Global commands vẫn active.')
})()
```
Chạy: `node scripts/cleanup-guild-scope-commands.js` sau khi confirm global đã propagate.

### Step 5: Verify
- `grep -rn "process.env.GUILD_ID" dashboard/routes/` → 0 match
- `grep -rn "process.env.GUILD_ID" bot/src/` → chỉ còn ở `deploy-commands.js` (CLI tool, OK)
- Restart dashboard: log "Pre-warmed N guild(s)"
- `curl ".../api/analytics/summary?guildId=<valid>"` → 200
- `curl ".../api/analytics/summary?guildId=invalid"` → 403
- `curl ".../api/analytics/summary"` (no query, no env) → 400

## Todo
- [ ] Tạo `dashboard/middleware/guild-context.js` (no header support)
- [ ] Mount `requireGuildAccess` cho 22 routes
- [ ] Call `prewarmGuildCache()` trước `app.listen`
- [ ] Refactor 22 route files (xóa `GUILD_ID()`)
- [ ] `bot/src/index.js`: register global + parallel guild-scope (24h)
- [ ] Tạo `scripts/cleanup-guild-scope-commands.js` (để run sau)
- [ ] Grep verify 0 match `process.env.GUILD_ID` trong `dashboard/routes/`
- [ ] Test 400 / 403 / 200
- [ ] Commit Phase 1

## Success Criteria
- 22 routes dùng `req.guildId`
- Global slash command register OK
- Pre-warm cache thành công ở startup
- Validate chặn guild lạ (403)

## Risks
- Global commands có 1h propagation — note ở changelog
- Pre-warm fail nhưng app vẫn listen (fail-open có warn)
- Sót route nào dùng GUILD_ID ở scope module-level → xóa tận gốc
