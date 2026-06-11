# Brainstorm — Level-up Role Replace (single-tier role)

**Date:** 2026-05-23 20:32 | **Branch:** master | **Status:** Design agreed, chờ phê duyệt plan

## 1. Problem

`handleLevelUp` (bot/src/services/level-service.js:109-118) hiện assign **cộng dồn**: mọi `reward.role_id` có `level_required <= newLevel` đều được add. User leveling cao sẽ stack nhiều role tier (Sắt, Đồng, Bạc...). Yêu cầu: giữ duy nhất role của tier hiện tại, role tier cũ tự bỏ.

## 2. Decisions (đã chốt)

| Vấn đề | Lựa chọn |
|---|---|
| Cơ chế | Toggle per-guild: `level_role_mode` ∈ {`stack`, `replace`}, default `stack` (backward-compat) |
| Phạm vi remove | Chỉ role_id nằm trong bảng `rewards` của guild đó (bot không động vào role admin gán tay) |
| Level-down | Có — tách hàm `syncLevelRoles()` dùng chung cho cả level-up & admin reset XP |
| Backfill user cũ | Lazy — chỉ dọn khi user lên cấp kế tiếp (không touch DB hàng loạt, tránh rate-limit Discord) |

## 3. Design

### 3.1 DB schema (shared/db.js)
```sql
ALTER TABLE guild_settings ADD COLUMN level_role_mode TEXT NOT NULL DEFAULT 'stack';
```
- Migration idempotent (try/catch như pattern hiện có ở [shared/db.js:289-305](shared/db.js#L289))
- `getSettings()` / `upsertSettings()` thêm field này

### 3.2 Core logic (bot/src/services/level-service.js)
Tách function mới:
```
syncLevelRoles(member, level, rewards, mode) -> Promise<void>
```
- `mode='stack'`: hành vi cũ (add roles với level_required <= level, không remove)
- `mode='replace'`:
  - `targetRoleIds` = role_id của reward có `level_required` **lớn nhất** mà ≤ level (1 role duy nhất)
  - `managedRoleIds` = tập tất cả role_id trong `rewards` của guild
  - **Add** targetRoleIds nếu chưa có
  - **Remove** mọi role thuộc `managedRoleIds \ targetRoleIds` mà user đang giữ
- Cả 2 mode: try/catch từng role op, log lỗi không throw (giữ pattern hiện tại)

### 3.3 Integration points
1. `handleLevelUp` → replace block roleRewards loop (line 109-118) bằng `await syncLevelRoles(...)`
2. **Admin reset/set XP** — cần tìm command tương ứng (xpadmin?), call `syncLevelRoles` sau khi level thay đổi. *(Cần scout bổ sung khi sang phase plan.)*

### 3.4 Dashboard
- Tab Settings (cần xác định file: `dashboard/public/index.html` hoặc settings sub-page): thêm select **"Chế độ role theo cấp"** với 2 option:
  - **Cộng dồn (stack)** — Giữ tất cả role tier đã đạt
  - **Thay thế (replace)** — Chỉ giữ role tier cao nhất, tự bỏ role tier thấp hơn
- API endpoint settings update đã có → bổ sung field `level_role_mode`

## 4. Risks & Mitigation

| Risk | Mitigation |
|---|---|
| Bot role hierarchy thấp hơn role được manage → API fail | Đã có try/catch; thêm log rõ ràng `[LevelService] Cannot remove role X (hierarchy)` |
| Race condition 2 message liên tiếp → 2 sync chồng lên | discord.js xử lý sequential per-member; `member.roles.cache` re-fetch không cần — Discord trả 429 nếu spam, hiếm |
| Reward bị xoá khỏi DB nhưng user vẫn còn role | Lazy mode chấp nhận; role "mồ côi" sẽ ở lại đến khi admin sync tay (giữ KISS) |
| Edge case: nhiều reward cùng `level_required` | Chọn role có `id` (rowid) lớn nhất — deterministic |

## 5. Out of scope (YAGNI)

- Bulk re-sync toàn guild (admin có thể trigger manual sau)
- Per-reward `replace_lower` flag
- Notification riêng khi role bị remove (chỉ embed level-up nói "nhận role mới")

## 6. Success criteria

- [ ] User lên level X (mode=replace) → giữ duy nhất role tier hiện tại; role tier cũ trong `rewards` bị bỏ
- [ ] User ở mode=stack → hành vi như cũ, không regression
- [ ] Admin đổi mode trên dashboard → save thành công, bot đọc đúng setting
- [ ] Admin reset XP → role sync theo level mới
- [ ] User cũ đang stack 5 role → khi lên cấp kế tiếp, 4 role cũ bị bỏ, chỉ giữ role mới

## 7. Unresolved questions

1. **Command admin set/reset XP tên gì?** — Cần scout phase plan để wire `syncLevelRoles` vào.
2. **Dashboard tab Settings ở file nào?** — Cần xác định để biết thêm UI vào đâu (có thể có sub-page riêng cho rewards/levels).
3. **Khi reward bị xoá khỏi DB** — có cần command admin để "force-remove" role mồ côi không? Hiện đề xuất không làm.
