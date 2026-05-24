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

```js
const crypto = require('crypto')

function rollScores(n, scoreMax = 100) {
  if (n < 1 || n > scoreMax) throw new Error(`n phải 1..${scoreMax}`)
  const pool = Array.from({ length: scoreMax }, (_, i) => i + 1)
  for (let i = 0; i < n; i++) {
    const j = i + crypto.randomInt(pool.length - i)
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, n)
}

module.exports = { rollScores }
```

### 2.2. `roll-timeout.js`

Pattern y hệt `match-timeout.js` (đọc tham khảo). Map module-level, set/clear theo sessionId.

### 2.3. `roll-session-store.js`

Functions:
- `STATE` const: `{ OPEN: 'open', ROLLING: 'rolling', FINISHED: 'finished', CANCELLED: 'cancelled' }`
- `createSession({ guildId, channelId, hostId, maxPlayers, scoreMax, expiresAt })` → return session row
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

## Risk Assessment

| Risk | Severity | Mitigation |
|------|---------|-----------|
| Race condition 2 admin bấm Bắt đầu | Medium | `UPDATE ... WHERE state='open'` + check `info.changes === 1` |
| Timer leak khi cancel | Low | `cancelSession` luôn `roll-timeout.clear()` trước khi return |
| `crypto.randomInt` block synchronous | Very Low | N ≤ 100, vài microsecond |
