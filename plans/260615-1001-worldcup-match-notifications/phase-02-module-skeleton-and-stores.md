# Phase 02 — Module Skeleton + Stores

## Context

- Pattern: tham khảo `bot/src/modules/mini-game/` và `bot/src/modules/auto-mod/`.
- Loader: `bot/src/modules/_loader.js` đọc `manifest.js` + gọi `register.js`.

## Overview

- Priority: P0
- Status: pending
- Tạo skeleton module `worldcup`, các store helper cho DB, chưa cần scheduler.

## Files

### Create
- `bot/src/modules/worldcup/manifest.js`
- `bot/src/modules/worldcup/register.js` — chạy migrations + seed + (chưa start scheduler).
- `bot/src/modules/worldcup/services/match-store.js`
- `bot/src/modules/worldcup/services/team-store.js`
- `bot/src/modules/worldcup/services/guild-config-store.js`
- `bot/src/modules/worldcup/services/notification-log-store.js`
- `bot/src/modules/worldcup/services/admin-role-store.js` — get/set `worldcup_admin_role_id` trong `app_settings`.

## Manifest

```js
module.exports = {
  key: 'worldcup',
  name: 'Worldcup',
  description: 'Thông báo trận đấu Worldcup sắp diễn ra (per-guild config).',
  defaultEnabled: false,
  commands: [],
}
```

## Store API (signatures)

### `match-store.js`
- `listMatches(db, { from?, to?, round?, status? }) → Match[]`
- `getMatch(db, id) → Match | null`
- `createMatch(db, { team1Id, team2Id, kickOffAt, round, groupName?, stadium? }) → Match`
- `updateMatch(db, id, patch) → Match`
- `deleteMatch(db, id) → void` — đồng thời xoá row tương ứng trong `worldcup_notification_log`.
- `findUpcomingMatches(db, { nowMs, windowMs }) → Match[]` — cho scheduler.

### `team-store.js`
- `listTeams(db) → Team[]` (cache in-memory 5 phút).
- `getTeam(db, id) → Team | null`.

### `guild-config-store.js`
- `getConfig(db, guildId) → Config | null`
- `upsertConfig(db, guildId, patch) → Config`
- `listEnabledConfigs(db) → Config[]`

### `notification-log-store.js`
- `hasSent(db, matchId, guildId) → boolean`
- `markSent(db, matchId, guildId, sentAtMs) → void`
- `deleteByMatch(db, matchId) → void`

### `admin-role-store.js`
- `getAdminRoleId(db) → string | null`
- `setAdminRoleId(db, roleId) → void`

## Register flow

```js
module.exports = function register(client, ctx) {
  const db = require('../../../../shared/db').getDb()
  const { runMigrations, seedTeams } = require('./db')
  runMigrations(db)
  seedTeams(db)
  // Scheduler start ở Phase 05 — chưa add ở đây.
  console.log('[worldcup] registered')
}
```

## Steps

1. Tạo `manifest.js`.
2. Tạo các store file. Mỗi store ≤ 120 LOC (KISS).
3. Tạo `register.js` chạy migrations + seed (gọi từ Phase 01 helpers).
4. Bot start → verify log `[Modules] ✓ Loaded "Worldcup" (worldcup)`.

## Todo

- [ ] manifest.js
- [ ] register.js gọi migrations + seed
- [ ] match-store.js
- [ ] team-store.js
- [ ] guild-config-store.js
- [ ] notification-log-store.js
- [ ] admin-role-store.js
- [ ] Smoke: bot load module không lỗi

## Success criteria

- Module load thành công ở console khi bot start.
- Tất cả store function callable từ Node REPL hoặc test script.
- File ≤ 200 LOC mỗi file.

## Risks

- Path `shared/db` lookup sai vì depth — verify bằng require chính xác.

## Next

Phase 03 — dashboard owner tab CRUD matches.
