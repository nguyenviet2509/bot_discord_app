---
type: brainstorm
date: 2026-06-22
slug: dashboard-multi-guild-switcher
---

# Brainstorm: Dashboard Multi-Guild Switcher

## Problem
Bot sắp join thêm guild mới. DB schema đã có `guild_id` mọi bảng nhưng dashboard hardcode `process.env.GUILD_ID` ở 20 routes → chỉ xem được 1 guild. Cần guild switcher + per-request guild context.

## Hiện trạng
- **DB**: `guild_id` ở tất cả bảng (`users`, `rewards`, `member_events`, `activity_buckets`, ...). Multi-guild ready.
- **Bot**: phần lớn module insert đúng `guild_id` từ message/event. Còn 2 file ref `GUILD_ID` env: `bot/src/index.js`, `bot/src/deploy-commands.js` (cần verify phase 3).
- **Dashboard backend**: 20 routes dùng `const GUILD_ID = () => process.env.GUILD_ID`.
- **Dashboard FE**: không có guild selector, mọi tab hiện guild env.
- **Auth**: 1 admin chung (JWT + DASHBOARD_SECRET).
- **Endpoint sẵn có**: `GET /api/servers` → list guild bot join (có icon, member count).

## Decisions (chốt với user)

| Câu hỏi | Lựa chọn |
|---------|----------|
| Mô hình bot | 1 bot dùng chung mọi guild |
| Auth | 1 admin xem tất cả guild |
| API contract | Query param `?guildId=...` |
| Scope | Migrate **tất cả 20 routes** + UI switcher (bot scheduler để sau) |
| Default guild | Guild đầu từ `/api/servers`, nhớ vào `localStorage` |

## Approach
### Backend
- Helper `dashboard/middleware/guild-context.js` → `getGuildId(req)` = `req.query.guildId || req.headers['x-guild-id'] || process.env.GUILD_ID`. Throw nếu thiếu.
- Validate guildId ∈ bot guild list (cache 60s) → ngăn rò rỉ DB guild khác.
- Refactor 20 routes: replace `GUILD_ID()` → `getGuildId(req)`.

### Frontend
- Dropdown switcher ở sidebar (top), data từ `/api/servers`.
- `app.js`: `state.currentGuildId` từ `localStorage.guildId` → fallback guild đầu.
- Wrap `apiFetch`: auto append `?guildId=${state.currentGuildId}`.
- On switch: lưu localStorage + `window.location.reload()`.

### Compat
- `process.env.GUILD_ID` giữ làm fallback → deploy cũ không gãy.

## Pros / Cons

| | Pros | Cons |
|--|------|------|
| Query param | Đơn giản, BC tốt, debug dễ | Frontend phải append mọi call (giải bằng wrapper) |
| 1 admin auth | Nhanh, ít code | Không phù hợp SaaS (tương lai upgrade) |
| Reload on switch | Sạch state, tránh bug cache | UX hơi chậm 1 nhịp |

## Risks
- Sót route khi refactor → grep `process.env.GUILD_ID` final phải = 0 (trừ helper)
- `dashboard/public/js/*.js` (worldcup, voice-stats, ...) có fetch không qua wrapper → audit từng file
- Một số route define `GUILD_ID` ở module scope → phải move xuống handler
- Bot scheduler có thể có race khi multi-guild active → để verify sau MVP

## Success Criteria
- User chuyển guild trong dropdown → mọi tab load đúng data guild đó
- Refresh page → giữ nguyên guild đã chọn
- Backend trả 400 khi guildId không thuộc bot guild list
- Deploy không truyền `?guildId=` (BC) → vẫn dùng env

## Next
→ `/ck:plan` tạo 3 phases (backend / frontend / verify).

## Unresolved
- Sau MVP: cân nhắc audit `bot/src/index.js` scheduled tasks có hardcode GUILD_ID không?
- Tương lai: nếu cần SaaS multi-tenant → đổi sang Discord OAuth + license-per-guild.
