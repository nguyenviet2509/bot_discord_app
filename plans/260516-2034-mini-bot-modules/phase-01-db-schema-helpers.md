# Phase 01 — DB schema + helpers

## Overview
- Priority: must (chặn các phase sau)
- Status: ⏳ pending
- Estimate: S (~30-45 phút)

Thêm 3 bảng mới + helper API vào `shared/db.js`. Không migrate dữ liệu, chỉ `CREATE TABLE IF NOT EXISTS`.

## Files
- `shared/db.js` (modify)

## Schema

```sql
CREATE TABLE IF NOT EXISTS guild_modules (
  guild_id    TEXT NOT NULL,
  module_key  TEXT NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER DEFAULT (unixepoch()),
  PRIMARY KEY (guild_id, module_key)
);

CREATE TABLE IF NOT EXISTS user_coin (
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  balance    INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER DEFAULT (unixepoch()),
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS coin_tx (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  delta      INTEGER NOT NULL,
  reason     TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_coin_tx_user ON coin_tx(guild_id, user_id, created_at DESC);

-- Usage tracking cho dashboard detail panel
CREATE TABLE IF NOT EXISTS module_usage_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id    TEXT NOT NULL,
  module_key  TEXT NOT NULL,
  command     TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  user_name   TEXT,
  result      TEXT,         -- 'win'|'lose'|'draw'|'ok'|'error'
  coin_delta  INTEGER DEFAULT 0,
  meta        TEXT,         -- JSON string optional
  created_at  INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_usage_module ON module_usage_log(guild_id, module_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_user ON module_usage_log(guild_id, module_key, user_id);

-- PvP match state (cho mini-game PvP 1v1)
CREATE TABLE IF NOT EXISTS pvp_match (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id     TEXT NOT NULL,
  channel_id   TEXT NOT NULL,
  message_id   TEXT,
  game         TEXT NOT NULL,   -- 'rps' | 'oddeven' | 'guess'
  player_a     TEXT NOT NULL,
  player_b     TEXT NOT NULL,
  stake        INTEGER NOT NULL,
  state        TEXT NOT NULL,   -- 'pending'|'picking'|'finished'|'cancelled'
  pick_a       TEXT,
  pick_b       TEXT,
  winner       TEXT,            -- user_id hoặc 'draw'
  meta         TEXT,            -- JSON tự do (vd: target cho guess)
  created_at   INTEGER DEFAULT (unixepoch()),
  finished_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_pvp_state ON pvp_match(state, created_at);
CREATE INDEX IF NOT EXISTS idx_pvp_player_active ON pvp_match(guild_id, player_a, state);
```

## Helpers cần export

```js
// Module toggle
isModuleEnabled(guildId, moduleKey) -> boolean
setModuleEnabled(guildId, moduleKey, enabled) -> void
listEnabledModules(guildId) -> [{module_key, enabled}]

// Coin economy
getCoin(guildId, userId) -> number       // 0 nếu chưa có row
addCoin(guildId, userId, delta, reason)  // UPSERT + ghi coin_tx (transaction)
getCoinTopN(guildId, n=10) -> [{user_id, balance}]   // cho future leaderboard

// Usage tracking
logModuleUsage({guildId, moduleKey, command, userId, userName, result, coinDelta, meta})
getModuleStats(guildId, moduleKey, sinceUnix)
  -> { uses, uniqueUsers, coinPaid, errors }
getModuleTopUsers(guildId, moduleKey, n=5)
  -> [{user_id, user_name, uses, coin_total}]
getModuleActivity(guildId, moduleKey, limit=10)
  -> [{command, user_name, result, coin_delta, created_at}]
getModuleCommandStats(guildId, moduleKey)
  -> [{command, uses}]

// PvP match
createMatch({guildId, channelId, game, playerA, playerB, stake}) -> matchId  // transaction: insert + escrow trừ A
acceptMatch(matchId, playerB) -> match                                       // transaction: state→picking + escrow trừ B
cancelMatch(matchId, reason) -> void                                         // transaction: state→cancelled + hoàn coin còn escrow
recordPick(matchId, userId, pick) -> match
settleMatch(matchId, winner|'draw') -> match                                 // transaction: state→finished + chuyển coin
getActiveMatchByUser(guildId, userId) -> match|null
getMatchById(matchId) -> match
```

`addCoin` phải dùng `db.transaction()` để atomic: UPSERT user_coin + INSERT coin_tx. Cho phép balance âm (game thua hết coin).

## Steps
1. Mở `shared/db.js`, scroll xuống cuối hàm `initDb()` exec, append 3 CREATE TABLE + INDEX.
2. Viết các helper function sau phần helper hiện có.
3. Export ở `module.exports` cuối file.
4. Test boot: `node -e "require('./shared/db').initDb()"` không lỗi.

## Todo
- [ ] Append SQL `guild_modules`, `user_coin`, `coin_tx` vào `initDb()`
- [ ] Viết `isModuleEnabled` / `setModuleEnabled` / `listEnabledModules`
- [ ] Viết `getCoin` / `addCoin` (transaction) / `getCoinTopN`
- [ ] Export tất cả ở `module.exports`
- [ ] Smoke test: boot DB không lỗi

## Risks
- Bảng `guild_modules` thiếu default — guild chưa có row sẽ trả `undefined`. Helper phải coerce về `false` (= `defaultEnabled` của manifest, xử lý ở loader, không phải DB).
- `addCoin` không transaction → ghi `coin_tx` lệch với balance khi crash. → Bắt buộc dùng `db.transaction()`.

## Success criteria
- `npm run bot` boot, log `[DB] Database initialized` không lỗi
- Manual test: `addCoin('g1','u1',10,'test')` → `getCoin('g1','u1') === 10`, có row trong `coin_tx`
