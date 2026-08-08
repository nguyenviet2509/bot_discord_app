---
phase: 3
name: Verify Multi-Guild End-to-End + Bot Spot Check
status: pending
priority: high
effort: S
---

# Phase 3: Verify & Test

## Overview
Smoke test toàn bộ tab dashboard với 2+ guild, spot check bot code có chỗ nào ngầm hardcode GUILD_ID gây bug đa guild.

## Setup test
- 2 Discord guild test (hoặc 1 thật + 1 dev)
- Bot join cả 2
- Insert vài record mỗi guild (level user, scheduled msg, event...) để có data phân biệt

## Test checklist (manual)

### Dashboard tab tests
Cho mỗi tab, switch guild A → check data, switch guild B → check data đổi:
- [ ] Tổng quan / Analytics (summary, heatmap, top channels, growth)
- [ ] Leaderboard / Members
- [ ] Rewards
- [ ] Settings (XP min/max, channels)
- [ ] Level Up Template
- [ ] Welcome Template
- [ ] Level React
- [ ] Scheduled Messages
- [ ] Events
- [ ] Auto-Mod
- [ ] Honor
- [ ] Moderation
- [ ] Links
- [ ] Voice Log
- [ ] Voice Stats (leaderboard + heatmap)
- [ ] World Cup
- [ ] Roll History

### API contract tests
- [ ] `GET /api/analytics/summary` → 400 nếu không truyền `guildId` và env trống
- [ ] `GET /api/analytics/summary?guildId=fake123` → 403
- [ ] `GET /api/analytics/summary?guildId=<valid>` → 200, data đúng guild

### Frontend tests
- [ ] Load lần đầu (localStorage trống): chọn guild đầu, lưu localStorage
- [ ] Switch guild trong dropdown → reload → tab hiển thị data guild mới
- [ ] F5 sau switch → giữ guild đã chọn
- [ ] Bot không join guild nào: dropdown hiện "Bot chưa join guild"
- [ ] Token hết hạn giữa chừng → redirect login

## Bot spot check
Grep `process.env.GUILD_ID` trong `bot/`:
- [ ] `bot/src/index.js` line 23 → xem context: nếu là scheduled task / startup scan → đảm bảo iterate qua DB guild_id hoặc tất cả bot.guilds.cache, không hardcode env
- [ ] `bot/src/deploy-commands.js` line 2 → script CLI deploy slash command theo guild. **Giữ nguyên**: deploy command chạy thủ công, env GUILD_ID = test guild OK. Nếu cần deploy global → tách script khác.

**Action:** Nếu `bot/src/index.js` có scheduled task chỉ chạy cho env GUILD_ID → log warning + tạo follow-up task (không fix trong plan này).

## Todo
- [ ] Setup 2 guild test
- [ ] Chạy 17 tab checklist
- [ ] Test API contract (400/403/200)
- [ ] Test frontend persistence
- [ ] Spot check `bot/src/index.js` GUILD_ID usage
- [ ] Document tab/feature nào CÒN hardcode (nếu có) trong report

## Success Criteria
- 17/17 tab pass với 2 guild khác nhau
- 0 tab leak data guild khác
- Bot không crash khi nhận event từ guild không phải env GUILD_ID
- Final grep `process.env.GUILD_ID` chỉ còn ở:
  - `dashboard/middleware/guild-context.js` (fallback)
  - `bot/src/deploy-commands.js` (CLI tool, OK)
  - `.env.example`

## Output
Report: `plans/reports/test-260622-{date}-multi-guild-verify.md`
- Tab nào pass / fail
- Bug phát hiện
- Follow-up cho bot scheduler nếu cần

## Risks
- Discord rate limit khi test với 2 guild → spaced out
- Test data ít → một số tab khó verify (dùng SQL trực tiếp confirm)
