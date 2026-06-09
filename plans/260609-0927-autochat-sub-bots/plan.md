---
name: Auto-chat cho sub bot (random interval)
slug: autochat-sub-bots
created: 2026-06-09
status: pending
mode: auto
blockedBy: []
blocks: []
---

# Auto-chat sub bot

Mỗi sub bot có 1 list câu chat custom + 1 channel ID + interval min/max phút. Bot tự gửi random câu sau mỗi khoảng random delay khi enabled.

## Phase

| # | File | Status |
|---|------|--------|
| 1 | [phase-01-db-schema.md](phase-01-db-schema.md) | pending |
| 2 | [phase-02-auto-chatter.md](phase-02-auto-chatter.md) | pending |
| 3 | [phase-03-api-ui.md](phase-03-api-ui.md) | pending |
| 4 | [phase-04-human-like.md](phase-04-human-like.md) | pending |

## Tóm tắt

- DB: thêm cột autochat vào `managed_bots` + bảng `managed_bot_messages`
- Scheduler `bots-lite/auto-chatter.js`: per-bot setTimeout, random pick câu + random delay
- Tích hợp lifecycle với `bots-lite/index.js` (start/stop/restore)
- API: GET/PUT config, POST/DELETE messages, POST test-send
- UI: section mới trong managed bot tab
- Human-like: typing indicator theo length, không trùng câu liên tiếp, skip khi channel im lặng quá lâu

## Dependencies

- discord.js v14 (đã có)
- better-sqlite3 (đã có, qua shared/db.js)

## Decisions

- setTimeout per bot (11 timer OK, không cần cron lib)
- Plain text only, không embed (YAGNI)
- Không log lịch sử gửi (YAGNI)
- Test-send button có, để debug nhanh
- min phút tối thiểu = 1 (chống spam)
