# Phase 04 — Mini-game module pilot

## Overview
- Priority: must (pilot validate kiến trúc)
- Status: ⏳ pending
- Estimate: L (~5-6h, PvP state machine + escrow + modal/button routing)
- Mockup PvP: [mockup-rps-pvp.html](mockup-rps-pvp.html)
- Mockup vs-bot cũ (tham khảo UX, không dùng nữa): [mockup-rps-game.html](mockup-rps-game.html)
- Depends: Phase 01, 02, 03

Cài module `mini-game` với 3 game + 1 service quản session in-memory.

## Files (new)
- `bot/src/modules/mini-game/manifest.js`
- `bot/src/modules/mini-game/register.js` (đăng ký button + modal router vào client)
- `bot/src/modules/mini-game/commands/rps.js`
- `bot/src/modules/mini-game/commands/odd-even.js`
- `bot/src/modules/mini-game/commands/guess-number.js`
- `bot/src/modules/mini-game/commands/coin.js`
- `bot/src/modules/mini-game/services/pvp-match.js`
- `bot/src/modules/mini-game/services/rps-engine.js`
- `bot/src/modules/mini-game/services/oddeven-engine.js`
- `bot/src/modules/mini-game/services/guess-engine.js`
- `bot/src/modules/mini-game/services/timeout-manager.js`
- `bot/src/modules/mini-game/handlers/button-router.js`
- `bot/src/modules/mini-game/handlers/modal-router.js`

## Manifest

```js
module.exports = {
  key: 'mini-game',
  name: 'Mini Game',
  description: 'Đoán số, kéo búa bao, chẵn lẻ — thắng được cộng coin',
  defaultEnabled: false,
  commands: ['guess-number', 'rps', 'odd-even', 'coin'],
}
```

## UI pattern — PvP (1v1) với button-based UI

**Tất cả 3 game đều PvP 1v1, có cược coin, KHÔNG có mode vs-bot.**

Tham chiếu mockup: [mockup-rps-pvp.html](mockup-rps-pvp.html)

### Match lifecycle chung

```
Challenge → Accept/Decline → Both pick → Reveal → Settle coin
```

Tất cả game dùng pattern này, khác nhau ở bước "pick" và "rule thắng/thua".

### Bảng `pvp_match` (thêm vào Phase 01)

```sql
CREATE TABLE IF NOT EXISTS pvp_match (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id      TEXT NOT NULL,
  channel_id    TEXT NOT NULL,
  message_id    TEXT,           -- message embed bot post, để edit
  game          TEXT NOT NULL,  -- 'rps' | 'oddeven' | 'guess'
  player_a      TEXT NOT NULL,
  player_b      TEXT NOT NULL,
  stake         INTEGER NOT NULL,
  state         TEXT NOT NULL,  -- 'pending'|'picking'|'finished'|'cancelled'
  pick_a        TEXT,
  pick_b        TEXT,
  winner        TEXT,           -- player_id hoặc 'draw'
  created_at    INTEGER DEFAULT (unixepoch()),
  finished_at   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_pvp_state ON pvp_match(state, created_at);
```

### Escrow logic (dùng chung)

| Sự kiện | coin_tx |
|---|---|
| A challenge | `-stake` cho A, reason `pvp:<game>:escrow:matchId` |
| B accept | `-stake` cho B, reason như trên |
| B decline / timeout accept | `+stake` hoàn A |
| Hòa | `+stake` hoàn A, `+stake` hoàn B |
| Có winner | `+2*stake` cho winner |
| Timeout pick: người không chọn = thua | `+2*stake` cho người đã chọn |

### Button customId convention
`<game>:<action>:<matchId>:<userId>`
VD: `rps:pick-scissors:42:432891`, `pvp:accept:42:512004`, `oddeven:pick-odd:43:432891`

Handler `events/interaction-create.js`: nhánh `isButton()` → split customId → route module service. Check `userId` đúng người trước khi xử lý.

### Validation chung trước khi tạo match
- `target_user !== invoker` (không tự thách)
- `target_user.bot === false`
- `target_user` còn trong guild
- Cả 2 đều có `balance >= stake`
- `stake >= 1 && stake <= 1000`
- A không có match `pending`/`picking` khác (chống spam)

---

## Game specs

### `/rps @user [cược=10]`
- A pick một trong 3 (kéo/búa/bao) qua ephemeral 3-button
- B pick độc lập (ẩn cho đến reveal)
- Rule: kéo>bao>búa>kéo. Cùng = hòa.
- Timeout pick 60s → người không chọn = thua

### `/odd-even @user [cược=10]`
- A pick CHẴN/LẺ trước (ephemeral 2-button) — A có quyền chọn bên
- B tự động được gán bên còn lại (không cần pick)
- B chỉ cần bấm "Sẵn sàng" để confirm + tạm giữ coin
- Bot rand 1-100 sau khi cả 2 ready → parity quyết định winner
- Timeout B ready 60s → B thua (mất stake)

### `/guess-number @user [cược=10] [range=100]`
- Bot rand target trong [1, range] khi cả 2 ready
- Mỗi người có 1 lần đoán qua MODAL input (Discord Modal — input number)
  - Modal trigger từ button "🎯 Đoán số" trong ephemeral
- Ai gần hơn target = thắng. Tie (cùng khoảng cách) = hòa.
- Timeout đoán 60s → người chưa đoán = thua

---

## Service architecture

```
modules/mini-game/
  manifest.js
  services/
    pvp-match.js       # CRUD match state, escrow coin tx (transaction)
    rps-engine.js      # judgeRps(a, b) -> 'a'|'b'|'draw'
    oddeven-engine.js  # rollOddEven() -> {value, parity}
    guess-engine.js    # judgeGuess(target, guessA, guessB) -> winner
    timeout-manager.js # setTimeout per match, cleanup on settle
  commands/
    rps.js
    odd-even.js
    guess-number.js
    coin.js
  handlers/
    button-router.js   # parse customId → dispatch
    modal-router.js    # cho guess-number modal submit
```

Tách engine khỏi command để test thuần (no Discord deps). Pvp-match service làm trung tâm: tạo/update state, gọi escrow trong transaction, trigger reveal khi đủ 2 pick.

### `/coin` (helper)
- Subcommand `balance`: hiện coin của user
- Subcommand `history`: list 5 tx gần nhất

## Service `game-session.js`

```js
// In-memory Map cho guess-number
// key: `${guildId}:${channelId}` → { target, min, max, startedBy, expiresAt, timeoutId }
exports.start(guildId, channelId, target, min, max, startedBy)
exports.get(guildId, channelId)
exports.end(guildId, channelId)  // clearTimeout + delete
```

Timeout auto-cleanup: 10 phút sau `start` → channel.send "Hết giờ! Đáp án là X".  Cần ref đến `client` → service nhận `client` qua init hoặc inject vào lúc start. Đơn giản: lưu `channelObj` ref trong session, dùng `channelObj.send`.

## Steps
1. Tạo folder + manifest
2. Cài `services/game-session.js` với Map + timeout logic
3. Cài 4 command file theo template discord.js v14 SlashCommandBuilder
4. Mỗi command import `addCoin`/`getCoin` từ `shared/db.js`
4b. Mỗi command kết thúc gọi `logModuleUsage({guildId, moduleKey:'mini-game', command, userId, userName, result, coinDelta, meta})` — dùng cho dashboard detail panel
5. Re-deploy slash commands (`npm run deploy:commands` hoặc tự auto-register lúc bot ready)
6. Manual test trên dev guild: bật module qua DB tay (`UPDATE guild_modules ...`) hoặc chờ Phase 05

## Todo
- [ ] `manifest.js` + `register.js` (gắn button + modal router)
- [ ] `services/pvp-match.js` (CRUD + escrow transaction)
- [ ] `services/rps-engine.js` + unit test (pure function)
- [ ] `services/oddeven-engine.js` + unit test
- [ ] `services/guess-engine.js` + unit test
- [ ] `services/timeout-manager.js` (Map<matchId, setTimeout>)
- [ ] `handlers/button-router.js` (parse customId → dispatch)
- [ ] `handlers/modal-router.js` (cho guess-number)
- [ ] `commands/rps.js` (slash `/rps @user [cược]` → tạo match)
- [ ] `commands/odd-even.js` (slash `/odd-even @user [cược]`)
- [ ] `commands/guess-number.js` (slash `/guess-number @user [cược] [range]`)
- [ ] `commands/coin.js` (arg-based balance/history)
- [ ] Modify `events/interaction-create.js`: nhánh `isButton()`/`isModalSubmit()` → gọi router
- [ ] Edge case tests: từ chối, timeout accept, timeout pick, hòa, không đủ coin, tự thách, thách bot
- [ ] Compile check: `node -c` từng file
- [ ] Boot bot, verify log `[Modules] Loaded 1 module: mini-game`
- [ ] Manual test 3 game (sau khi enable qua DB hoặc Phase 05)

## Risks
- Discord SlashCommandBuilder không hỗ trợ subcommand lồng đặc biệt → ok, dùng `addSubcommand` chuẩn.
- Auto-register slash command lúc boot dùng `applicationGuildCommands(CLIENT_ID, GUILD_ID)` → chỉ deploy cho 1 guild test. Production có thể cần global commands → ngoài scope.
- Coin âm có thể gây "lạm dụng" (cứ thua cũng được chơi tiếp) → chấp nhận trong pilot, có thể chốt min balance sau.

## Success criteria
- 3 game chạy đúng spec, coin cập nhật khớp với `coin_tx`
- `/coin balance` hiện đúng số dư sau mỗi trận
- Guess-number timeout 10 phút auto-end + thông báo channel
- Tắt module → cả 4 command đều bị gate chặn
