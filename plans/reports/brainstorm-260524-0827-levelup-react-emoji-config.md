---
type: brainstorm
date: 2026-05-24
slug: levelup-react-emoji-config
---

# Brainstorm — Level-up Auto-React Emoji Config

## Vấn đề
Hiện tại bot tự react tin nhắn khi user level-up (~8% chance) bằng **tier badge** của user (`level-service.js:25-34`). Tier Sắt (level 10-19) có badge `⚫` (chấm đen) → admin muốn đổi.

Phạm vi mở rộng: admin muốn quyền tự chọn emoji cho mọi tier, cộng chỉnh % tần suất, hỗ trợ cả Unicode + custom emoji.

## Yêu cầu chốt (qua AskUserQuestion)
- **Scope**: admin config qua dashboard, per-tier (10 emoji), không động vào badge nickname (giữ riêng concern).
- **Emoji type**: cả Unicode + custom emoji server (`<:name:id>` / `<a:name:id>`).
- **Frequency**: slider 0-100% (per-guild, 1 giá trị global).

## Giải pháp đã chốt

### Data model
Tận dụng bảng `guild_tier_badges` (đã có per-guild × per-tier):
- Thêm `react_emoji TEXT NULL` — NULL = tắt react cho tier đó.

Bảng `guild_settings`:
- Thêm `levelup_react_chance_pct INTEGER DEFAULT 8` (clamp 0-100 ở app layer).

### Backend
- `level-service.js`: hàm `getLevelupReactConfig(guildId, level)` → `{ emoji|null, chancePct }`.
- `message-create.js:112-121`: thay logic hard-code bằng config động. Nếu `emoji=null` hoặc `chance=0` → skip.
- Format emoji: discord.js `message.react()` accept cả Unicode lẫn `<:n:id>` → 1 field text raw.

### Dashboard
- Section mới trong tab "Tin nhắn Level Up" (gọn, không phình sidebar).
- UI: 1 slider chance (0-100%, warning khi >30%) + 10 input row per-tier (placeholder = badge mặc định).
- Route `dashboard/routes/level-react.js` GET/PUT.
- Tuân `dashboard-layout` skill (card / input-field / btn-primary).

### Edge cases
- Custom emoji guild khác → `message.react()` throw → try/catch sẵn, ignore.
- Clear field → NULL → tier không react.
- Chance=0 → tắt toàn bộ (không cần toggle riêng).
- Migration default emoji react = badge hiện tại → backward compat.

### Risks
- Spam react nếu chance cao → soft warning UI >30%.
- Custom emoji ID không thuộc guild bot ở → silent fail (acceptable).

## Files touch
- `shared/db.js` — migration 2 cột.
- `bot/src/services/level-service.js` — getter mới.
- `bot/src/events/message-create.js` (line 112-121) — dùng config.
- `dashboard/routes/level-react.js` (new) + register vào dashboard server.
- `dashboard/public/index.html` (tab "Tin nhắn Level Up") + JS handler.

## Open questions
- Có cần preview emoji live (render khi paste) — quyết định: **không, YAGNI**, browser tự render emoji Unicode; custom emoji chỉ show string raw là đủ cho admin biết đã nhập đúng format.
