---
type: red-team
date: 2026-06-22
target: plans/260622-0925-dashboard-multi-guild-switcher/
reviewer: adversarial
---

# Red Team Review: Dashboard Multi-Guild Switcher

Brutal mode. Skip what works. Focus failure modes.

## CRITICAL Findings

### C1. Slash commands KHÔNG deploy được vào guild mới
[bot/src/index.js:57-64](bot/src/index.js#L57-L64) hiện gọi `Routes.applicationGuildCommands(CLIENT_ID, process.env.GUILD_ID)` ở startup.

**Hệ quả:** Bot join guild B → user trong guild B gõ `/rank` → **không có command**. Dashboard hiện guild B nhưng members không tương tác được với bot ⇒ multi-guild **không hoàn chỉnh**.

Plan Phase 3 chỉ "spot check, follow-up sau" — quá nhẹ. Đây là user-facing breakage rõ ràng ngay khi bot join guild thứ 2.

**Fix bắt buộc trong plan:**
- Option A (KISS): Đổi sang **global commands** (`Routes.applicationCommands(CLIENT_ID)`) — Discord prop tới mọi guild trong ~1h, đơn giản.
- Option B: Loop `client.guilds.cache` và register per-guild khi `guildCreate` event fire.

→ **Phải tạo Phase 4** (hoặc đưa vào Phase 1) xử lý slash command registration.

### C2. Standalone HTML pages bị bỏ rơi
Plan Phase 2 nói "audit" 6 standalone HTML (`automod.html`, `events.html`, `honor-config.html`, `roll-history.html`, `worldcup.html`, `levelup-preview.html`) — nhưng các page này:
- Load font + Tailwind + style riêng (xem [automod.html:1-30](dashboard/public/automod.html#L1-L30))
- KHÔNG include `app.js` → không có `state`, không có `apiFetch`, không có guild switcher UI
- Mỗi page tự fetch `/api/...` trực tiếp

**Hệ quả:** Mở `automod.html` → page dùng env GUILD_ID (qua fallback) bất kể user đã chọn guild nào trong SPA. **Data leak / inconsistency.**

Plan estimate "audit" = under-spec. Mỗi standalone page cần:
- Đọc `localStorage.getItem('guildId')`
- Append `guildId` vào mọi fetch (helper inline)
- Hiển thị guild đang xem (avoid confusion)

→ Re-estimate Phase 2 từ M lên **L**, hoặc tách thành Phase 2a (SPA) + Phase 2b (standalone).

## HIGH Findings

### H1. Race condition: tab fetch trước khi guild switcher init
Plan Step 4: "đặt init trước các tab load" — nhưng không show code đảm bảo điều này.

`initGuildSwitcher()` await `/api/servers` (~100-500ms). Trong khoảng đó nếu code khác đã chạy `apiFetch('/api/analytics/summary')`:
- `state.currentGuildId = ''` → wrapper skip append (theo logic `if (state.currentGuildId)`)
- Request gửi không có guildId → BE fallback env → trả guild env, KHÔNG phải guild user chọn
- User thấy data sai trong khoảnh khắc đầu rồi page nhảy data

**Fix:** Wrapper phải **block** (await initPromise) cho tới khi state ready. Hoặc render skeleton/spinner cho tới khi `state.currentGuildId` set.

```js
let initPromise = null
async function ensureGuildReady() {
  if (!initPromise) initPromise = initGuildSwitcher()
  return initPromise
}
async function apiFetch(url, opts) {
  await ensureGuildReady()
  // ...append guildId
}
```

### H2. Cold-cache Discord API fail blocks toàn dashboard
`requireGuildAccess` fetch Discord guilds list on demand. Lần đầu / cache hết hạn → request đợi Discord. Nếu Discord 5xx hoặc network glitch:
- `getAllowedGuilds()` trả `[]` (per code đề xuất)
- `if (allowed.length && !allowed.includes(guildId))` → vì `allowed.length === 0` → **bypass** validate → SECURITY HOLE, hoặc nếu sửa thành fail-closed → mọi request 403.

**Fix:** 
- Pre-warm cache khi server start (`server.js` chạy `getAllowedGuilds()` trước listen)
- Fail-open có log + cảnh báo, hoặc giữ stale cache lâu hơn TTL khi fetch fail
- Phân biệt rõ "cache rỗng vì chưa init" vs "Discord trả rỗng"

### H3. `state.currentGuildId = ''` lúc init = nguy hiểm
LocalStorage trống + dropdown chưa init → mọi fetch trước init không có guildId. Bonus: nếu user clear localStorage giữa session, state vẫn rỗng cho đến reload.

→ Liên quan H1, fix chung.

### H4. Routes không cần guild context nhưng plan mơ hồ
Plan list "skip middleware" cho: `/api/auth`, `/api/servers`, `/api/license`, `/api/admin/licenses`, `/api/managed-bots`, `/api/commands`. Nhưng:
- **`/api/managed-bots`**: lite bot tied to guild_id ([db-managed-bots.js]). Skip middleware = leak. **Phải mount middleware.**
- **`/api/commands`**: là `command_usage` per-guild ([db.js:174-190]) → **phải mount**.
- **`/api/admin/licenses`**: license cross-guild (admin tool) → skip OK.
- **`/api/license`** (public): skip OK (chỉ verify, không truy data guild).

Plan phải classify rõ từng route, không "review từng cái".

## MEDIUM Findings

### M1. `x-guild-id` header = dead code (YAGNI vi phạm)
Plan FE chỉ dùng query param. Header path trong middleware không có ai gọi → bỏ hoặc document use case (e.g., bot-to-dashboard internal call). Không thì xóa.

### M2. Không có rollback plan
Refactor 20 routes + thêm middleware = 1 commit hay nhiều commit? Nếu deploy production rồi phát hiện bug ở routes/honor.js → revert 1 file không đủ (middleware đã require guildId). Plan nên:
- Commit theo phase (BE → FE → verify)
- Hoặc feature flag: `MULTI_GUILD_ENABLED=1` để có thể tắt nhanh

### M3. `/api/discord/roles` và `/api/discord/channels` gọi Discord API per-guild
Hai route này fetch Discord cho guild cụ thể. Plan nhắc "events.js line 131, 313" nhưng quên discord-channels.js và discord-roles.js cũng cần `req.guildId` (không phải env).

Spot check `dashboard/routes/discord-channels.js:4` và `discord-roles.js:4` đã có ref GUILD_ID — confirm scope.

### M4. Test plan thiếu data seed
Phase 3 yêu cầu "2 guild có data phân biệt" nhưng không có script seed. Manual insert 17 tab x 2 guild = workload lớn, dễ skip.

→ Thêm bullet "tạo SQL seed script" hoặc dùng bot thật chạy 1 ngày để tự tích data.

## LOW Findings

### L1. Cache 60s TTL không invalidate khi bot leave/join guild
Bot leave guild C → cache vẫn cho phép guildId=C trong tối đa 60s. Không nghiêm trọng vì bot đã rời (data còn nhưng không update), nhưng cần biết.

### L2. localStorage không clear khi logout
Logout → token xóa, nhưng `localStorage.guildId` còn. Lần login tài khoản admin khác (nếu có) → vẫn dùng guildId cũ. Khi auth là 1 admin chung thì OK, nhưng nếu sau này mở rộng → bug.

### L3. UX: switch guild = full page reload
Plan chọn reload "đơn giản". OK cho MVP nhưng có UX cost: scroll position, form draft, modal đang mở đều mất. Document choice.

### L4. Bot worker spot-check không đủ
[bot/src/index.js:115-260] có **5 setInterval workers**: scheduled messages, event announcements, post poll, temp bans, channel hides. Plan chỉ nói "spot check". Cần verify từng worker query DB có filter env GUILD_ID không.

Grep nhanh: `getDueScheduledMessages(nowSec)` không truyền guildId → khả năng cao iterate hết. **Confirm** chứ đừng đoán.

## Verdict

Plan **không sẵn sàng cook** ở trạng thái hiện tại. Cần update:

1. **Thêm Phase 4** (hoặc lồng vào Phase 1): slash command registration cho multi-guild (Option A global commands hoặc B per-guild on `guildCreate`).
2. **Phase 2 re-estimate L** + tách thành 2a SPA / 2b standalone HTML.
3. **Phase 2 thêm code:** `ensureGuildReady()` block apiFetch tới khi init xong.
4. **Phase 1 thêm:** pre-warm guild cache ở `server.js`, fail-open có log, mount middleware cho `managed-bots` + `commands` (không skip).
5. **Phase 1 xóa** `x-guild-id` header path (YAGNI).
6. **Phase 3 thêm:** seed test data script, verify từng setInterval worker bot side.
7. **Plan-level:** ghi rõ rollback strategy + commit boundary.

## Unresolved Questions
- Slash command: global hay per-guild? (Option A nhanh nhưng có 1h delay khi update; B realtime nhưng phức tạp)
- Feature flag rollout có cần không, hay deploy thẳng?
- `bots-lite` / managed bots có cần migrate đợt này hay defer?
