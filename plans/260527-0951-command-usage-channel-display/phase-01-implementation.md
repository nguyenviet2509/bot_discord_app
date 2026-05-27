# Phase 01 — Implementation

**Status:** pending
**Priority:** medium
**Effort:** ~30 LOC across 3 files

## Context Links
- Brainstorm context: tab "Sử dụng Command" tại [dashboard/public/index.html:1289](../../dashboard/public/index.html#L1289)
- Bot log site: [bot/src/events/interaction-create.js:71](../../bot/src/events/interaction-create.js#L71)
- DB module: [shared/db.js:165](../../shared/db.js#L165) (table `command_usage`), [shared/db.js:795](../../shared/db.js#L795) (`logCommandUsage`)

## Overview
Thêm `channel_name` vào pipeline log + render cột "Kênh" trên UI. Backend route không cần sửa (đã `SELECT *`).

## Requirements
- DB: cột `channel_name TEXT` nullable trên `command_usage`
- Migration idempotent (chạy nhiều lần không lỗi) — dùng pattern `try { ALTER } catch (_) {}` đã có sẵn
- Bot log: snapshot `interaction.channel?.name` lúc command chạy
- UI: cột mới "Kênh" giữa User và Tham số, hiển thị `#<name>`, fallback `—` nếu null

## Related Code Files

### Modify
1. **`shared/db.js`**
   - Block `CREATE TABLE IF NOT EXISTS command_usage` (~line 165): thêm `channel_name TEXT` ngay sau `channel_id TEXT`
   - Block migration ALTER (~line 296-307 area, sau các ALTER khác): thêm `try { database.exec('ALTER TABLE command_usage ADD COLUMN channel_name TEXT') } catch (_) {}`
   - Function `logCommandUsage(data)` (~line 795): thêm `@channel_name` vào INSERT VALUES + default `channel_name: null` trong spread

2. **`bot/src/events/interaction-create.js`** (line 71-81)
   - Thêm field `channel_name: interaction.channel?.name || null` vào object truyền `logCommandUsage`

3. **`dashboard/public/index.html`** (line 1289-1330)
   - Thêm `<th class="text-left px-6 py-4 text-xs font-bold text-slate-400 uppercase">Kênh</th>` sau cột User (giữa User và Tham số)
   - Thêm `<td>` tương ứng trong `<template x-for>`:
     ```html
     <td class="px-6 py-3 text-xs">
       <span x-show="row.channel_name" class="font-mono text-slate-600" x-text="'#' + row.channel_name"></span>
       <span x-show="!row.channel_name" class="text-slate-300">—</span>
     </td>
     ```
   - Đổi `colspan="5"` → `colspan="6"` ở dòng "Không có dữ liệu" (line 1326)

### Không sửa
- `dashboard/routes/moderation.js` — endpoint `/command-usage` dùng `getCommandUsage` → `SELECT *` đã tự động trả `channel_name`

## Implementation Steps
1. **DB schema** — sửa `shared/db.js`:
   - Update CREATE TABLE statement
   - Thêm ALTER migration vào block migrations
   - Update `logCommandUsage()` (INSERT cols + default)
2. **Bot log** — sửa `interaction-create.js`: thêm `channel_name` field
3. **UI** — sửa `index.html`: thêm `<th>` + `<td>` + đổi colspan
4. **Verify**: Restart dashboard + bot, chạy 1 slash command bất kỳ → check record mới có `channel_name`, UI hiển thị đúng

## Todo
- [ ] Thêm cột `channel_name` vào CREATE TABLE `command_usage` trong `shared/db.js`
- [ ] Thêm ALTER migration idempotent cho DB cũ
- [ ] Update `logCommandUsage()` để accept + INSERT `channel_name`
- [ ] Update `interaction-create.js` truyền `interaction.channel?.name`
- [ ] Thêm `<th>Kênh</th>` + `<td>` render vào table HTML
- [ ] Sửa `colspan="5"` → `colspan="6"`
- [ ] Test: command mới → channel_name có giá trị; record cũ → hiển thị "—"

## Success Criteria
- `sqlite3 ... "PRAGMA table_info(command_usage)"` có cột `channel_name`
- Chạy slash command bất kỳ trong server → row mới trong `command_usage` có `channel_name = <tên kênh>`
- Tab Sử dụng Command → cột "Kênh" hiển thị `#tên-kênh` đúng
- Record cũ (trước migration) hiển thị "—"
- Không có lỗi console JS, layout bảng không vỡ ở mobile

## Risk Assessment
- **Migration fail** → idempotent try/catch, không block startup
- **`interaction.channel` null** (rare) → `?.name` an toàn, fallback null
- **Layout 6 cột mobile** → bảng đã có `overflow-x-auto`, không ảnh hưởng

## Security
- Channel name có thể chứa unicode/emoji → x-text của Alpine.js tự escape, không có XSS

## Next Steps
- Sau khi merge: theo dõi xem có cần filter theo kênh (đã defer trong brainstorm)
