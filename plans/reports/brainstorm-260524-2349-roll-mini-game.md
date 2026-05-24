# Brainstorm: Mini-game ROLL (multi-player)

**Ngày:** 2026-05-24
**Module:** `bot/src/modules/mini-game`
**Tham chiếu pattern:** mini-game RPS PvP hiện có (1v1)

---

## 1. Problem statement

User muốn thêm mini-game ROLL multi-player vào module mini-game (giống RPS đã có). Khác với RPS 1v1, ROLL là multi-player với 2 phase đăng ký + quay random unique 1-100.

**Yêu cầu chốt:**
- 2 phase: `/roll-start` mở session → host bấm nút "Bắt đầu roll" → kết thúc + vinh danh top 1
- Random uniform unique pool [1..100], member không trùng điểm
- Không cược coin (chế độ vui)
- Chỉ admin/mod (ManageGuild) tạo session + chốt
- 1 guild = 1 session active
- Lưu DB đầy đủ + dashboard view/clear

---

## 2. Final design

### 2.1. File structure

```
bot/src/modules/mini-game/
├── commands/
│   └── roll.js                    # /roll-start slash command
├── handlers/
│   └── roll-button-handler.js     # route `mg:roll:*`
├── services/
│   ├── roll-session-store.js      # CRUD + state machine
│   ├── roll-lifecycle.js          # join/leave/start/cancel/expire/sweep
│   ├── roll-renderer.js           # embed + button builders + debounce edit
│   ├── roll-engine.js             # Fisher-Yates partial (crypto.randomInt)
│   └── roll-timeout.js            # timer manager (Map<sessionId, Timeout>)
├── manifest.js                    # cập nhật commands list
└── register.js                    # đăng ký roll-button-handler + sweepOnStartup
```

### 2.2. DB schema (extend `shared/db-mini-game.js`)

```sql
CREATE TABLE IF NOT EXISTS roll_session (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id      TEXT NOT NULL,
  channel_id    TEXT NOT NULL,
  message_id    TEXT,
  host_id       TEXT NOT NULL,
  max_players   INTEGER NOT NULL DEFAULT 100,
  score_max     INTEGER NOT NULL DEFAULT 100,  -- forward-compat
  state         TEXT NOT NULL,   -- 'open' | 'rolling' | 'finished' | 'cancelled'
  expires_at    INTEGER NOT NULL,
  winner_id     TEXT,
  winner_score  INTEGER,
  cancel_reason TEXT,
  created_at    INTEGER DEFAULT (unixepoch()),
  finished_at   INTEGER
);
CREATE INDEX idx_roll_state ON roll_session(guild_id, state);
CREATE INDEX idx_roll_created ON roll_session(guild_id, created_at DESC);

CREATE TABLE IF NOT EXISTS roll_participant (
  session_id  INTEGER NOT NULL,
  user_id     TEXT NOT NULL,
  score       INTEGER,
  joined_at   INTEGER DEFAULT (unixepoch()),
  PRIMARY KEY (session_id, user_id),
  FOREIGN KEY (session_id) REFERENCES roll_session(id) ON DELETE CASCADE
);
CREATE INDEX idx_roll_part_session ON roll_participant(session_id, score DESC);
```

### 2.3. Slash command

```
/roll-start
  so-nguoi-toi-da : int 2-100  (default 100)
  thoi-han-phut   : int 1-60   (default 5)
```
- Permission gate: `PermissionsBitField.Flags.ManageGuild`
- Reject nếu guild đã có session `state IN ('open','rolling')`

### 2.4. State machine

```
open ──▶ rolling ──▶ finished
  │
  └──▶ cancelled
       (host hủy / timeout < 2 người / bot restart sweep)
```
Mọi transition wrap `db.transaction()` + WHERE `state='open'` để tránh race.

### 2.5. UI flow

**Pending embed** (state=open):
- Title `🎲 ROLL Session #N`
- Host + thời hạn `<t:expires_at:R>` + live count `X/MAX`
- Danh sách participants (mention)

**Buttons:**
- 🎯 **Tham gia** / **Rời khỏi** (toggle theo `roll_participant` row tồn tại)
- ▶️ **Bắt đầu roll** (chỉ host hoặc admin)
- ❌ **Hủy** (chỉ host hoặc admin)

**Result embed** (state=finished):
- 👑 Winner ping + score
- Full ranking sorted desc (huy chương 🥇🥈🥉 cho top 3)
- Buttons disable hết

### 2.6. Random algorithm (`roll-engine.js`)

Fisher-Yates partial từ pool `[1..score_max]`, lấy `n` số đầu, dùng `crypto.randomInt` (uniform, audit-proof).

Phase 1: clamp `n ≤ 100`, `score_max = 100`. Sau này muốn mở rộng chỉ cần config `score_max` qua option lệnh.

### 2.7. Button customId schema

```
mg:roll:join:<sessionId>     toggle join/leave
mg:roll:start:<sessionId>    chốt + roll
mg:roll:cancel:<sessionId>   hủy
```

### 2.8. Edge cases + xử lý

| Case | Xử lý |
|------|------|
| User join khi đã trong list | Toggle thành leave |
| User join khi đã đầy MAX | Reply ephemeral "Đã đủ X/X" |
| Click button khi state ≠ `open` | Reply ephemeral "Session đã kết thúc" |
| Host bấm Bắt đầu nhưng < 2 người | Reply "Cần ≥ 2 người" |
| Timeout đến + < 2 người | Auto-cancel, edit embed "Hết hạn, không đủ người" |
| Non-admin bấm Bắt đầu/Hủy | Permission reject ephemeral |
| Message bị xóa thủ công | Catch error fetch/edit, vẫn finalize DB |
| Bot restart giữa chừng | Startup sweep (xem 2.10) |

### 2.9. Edit embed debounce (giải quyết spam)

Map module-level `editTimers: Map<sessionId, Timeout>`:
```js
function scheduleEdit(sessionId, editFn) {
  if (editTimers.has(sessionId)) clearTimeout(editTimers.get(sessionId))
  editTimers.set(sessionId, setTimeout(async () => {
    editTimers.delete(sessionId)
    try { await editFn() } catch (err) { console.error(err) }
  }, 1000))
}
```
- Join/leave → `scheduleEdit` (debounce 1s)
- State change quan trọng (start/cancel/finish) → edit ngay, `clearTimeout` pending nếu có

### 2.10. Startup sweep (giải quyết zombie session)

`bot/src/modules/mini-game/services/roll-lifecycle.js`:
```js
async function sweepOnStartup(client) {
  const sessions = db().prepare(
    "SELECT * FROM roll_session WHERE state IN ('open','rolling')"
  ).all()
  const now = Math.floor(Date.now() / 1000)
  for (const s of sessions) {
    if (s.state === 'rolling') {
      // Stuck rolling từ trước restart → force cancel
      await cancelSession(client, s.id, 'Bot restart giữa lúc roll')
    } else if (s.expires_at < now) {
      await cancelSession(client, s.id, 'Hết hạn khi bot restart')
    } else {
      // Re-schedule timer
      const diff = (s.expires_at - now) * 1000
      rollTimeout.set(s.id, diff, () => onExpire(client, s.id))
    }
  }
}
```
Gọi từ `register.js` hoặc `bot/src/index.js` trong `client.once('ready', ...)`.

### 2.11. Dashboard "Lịch sử ROLL"

**Backend** `dashboard/routes/roll-history.js`:
- `GET /api/roll-history?guildId=&from=&to=&page=&pageSize=` — list paginated
- `GET /api/roll-history/:id` — detail + full participants với điểm
- `DELETE /api/roll-history?olderThanDays=N&guildId=` — clear theo ngày
- `DELETE /api/roll-history/all?guildId=` — nuke (body confirm token)

**Frontend** `dashboard/public/roll-history.html` + `js/roll-history.js`:
- Tuân thủ `.claude/skills/dashboard-layout/SKILL.md`
- Filter: guild dropdown + date range
- Bảng pagination + click row → modal detail
- 2 nút clear (top-right): "Xóa session > N ngày" (input N) + "Xóa tất cả" (modal confirm)

### 2.12. Manifest update

```js
module.exports = {
  key: 'mini-game',
  name: 'Mini Game',
  description: 'RPS PvP + ROLL multi-player',
  defaultEnabled: false,
  commands: ['rps', 'coin', 'roll-start'],
}
```

---

## 3. Approaches evaluated (alternatives rejected)

### 3.1. Pool scale

| Option | Rejected because |
|--------|------------------|
| Pool 1..1000 ngay phase 1 | UX kém (số to khó nhớ), lãng phí cho event nhỏ |
| Score float | Khó so sánh, fair cảm tính kém |
| Giữ 100 cứng | Technical debt, migration phá sau khó |

→ **Chosen:** Cột `score_max` forward-compat.

### 3.2. Edit embed

| Option | Rejected because |
|--------|------------------|
| Leading + trailing debounce 3s | Phức tạp hơn, marginal benefit |
| Bỏ live count | Mất hứng theo dõi event |

→ **Chosen:** Debounce 1s coalesce + bypass khi state change.

### 3.3. Zombie session

| Option | Rejected because |
|--------|------------------|
| Interval polling 60s | Cancel chậm, embed "ma" 1 phút |
| A + interval 5 phút | Có thể YAGNI, A đủ tốt |

→ **Chosen:** Startup sweep + re-schedule timer + stuck-rolling guard.

---

## 4. Implementation phases

| Phase | Nội dung | Files |
|-------|---------|-------|
| 1 | DB schema + helpers | `shared/db-mini-game.js` |
| 2 | Services (store, engine, timeout, lifecycle) | `services/roll-*.js` |
| 3 | Renderer + debounce edit + button handler | `services/roll-renderer.js`, `handlers/roll-button-handler.js` |
| 4 | Slash command + register | `commands/roll.js`, `register.js`, `manifest.js` |
| 5 | Startup sweep + re-schedule | `bot/src/index.js` hook, `roll-lifecycle.js` |
| 6 | Dashboard route + page + JS | `dashboard/routes/roll-history.js`, `dashboard/public/roll-history.html`, `js/roll-history.js` |
| 7 | Test + docs | Manual test + `docs/codebase-summary.md` |

---

## 5. Success criteria

- [ ] `/roll-start` tạo session, post embed có 3 nút, ping admin role nếu cấu hình
- [ ] User bấm Tham gia → join, bấm lại → leave; embed live update (debounce 1s)
- [ ] 1 user join nhiều lần → không tạo duplicate row
- [ ] 1 guild có 2 session đồng thời → reject
- [ ] Host bấm Bắt đầu roll → tất cả participant nhận điểm unique 1-100, top 1 vinh danh ping
- [ ] Timeout đến + < 2 người → auto-cancel
- [ ] Bot restart giữa chừng → session pending còn timer → tự cancel khi hết hạn
- [ ] Bot restart sau session đã quá hạn → cancel ngay khi bot ready
- [ ] Dashboard list session + filter guild/date + xem detail + clear > N ngày + nuke

---

## 6. Risks + mitigation

| Risk | Severity | Mitigation |
|------|---------|-----------|
| Discord rate limit khi nhiều người join | Medium | Debounce 1s coalesce |
| Race condition (2 admin bấm Bắt đầu) | Low | SQLite transaction + WHERE state='open' |
| Bot crash → zombie session | Medium | Startup sweep + dashboard nuke |
| Foreign key delete cascade chậm với 10K+ session | Low | Index trên `session_id`, batch delete trong dashboard |
| Crypto.randomInt fail (entropy thấp) | Very Low | Node.js stable, không cần fallback |

---

## 7. Out of scope (phase 1)

- Cược coin (có thể add sau bằng cách extend schema + escrow pattern như RPS)
- Multiple sessions/guild
- Leaderboard cross-session
- Custom score range qua option lệnh (đã có forward-compat column)
- Live progress bar khi rolling (animation chỉ tốn complexity)

---

## 8. Next steps

→ Chuyển sang `/ck:plan` để tạo plan file chi tiết theo từng phase.
