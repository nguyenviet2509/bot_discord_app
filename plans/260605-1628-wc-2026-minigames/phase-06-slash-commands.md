# Phase 06 — Slash Commands `/wc-leaderboard` & `/wc-prizes`

**Status:** pending | **Priority:** P1 | **Effort:** XS (~2h)
**Depends on:** Phase 01, 05

## Files

**Create:**
- `bot/src/modules/wc-pickem/commands/wc-leaderboard.js`
- `bot/src/modules/wc-pickem/commands/wc-prizes.js`

## Commands

### /wc-leaderboard [game]
- Option `game`: choice `pickem` | `bracket` | `total` (default = `total`)
- Reply public embed top 10 + rank của user gọi lệnh
- Format: `🥇 1. @user — 45 pt` (resolve displayName)

### /wc-prizes [game]
- Option `game`: choice `pickem` | `bracket` (default = `pickem`)
- Đọc `wc_prizes_config` của guild + game
- Reply embed liệt kê top1/top3/top10 với title + description (markdown → plain) + image
- Nếu chưa setup → "Admin chưa cấu hình giải thưởng. Liên hệ admin."

## Todo

- [ ] `wc-leaderboard.js`: query getLeaderboard, render embed, paginate 10 dòng
- [ ] `wc-prizes.js`: query getPrizes, render embed 3 tier với thumbnail = imageUrl
- [ ] Register vào module manifest `commands` array (đã có sẵn từ Phase 03)
- [ ] Test slash command deploy + execute trong test guild

## Success Criteria

- 2 lệnh chạy không lỗi
- Embed hiển thị đúng top 10 + rank user
- Prizes embed hiển thị ảnh (Discord support image qua URL)
