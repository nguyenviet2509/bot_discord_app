---
type: brainstorm
date: 2026-05-16
slug: mini-bot-modules
status: agreed
---

# Brainstorm — Thêm "bot nhỏ" dạng sub-module vào Discord bot

## 1. Bối cảnh

Dự án hiện tại (`discord-level-bot`): 1 Discord client, auto-load `bot/src/commands/*.js` + `bot/src/events/*.js`. Dashboard Express riêng cấu hình theo guild. User muốn thêm các "bot nhỏ" — KHÔNG dùng token riêng, mà là **sub-module** trong cùng process, mục đích **giải trí + tích hợp ngoài**, **quản lý qua dashboard**.

## 2. Yêu cầu

- Mỗi "bot nhỏ" = 1 module độc lập, đóng gói commands/events/services riêng
- Bật/tắt theo từng guild qua dashboard
- Không phá code hiện có (level, post, mod)
- Dashboard tự động hiện module mới khi thêm folder — không cần sửa UI từng lần
- Pilot: mini-game (guess-number, rps, odd-even) + coin economy mới

## 3. Phương án đã đánh giá

| Phương án | Ưu | Nhược | Quyết định |
|---|---|---|---|
| A. Feature-flag phẳng | Refactor nhẹ nhất | `commands/` phình to, khó tìm | Loại |
| **B. Module folder + manifest** | Đóng gói rõ, dashboard auto-discovery | Cần 1 lần scaffold loader | **CHỌN** |
| C. Plugin runtime (lifecycle/hot-reload) | Mạnh nhất | YAGNI cho scope hiện tại | Loại |

## 4. Giải pháp chốt

### 4.1 Cấu trúc

```
bot/src/
  modules/
    _loader.js           # quét modules/<key>/manifest.js, gọi register(client, ctx)
    mini-game/
      manifest.js
      register.js
      commands/
        guess-number.js
        rps.js
        odd-even.js
      services/
        game-session.js  # in-memory session
  commands/              # GIỮ NGUYÊN = "core module" ẩn (không hiện dashboard)
  events/
  index.js               # thêm: require('./modules/_loader')(client)
```

### 4.2 Manifest contract

```js
// modules/mini-game/manifest.js
module.exports = {
  key: 'mini-game',
  name: 'Mini Game',
  description: 'Đoán số, kéo búa bao, chẵn lẻ — thắng được cộng coin',
  defaultEnabled: false,
  commands: ['guess-number', 'rps', 'odd-even'],
}
```

### 4.3 Loader

- Quét `modules/*/manifest.js`
- Với mỗi module: load `register.js` → load commands vào `client.commands` (gắn metadata `_module = key`)
- Gắn events (nếu có) qua `register(client, ctx)`
- Auto-register slash commands qua REST như hiện tại (`index.js` đã có sẵn)

### 4.4 DB schema mới (`shared/db.js`)

```sql
-- Toggle module per guild
CREATE TABLE IF NOT EXISTS guild_modules (
  guild_id    TEXT NOT NULL,
  module_key  TEXT NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, module_key)
);

-- Coin economy
CREATE TABLE IF NOT EXISTS user_coin (
  guild_id  TEXT NOT NULL,
  user_id   TEXT NOT NULL,
  balance   INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS coin_tx (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  delta      INTEGER NOT NULL,
  reason     TEXT,         -- 'mini-game:rps:win', 'mini-game:odd-even:lose'...
  created_at INTEGER NOT NULL
);
```

Helper API: `getCoin(g,u)`, `addCoin(g,u,delta,reason)`, `isModuleEnabled(g,k)`, `setModuleEnabled(g,k,bool)`, `listModulesForGuild(g)`.

### 4.5 Gate trong `events/interaction-create.js`

```js
const moduleKey = command._module
if (moduleKey && !isModuleEnabled(interaction.guildId, moduleKey)) {
  return interaction.reply({ content: 'Module chưa bật cho server này.', ephemeral: true })
}
```

Core commands (level/post/mod) không có `_module` → bypass gate, hành vi cũ giữ nguyên.

### 4.6 Dashboard

- Route mới: `GET /api/modules?guild_id=...` → list manifest + enabled state
- Route: `POST /api/modules/toggle` → set enabled
- Page mới `/modules`: card mỗi module + switch on/off, ô search

### 4.7 Pilot — Mini-game

| Command | Logic | Reward |
|---|---|---|
| `/guess-number start <min> <max>` + `/guess-number guess <số>` | Bot rand số, user đoán; gần nhất sau N phút thắng | +50 coin |
| `/rps <kéo\|búa\|bao>` | So với bot rand, 3 trạng thái | thắng +10, hoà 0, thua -5 |
| `/odd-even <chẵn\|lẻ> <cược>` | Bot rand 1-100, kiểm tra parity | thắng +cược, thua -cược |

Số dư hiển thị qua `/coin` (thêm vào module mini-game hoặc core, chốt lúc plan).

## 5. Rủi ro & giảm thiểu

- **Slash command name trùng giữa core và module** → loader phát hiện duplicate, throw lỗi rõ ràng khi boot.
- **Module bật nhưng command đăng ký với Discord 1 lần lúc boot** → khi toggle off, command vẫn hiện trên client Discord nhưng bị gate chặn (acceptable). Nếu muốn ẩn hẳn → tốn 1 lần re-register, để v2.
- **DB migration**: dùng `CREATE TABLE IF NOT EXISTS` trong `initDb()` — an toàn với DB sẵn có.
- **Race condition guess-number**: in-memory session đủ cho 1 process; nếu sau này scale → cần Redis (chưa cần).

## 6. Success criteria

- Thêm 1 module mới = tạo folder `modules/<key>/` + 1 manifest + register → dashboard tự nhận, không sửa UI/loader.
- Pilot mini-game hoạt động trên 1 guild test, coin cộng/trừ đúng, dashboard toggle phản ánh ngay (next command).
- Code cũ (level/post/mod) không thay đổi hành vi.

## 7. Bước kế tiếp

1. Scaffold `modules/_loader.js` + manifest contract
2. Thêm bảng `guild_modules`, `user_coin`, `coin_tx` + helper trong `shared/db.js`
3. Sửa `events/interaction-create.js` thêm gate
4. Cài module `mini-game` (3 game) + service `game-session`
5. Dashboard: API + page `/modules`
6. Test end-to-end trên guild dev

## 8. Câu hỏi chưa giải quyết

- `/coin` command thuộc core hay mini-game? (đề xuất: core, vì sau này nhiều module dùng chung)
- Có cần `/coin-leaderboard` riêng hay merge vào `/leaderboard` hiện có? (đề xuất: riêng, để sau)
- Coin có decay theo thời gian không? (giả định: không, plain wallet)
