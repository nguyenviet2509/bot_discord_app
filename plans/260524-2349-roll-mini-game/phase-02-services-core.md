---
phase: 2
title: "Services Core"
status: pending
priority: P1
effort: "4h"
dependencies: [1]
---

# Phase 2: Services Core

## Overview

Implement 4 service module: `roll-session-store.js` (CRUD + state machine), `roll-engine.js` (random algorithm), `roll-timeout.js` (timer manager), `roll-lifecycle.js` (business logic).

## Requirements

**Functional:**
- Tạo session với state `open`, host, max_players, expires_at
- Join/leave participant (idempotent: join 2 lần không nhân đôi, leave khi không có row → no-op)
- Transition `open → rolling → finished` atomic (SQLite transaction + WHERE state='open')
- Transition `open → cancelled` (host hủy / timeout)
- Random unique uniform pool [1..score_max], lưu score vào từng row participant
- Timer manager: set/clear theo sessionId, lưu trong Map<sessionId, Timeout>

**Non-functional:**
- Tất cả DB write atomic
- Engine dùng `crypto.randomInt` (uniform, audit-proof)
- Mỗi file < 200 dòng

## Architecture

```
roll-lifecycle.js (business logic)
  ├─ join/leave/start/cancel/onExpire
  ├─ orchestrate store + engine + timeout + renderer
  └─ exposed: sweepOnStartup(client)

roll-session-store.js (DB CRUD + state machine)
  ├─ createSession, getSession, setMessageId
  ├─ addParticipant, removeParticipant, listParticipants, isParticipant, countParticipants
  ├─ getActiveSessionByGuild (state IN ('open','rolling'))
  ├─ transitionToRolling, settleScores, cancelSession
  └─ STATE constant export

roll-engine.js (random)
  └─ rollScores(n, scoreMax): int[]

roll-timeout.js (timer)
  ├─ set(sessionId, ms, callback)
  ├─ clear(sessionId)
  └─ Map<sessionId, Timeout>
```

## Related Code Files

- **Create:**
  - `bot/src/modules/mini-game/services/roll-session-store.js`
  - `bot/src/modules/mini-game/services/roll-engine.js`
  - `bot/src/modules/mini-game/services/roll-timeout.js`
  - `bot/src/modules/mini-game/services/roll-lifecycle.js`
- **Reference (đọc để học pattern):**
  - `bot/src/modules/mini-game/services/pvp-match-store.js`
  - `bot/src/modules/mini-game/services/match-timeout.js`
  - `bot/src/modules/mini-game/services/rps-lifecycle.js`

## Implementation Steps

### 2.1. `roll-engine.js`

<!-- Updated: Validation Session 1 - hardcode SCORE_MAX, bỏ param scoreMax -->
```js
const crypto = require('crypto')

const SCORE_MAX = 100

function rollScores(n) {
  if (n < 1 || n > SCORE_MAX) throw new Error(`n phải 1..${SCORE_MAX}`)
  const pool = Array.from({ length: SCORE_MAX }, (_, i) => i + 1)
  for (let i = 0; i < n; i++) {
    const j = i + crypto.randomInt(pool.length - i)
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, n)
}

module.exports = { rollScores, SCORE_MAX }
```

### 2.2. `roll-timeout.js`

Pattern y hệt `match-timeout.js` (đọc tham khảo). Map module-level, set/clear theo sessionId.

### 2.3. `roll-session-store.js`

Functions:
- `STATE` const: `{ OPEN: 'open', ROLLING: 'rolling', FINISHED: 'finished', CANCELLED: 'cancelled' }`
- `createSession({ guildId, channelId, messageId, hostId, maxPlayers, expiresAt })` → return session row (bỏ scoreMax — Validation S1)
- `setMessageId(sessionId, messageId)`
- `getSession(sessionId)`
- `getActiveSessionByGuild(guildId)` — state IN ('open','rolling')
- `addParticipant(sessionId, userId)` — INSERT OR IGNORE (idempotent)
- `removeParticipant(sessionId, userId)`
- `isParticipant(sessionId, userId)` → boolean
- `listParticipants(sessionId)` → rows [{ user_id, score, joined_at }]
- `countParticipants(sessionId)` → int
- `transitionToRolling(sessionId)` — UPDATE ... WHERE state='open', return ok/false
- `settleScores(sessionId, scoresMap)` — transaction: update participant.score + session winner_id/winner_score/state='finished'/finished_at
- `cancelSession(sessionId, reason)` — UPDATE WHERE state IN ('open','rolling'), set state='cancelled'/cancel_reason/finished_at

Mọi mutation đụng nhiều row wrap `db.transaction()`.

### 2.4. `roll-lifecycle.js`

Functions (orchestration, gọi từ button-handler + command):
- `onJoin(interaction, sessionId)` — toggle: nếu đã join → leave; nếu chưa → check max → add; trigger embed edit (debounce)
- `onCancel(interaction, sessionId)` — permission check (host hoặc admin), gọi store.cancelSession, edit embed, clear timer
- `onStart(interaction, sessionId)` — permission check, count >= 2, transitionToRolling, gọi engine, settleScores, edit final embed, clear timer
- `onExpire(client, sessionId)` — gọi từ timer: nếu state='open' → cancel với reason "Hết hạn, host không chốt" (kể cả đủ 2 người, vẫn cần host chốt theo brainstorm decision)
- `sweepOnStartup(client)` — query state IN ('open','rolling'), với mỗi row:
  - `state='rolling'` → force-cancel "Bot restart giữa lúc roll"
  - `expires_at < now` → cancel "Hết hạn khi bot restart"
  - `expires_at > now` → re-schedule timer qua `roll-timeout.set`

### 2.5. Compile check

```bash
cd f:/projects/bot_discord_app
node -e "require('./bot/src/modules/mini-game/services/roll-engine.js')"
node -e "require('./bot/src/modules/mini-game/services/roll-timeout.js')"
node -e "require('./bot/src/modules/mini-game/services/roll-session-store.js')"
node -e "require('./bot/src/modules/mini-game/services/roll-lifecycle.js')"
```

## Success Criteria

- [ ] 4 file service được tạo, mỗi file < 200 dòng
- [ ] `rollScores(5, 100)` → 5 số unique trong [1..100], chạy 1000 lần không trùng nội bộ
- [ ] `addParticipant` idempotent (gọi 2 lần không tạo duplicate)
- [ ] `transitionToRolling` race-safe (2 concurrent call → chỉ 1 success)
- [ ] `cancelSession` chuyển state đúng + ghi reason
- [ ] `sweepOnStartup` xử lý đúng 3 case (stuck rolling / expired / future)

## Red Team Fixes (2026-05-25)

### F6 [High] `addParticipant` atomic capacity check
Thay 2-step (count → insert) bằng 1 SQL atomic, check `info.changes === 1`:

```js
function tryAddParticipant(sessionId, userId) {
  const info = db().prepare(`
    INSERT INTO roll_participant (session_id, user_id, score, joined_at)
    SELECT ?, ?, NULL, unixepoch()
    WHERE NOT EXISTS (SELECT 1 FROM roll_participant WHERE session_id=? AND user_id=?)
      AND (SELECT COUNT(*) FROM roll_participant WHERE session_id=?) <
          (SELECT max_players FROM roll_session WHERE id=? AND state='open')
  `).run(sessionId, userId, sessionId, userId, sessionId, sessionId)
  return info.changes === 1
}
```
Lifecycle `onJoin` toggle: nếu `isParticipant` → remove; nếu chưa → `tryAdd` → false thì ephemeral "Đã đủ X/X người" hoặc "Session đã đóng".

### F8 [High] Wrap rolling + settle trong 1 transaction
`onStart` flow phải atomic — không tách `transitionToRolling` ra trước rồi mới `settleScores`:

```js
const result = db().transaction(() => {
  const r = db().prepare(`UPDATE roll_session SET state='rolling' WHERE id=? AND state='open'`).run(sessionId)
  if (r.changes !== 1) return null
  const parts = listParticipantsOrdered(sessionId) // ORDER BY joined_at, user_id
  const scores = rollScores(parts.length, scoreMax)
  // bulk update scores + finalize session row
  ...
  db().prepare(`UPDATE roll_session SET state='finished', winner_id=?, winner_score=?, finished_at=unixepoch() WHERE id=?`).run(winner, max, sessionId)
  return { parts, scores }
})()
```
Loại bỏ window crash-mid-roll. `listParticipants` cho settle phải `ORDER BY joined_at ASC, user_id ASC` (deterministic binding, F5 security).

### F10 [High] Timer guard — chỉ cancel khi state='open'
`onExpire`:
```js
const info = db().prepare(`UPDATE roll_session SET state='cancelled', cancel_reason=?, finished_at=unixepoch() WHERE id=? AND state='open'`).run('Hết hạn', sessionId)
if (info.changes === 0) return // đã transition sang rolling/finished/cancelled bởi flow khác
```
`onStart`/`onCancel` phải `timeoutMgr.clear(sessionId)` **trước** khi mở transaction. `cancelSession` user-triggered chỉ cho `state='open'` (không cho cancel khi `rolling`).

### F12 [Medium] `allowedMentions` mặc định không ping
Mọi `channel.send` / `msg.edit` ở renderer/lifecycle phải truyền:
- Pending/cancel embed: `allowedMentions: { parse: [] }`
- Result embed: `allowedMentions: { users: [winnerId] }` (chỉ ping winner)

### Cleanup timer/edit Map
`settleScores` + `cancelSession` post-commit phải gọi `roll-timeout.clear(sessionId)` + `renderer.dropSession(sessionId)` để xóa entry Map (chống leak dài hạn).

## Risk Assessment

| Risk | Severity | Mitigation |
|------|---------|-----------|
| Race condition 2 admin bấm Bắt đầu | Medium | `UPDATE ... WHERE state='open'` + check `info.changes === 1` |
| Timer leak khi cancel | Low | `cancelSession` luôn `roll-timeout.clear()` trước khi return |
| `crypto.randomInt` block synchronous | Very Low | N ≤ 100, vài microsecond |
