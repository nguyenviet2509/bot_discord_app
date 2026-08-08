---
phase: 4
name: Verify Multi-Guild End-to-End + Bot Worker Check
status: pending
priority: high
effort: S
---

# Phase 4: Verify & Test

## Overview
Smoke test 17 tab x 2 guild, seed SQL data, verify 5 setInterval workers bot không hardcode env GUILD_ID.

## Setup

### Step 0: Tạo guild test B (THỦ CÔNG TRƯỚC KHI CHẠY)
1. Tạo Discord server mới (hoặc dùng dev server có sẵn)
2. Lấy invite link OAuth bot: `https://discord.com/api/oauth2/authorize?client_id=<CLIENT_ID>&permissions=8&scope=bot+applications.commands`
3. Add bot vào server mới, ghi nhận guildId
4. Bot tự động xuất hiện trong dropdown `/api/servers` (cache 60s)
5. Lưu guildId vào biến `<GUILD_B_ID>` dùng cho seed SQL bên dưới

### Test guilds
- Guild A: production guild (env GUILD_ID)
- Guild B: dev/test guild (bot vừa join ở Step 0)

### Seed SQL script
Tạo `scripts/seed-multi-guild-test.sql`:
```sql
-- Guild B test data (thay <GUILD_B_ID>)
INSERT INTO users (id, guild_id, xp, level, username) VALUES
  ('test_user_1', '<GUILD_B_ID>', 500, 5, 'TestUserB1'),
  ('test_user_2', '<GUILD_B_ID>', 1200, 10, 'TestUserB2');

INSERT INTO guild_settings (guild_id, xp_min, xp_max) VALUES
  ('<GUILD_B_ID>', 20, 30) ON CONFLICT DO NOTHING;

INSERT INTO welcome_template (guild_id, message) VALUES
  ('<GUILD_B_ID>', 'Welcome guild B {user}') ON CONFLICT DO NOTHING;

INSERT INTO activity_buckets (guild_id, weekday, hour, message_count) VALUES
  ('<GUILD_B_ID>', 1, 14, 100),
  ('<GUILD_B_ID>', 3, 20, 50);

INSERT INTO mod_actions (guild_id, action_type, user_id, user_tag, reason)
VALUES ('<GUILD_B_ID>', 'kick', 'fake_user', 'TestKick', 'seed test');

-- Verify
SELECT 'users guild B', COUNT(*) FROM users WHERE guild_id = '<GUILD_B_ID>'
UNION ALL SELECT 'activity buckets', COUNT(*) FROM activity_buckets WHERE guild_id = '<GUILD_B_ID>';
```

Run: `sqlite3 database.sqlite < scripts/seed-multi-guild-test.sql`

## Test Checklist

### Dashboard 17 tab (switch A → B, check data đổi)
- [ ] Tổng quan / Analytics
- [ ] Leaderboard / Members
- [ ] Rewards
- [ ] Settings
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
- [ ] Voice Stats
- [ ] World Cup
- [ ] Roll History

### Standalone pages (mở trực tiếp)
- [ ] `automod.html` data đúng `localStorage.guildId`
- [ ] `events.html`
- [ ] `honor-config.html`
- [ ] `roll-history.html`
- [ ] `worldcup.html`
- [ ] `levelup-preview.html`

### API contract
- [ ] `GET /api/analytics/summary` (no guildId, no env) → 400
- [ ] `GET /api/analytics/summary?guildId=fake123` → 403
- [ ] `GET /api/analytics/summary?guildId=<valid>` → 200

### Frontend behavior
- [ ] Lần đầu (localStorage trống): chọn guild đầu, lưu
- [ ] Switch dropdown → reload → tab đổi data
- [ ] F5 sau switch → giữ guild
- [ ] Logout → localStorage clear cả `token` và `guildId`
- [ ] Token hết hạn giữa chừng → redirect login

### Slash commands (parallel rollout 24h)
- [ ] Bot startup log: "Registered N GLOBAL" + "Also registered guild-scope cho A"
- [ ] `/rank` xuất hiện trong guild A NGAY (qua guild-scope)
- [ ] `/rank` xuất hiện trong guild B sau ~1h (global propagation)
- [ ] Slash chạy trong guild B → response đúng data guild B
- [ ] Sau 24h: chạy `node scripts/cleanup-guild-scope-commands.js`
- [ ] Verify guild A vẫn có `/rank` (qua global) sau cleanup

## Bot Worker Verify (5 setInterval)

Đọc kỹ [bot/src/index.js:115-260], xác nhận mỗi worker:

- [ ] **Scheduled messages worker** ([index.js:115]): `getDueScheduledMessages(nowSec)` không filter guild → iterate hết. ✅ nếu DB function không hardcode guild
- [ ] **Event announcements worker** ([index.js:147]): tương tự, query DB không filter
- [ ] **Post poll watcher** ([index.js:204]): scan posts table không filter
- [ ] **Temp bans watcher** ([index.js:233]): `getExpiredBans` không filter guild → loop và call `guild.bans.remove`. Verify code lấy guild từ record (record có guild_id)
- [ ] **Channel hide watcher** ([index.js:259]): tương tự temp bans

**Action nếu phát hiện hardcode:** Document, không fix trong plan này — tạo follow-up plan riêng.

## Final Grep Check
```bash
grep -rn "process.env.GUILD_ID" dashboard/
# Expect: chỉ ở dashboard/middleware/guild-context.js (fallback)

grep -rn "process.env.GUILD_ID" bot/
# Expect: chỉ ở bot/src/deploy-commands.js (CLI tool, OK)
```

## Todo
- [ ] **Step 0**: Tạo Discord server mới + invite bot + lấy guildId
- [ ] Tạo `scripts/seed-multi-guild-test.sql`
- [ ] Run seed với guildId mới
- [ ] 17 tab x 2 guild = 34 test cases
- [ ] 6 standalone pages
- [ ] API contract 400/403/200
- [ ] FE persistence + logout
- [ ] Slash command guild B sau propagation
- [ ] Đọc 5 setInterval workers verify
- [ ] Final grep clean
- [ ] Viết report: `plans/reports/test-260622-multi-guild-verify.md`
- [ ] Commit Phase 4

## Success Criteria
- 34/34 dashboard test pass
- 6/6 standalone pages pass
- 5/5 bot workers đa guild OK (hoặc document follow-up)
- Grep final clean
- Slash command xuất hiện 2 guild

## Output
Report `plans/reports/test-260622-multi-guild-verify.md`:
- Tab pass/fail
- Bug phát hiện
- Bot worker findings + follow-up

## Risks
- Slash global commands cần đợi ~1h propagation lần đầu → test ở phase này cần budget thời gian
- 2 guild thật khó setup nhanh → có thể fake guild B bằng cách insert SQL + override response Discord API tạm
