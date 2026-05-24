---
name: Level-up Auto-React Emoji Config
slug: levelup-react-emoji-config
created: 2026-05-24
status: completed
mode: fast
blockedBy: []
blocks: []
---

# Level-up Auto-React Emoji Config — Plan

## Context
- Brainstorm: [plans/reports/brainstorm-260524-0827-levelup-react-emoji-config.md](../reports/brainstorm-260524-0827-levelup-react-emoji-config.md)
- Trigger: admin muốn đổi emoji `⚫` (tier Sắt) — mở rộng thành config full per-tier + chance %.
- Coordination notes:
  - Plan `260523-2136-level-role-replace` cùng chạm `level-service.js` — chỉ thêm hàm mới, không xung đột.
  - Plan `260523-2215-dashboard-mobile-responsive` chạm CSS dashboard — đảm bảo UI mới dùng class chuẩn `dashboard-layout` skill.

## Goal
Admin config qua dashboard:
- Emoji react riêng cho 10 tier (Sắt → Thách Đấu), hỗ trợ Unicode + custom emoji Discord.
- Slider chance 0-100% (per-guild).
- Tier để trống → tắt react tier đó. Chance=0 → tắt toàn bộ.

## Files
**Modify:**
- `shared/db.js` — migration cột `react_emoji` (guild_tier_badges) + `levelup_react_chance_pct` (guild_settings).
- `bot/src/services/level-service.js` — thêm `getLevelupReactConfig(guildId, level)`.
- `bot/src/events/message-create.js` (line 112-121) — dùng config động thay hard-code.
- `dashboard/server.js` (hoặc router index) — register route mới.
- `dashboard/public/index.html` — thêm section UI trong tab "Tin nhắn Level Up".
- `dashboard/public/js/levelup-template.js` (hoặc file tab tương ứng) — handler load/save.

**Create:**
- `dashboard/routes/level-react.js` — GET/PUT API.

## Phases
| # | Phase | Status |
|---|-------|--------|
| 01 | DB migration + service getter | completed |
| 02 | Bot event integration | completed |
| 03 | Dashboard API route | completed |
| 04 | Dashboard UI (slider + 10 inputs) | completed |
| 05 | Manual test + verify | completed |

## Dependencies
01 → 02 (event dùng service)
01 → 03 (API CRUD cột mới)
03 → 04 (UI gọi API)
04 → 05

## Success Criteria
- Đổi emoji tier Sắt qua dashboard → bot react đúng emoji mới khi user level-up.
- Slider 0% → bot không react.
- Custom emoji `<:name:id>` từ server → bot react được.
- Guild chưa config → default = badge tier hiện tại (backward compat).

## Detail
- [phase-01-db-and-service.md](phase-01-db-and-service.md)
- [phase-02-event-integration.md](phase-02-event-integration.md)
- [phase-03-dashboard-api.md](phase-03-dashboard-api.md)
- [phase-04-dashboard-ui.md](phase-04-dashboard-ui.md)
- [phase-05-manual-test.md](phase-05-manual-test.md)
