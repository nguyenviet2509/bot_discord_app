# Phase 6 — Bot Command `/vinhdanh-history`

**Priority:** P2
**Status:** pending
**Effort:** S (~30 min)
**Depends on:** Phase 1

## Overview
Slash command liệt kê 10 lần vinh danh gần nhất trong guild. Render dạng embed text gọn, link tới message gốc.

## Related files
- **Create:** `bot/src/commands/vinh-danh-history.js`

## Command shape

```js
new SlashCommandBuilder()
  .setName('vinhdanh-history')
  .setDescription('Xem 10 lần vinh danh gần nhất')
  .addIntegerOption(o => o.setName('limit').setDescription('Số lượng (max 20)').setMinValue(1).setMaxValue(20))
```

## Output

```
🏛️ Lịch sử Vinh Danh — Bellatra Clan

1. 📅 18/05/2026 — BẢNG VÀNG THÁNG 5/2026
   🥇 @champ  🥈 @runner  🥉 @third
   👤 bởi @admin · [Xem](message_link)

2. 📅 12/04/2026 — ...
   ...
```

- Title: "🏛️ Lịch sử Vinh Danh — {guild.name}"
- Description: render 10 record dạng list
- Message link: `https://discord.com/channels/{guild_id}/{channel_id}/{message_id}`
- Nếu không có record → "Chưa có lần vinh danh nào."

## Implementation steps
1. Tạo `bot/src/commands/vinh-danh-history.js`
2. Trong execute:
   - `listHonorHistory(guildId, limit)`
   - Format từng record thành line
   - Build embed text
   - Reply ephemeral (chỉ user gõ lệnh thấy)
3. Anyone xem được (không cần permission check)

## Todo
- [ ] Tạo vinh-danh-history.js
- [ ] Format render đẹp với mention 3 user
- [ ] Test với 0, 1, 10+ records

## Success criteria
- Gõ `/vinhdanh-history` → reply ephemeral chứa list 10 record gần nhất
- Link "Xem" mở đúng message Discord
- 0 record → message thân thiện
