# Phase 03: Discord Commands + Leave/Rejoin Handler

**Priority:** High | **Status:** pending
**Depends on:** Phase 01

## Overview
Slash commands `/bc-stars` + `/bc-leaderboard`. Handler `guildMemberRemove` (soft-delete) + `guildMemberAdd` (restore trong 7 ngày).

## Files
- **Create:**
  - `bot/src/commands/bc-stars.js` (~120 LOC)
  - `bot/src/commands/bc-leaderboard.js` (~120 LOC)
  - `bot/src/events/blesscastle-member-lifecycle.js` (~80 LOC)
- **Modify:**
  - Command loader (nếu auto-load qua Glob, chỉ cần đúng path)
  - Event registration cho `guildMemberRemove`, `guildMemberAdd`

## /bc-stars

```
/bc-stars [user]
```
- Không truyền user → xem của người gõ
- Embed: avatar, ⭐ stars, tiến độ tuần này (voice X phút / min_minutes, hoặc "Đã điểm danh thủ công"), còn thiếu Y sao để đổi quà
- Nếu user chưa có record → hiển thị 0⭐

## /bc-leaderboard

```
/bc-leaderboard
```
- Embed top 10 stars DESC (deleted_at IS NULL)
- Tie-break: last_updated ASC (ai đạt sớm hơn xếp trước)
- Medal 🥇🥈🥉 cho top 3
- Footer: tổng số member có sao

## Member lifecycle

```js
// guildMemberRemove: soft-delete
db.softDeleteUser(guildId, userId)

// guildMemberAdd: nếu có row soft-deleted trong 7 ngày → restore
const row = db.getStars(guildId, userId)
if (row && row.deleted_at && (now - row.deleted_at) < 7*86400*1000) {
  db.restoreUser(guildId, userId)
}
```

## Command style
- Reuse pattern từ `bot/src/commands/voice-stats.js` (SlashCommandBuilder, EmbedBuilder, `resolveDisplay`)
- Message tiếng Việt có dấu (theo `.claude/rules/i18n.md`)

## Todo
- [ ] `/bc-stars` command file + logic
- [ ] `/bc-leaderboard` command file + logic
- [ ] Member lifecycle event file
- [ ] Register events trong bot bootstrap
- [ ] Test embed render (không lỗi khi 0 record)

## Success Criteria
- Gõ `/bc-stars` → thấy sao của mình + progress tuần
- Gõ `/bc-leaderboard` → top 10, format đẹp
- Kick 1 member → row `deleted_at` được set
- Re-invite trong 7 ngày → stars trở về active

## Risks
- Bot thiếu Intent `GuildMembers` → member events không fire (check config existing)
- Command register slash: đảm bảo deploy commands script re-run
