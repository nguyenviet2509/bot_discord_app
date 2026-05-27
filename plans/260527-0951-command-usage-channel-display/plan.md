---
name: command-usage-channel-display
status: pending
created: 2026-05-27
mode: fast
slug: command-usage-channel-display
blockedBy: []
blocks: []
---

# Hiển thị tên kênh trong tab "Sử dụng Command"

## Mục tiêu
Bổ sung thông tin **kênh** (channel) mà mỗi slash command được gọi vào tab Quản lý mod → Sử dụng Command. Hiển thị tên kênh dạng `#tên-kênh` thay vì chỉ có ID.

## Bối cảnh
- Bảng `command_usage` đã có cột `channel_id` (đang được log từ `interaction-create.js`)
- Chưa lưu `channel_name` → UI không biết tên kênh, cũng chưa có cột hiển thị
- Source brainstorm: chọn approach **log snapshot channel_name lúc command chạy** + **thêm cột "Kênh" giữa User và Tham số**

## Phase
- [phase-01-implementation.md](./phase-01-implementation.md) — Migration + log + UI (1 phase duy nhất)

## Files
- `shared/db.js` — thêm cột `channel_name`, update `logCommandUsage()`
- `bot/src/events/interaction-create.js` — pass `channel_name`
- `dashboard/public/index.html` — thêm `<th>` + `<td>` Kênh, sửa `colspan`
- (`dashboard/routes/moderation.js` — không sửa, dùng `SELECT *`)

## Success criteria
- Command mới chạy → record có `channel_name` đúng tên kênh Discord
- UI bảng hiển thị cột "Kênh" với `#<channel_name>`
- Record cũ (channel_name null) hiển thị fallback "—" hoặc channel_id rút gọn
- Không có lỗi compile, dashboard không vỡ layout responsive

## Rủi ro
- Thấp. Migration idempotent (try/catch ALTER pattern đã có), không breaking change.
- Channel rename sau khi log → name snapshot không update. Chấp nhận (KISS).
