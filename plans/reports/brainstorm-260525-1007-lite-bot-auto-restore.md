---
type: brainstorm
date: 260525-1007
slug: lite-bot-auto-restore
status: agreed
---

# Lite Bot Offline Sau Restart — Design

## 1. Problem
- Lite bot thi thoảng offline trong 3 ngữ cảnh: sau deploy, ngẫu nhiên giữa ngày, sau idle dài.
- Dashboard hiển thị status `Stopped` (xám) khi offline.
- Root cause: lite bot chạy in-process với dashboard. Khi dashboard process restart (Railway deploy, healthcheck fail, memory limit, idle sleep) → `gracefulShutdown` gọi `stopAll()` → set status `stopped`. Process boot lại KHÔNG có code nào auto-start lại bot. → bot ở Discord = offline cho đến khi user vào dashboard bấm Start.
- File liên quan: [dashboard/server.js:52-59](dashboard/server.js#L52-L59), [bots-lite/index.js](bots-lite/index.js), [shared/db-managed-bots.js](shared/db-managed-bots.js).

## 2. Approaches Evaluated

| # | Approach | Pros | Cons | Verdict |
|---|----------|------|------|---------|
| A | Auto-restore on boot dùng `status='running'` hiện có | KISS, 0 schema change | Status bị overload (vừa intent vừa actual state), graceful shutdown set `stopped` nên sau deploy không restore được | Reject |
| B | Tách `desired_state` (user intent) vs `status` (runtime actual) + auto-restore boot | Sạch semantic, đúng concern, bền vững | +1 column, +1 migration | **Chọn** |
| C | B + watchdog heartbeat check `client.ws.status` định kỳ | Phòng silent gateway death | discord.js v14 đã auto-reconnect, có thể YAGNI | Defer |
| D | Tách lite bots ra process riêng (như bot chính trong start.js) | Cô lập crash | Cần IPC dashboard↔manager, over-engineering quy mô hiện tại | Reject |

## 3. Recommended Solution (A+B)

### 3.1 Schema
Thêm column `desired_state` vào `managed_bots`:
- Kiểu: TEXT, default `'stopped'`, values: `'running' | 'stopped'`.
- Ý nghĩa: trạng thái user MUỐN bot ở (intent). Khác với `status` là trạng thái thực tế runtime.

### 3.2 Hành vi
- User click **Start** dashboard → set `desired_state='running'` + gọi `manager.start(id)` → manager set `status='running'`.
- User click **Stop** → set `desired_state='stopped'` + `manager.stop(id)` → `status='stopped'`.
- Graceful shutdown `stopAll()` → KHÔNG đụng `desired_state`, chỉ set `status='stopped'` (như cũ).
- **Boot dashboard** (sau `app.listen`) → query mọi bot có `desired_state='running'` → loop gọi `manager.start(id)` sequentially với delay nhỏ (300-500ms) tránh login burst. Error 1 bot không block bot khác.

### 3.3 Files cần thay đổi
- `shared/db-managed-bots.js`: migration add column + helpers `setDesiredState`, `listDesiredRunning`.
- `dashboard/routes/managed-bots.js`: route POST `/start` và `/stop` set `desired_state` trước khi gọi manager.
- `dashboard/server.js`: sau `app.listen`, gọi hàm `restoreLiteBots()` async, log từng bot start/fail.
- `bots-lite/index.js`: optional helper `restoreAll()` đọc DB + start tuần tự (gọn hơn để dashboard import).
- `dashboard/public/index.html` (managed bots tab): tùy chọn hiện tooltip "Auto-start khi server restart" cạnh badge desired.

### 3.4 Migration
- Tự chạy ở boot trong `shared/db-managed-bots.js` init: `ALTER TABLE managed_bots ADD COLUMN desired_state TEXT DEFAULT 'stopped'` (wrap try/catch nếu cột đã tồn tại — SQLite không có IF NOT EXISTS cho ADD COLUMN cũ).
- Backfill: cho bot có `status='running'` hiện tại → set `desired_state='running'` (1 UPDATE 1 lần khi migration chạy lần đầu).

## 4. Risks
- **Login burst rate-limit**: nếu có nhiều bot, login đồng loạt có thể bị Discord throttle. Mitigation: sequential + delay 500ms, hoặc concurrency=3.
- **Token sai khiến boot infinite loop**: không loop — fail 1 lần thì manager set `status='error'`, dừng cho bot đó. Lần boot sau vẫn thử lại 1 lần (desired vẫn `running`) — OK.
- **Encryption key thiếu**: `decrypt` throw, set status `error`, log rõ — đã có sẵn trong [bots-lite/index.js:45-50](bots-lite/index.js#L45-L50).
- **Race**: nếu user mở dashboard ngay khi đang restore, click Start trên bot đang restore → `manager.start` đã guard `if (clients.has(id) && isRunning) return running` — an toàn.

## 5. Success Metrics
- Sau git push deploy: trong < 30s bot lite tự online lại (xanh dashboard + Discord).
- Sau idle sleep + container wake-up: bot online lại trong < 30s sau khi dashboard boot.
- Log dashboard có dòng `[lite-restore] started bot #X` cho mỗi bot.

## 6. Out-of-Scope (defer)
- Watchdog heartbeat (Approach C) — chỉ thêm nếu thực tế vẫn quan sát thấy gateway dead silent.
- Process isolation (Approach D) — chưa cần.
- Healthcheck endpoint riêng cho lite bot — chưa cần.

## 7. Open Questions
- Có bao nhiêu lite bot tối đa user dự kiến chạy đồng thời? (ảnh hưởng concurrency restore)
- Railway plan hiện tại có idle-sleep không? Nếu có → desired_state là solution đúng. Nếu không → nên kiểm thêm memory leak.
