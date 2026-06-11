# Brainstorm v2 — Level-up Role Replace (Simplified)

**Date:** 2026-05-23 21:36 | **Branch:** master | **Supersedes:** [brainstorm-260523-2032-level-role-replace.md](brainstorm-260523-2032-level-role-replace.md)

## Decision Update
User chốt đơn giản hóa hoàn toàn:
- **Không cần toggle** stack vs replace → luôn replace (hard-code)
- **Không cần backfill** user cũ → admin tự dọn role tay
- **Không cần sync** trong `/set-level` → admin tự xử lý

## Problem
`handleLevelUp` ([bot/src/services/level-service.js:109-118](../../bot/src/services/level-service.js#L109)) hiện stack tất cả role-reward. Cần: chỉ giữ 1 role-reward có `level_required` cao nhất ≤ newLevel; remove các role-reward khác mà member đang giữ.

## Final Design

### Logic mới trong `handleLevelUp`
Thay block role-assign (line 109-118):
```js
const rewards = db.getRewards(guild.id)
const roleRewards = rewards.filter(r => r.role_id)
const managedRoleIds = new Set(roleRewards.map(r => r.role_id))

// Pick role-reward có level_required cao nhất ≤ newLevel
const eligible = roleRewards.filter(r => r.level_required <= newLevel)
const top = eligible.length
  ? eligible.reduce((a, b) => (b.level_required > a.level_required ? b : a))
  : null
const targetRoleId = top?.role_id || null

// ADD target nếu thiếu
if (targetRoleId && !member.roles.cache.has(targetRoleId)) {
  try { await member.roles.add(targetRoleId) }
  catch (err) { console.error(`[LevelService] add role ${targetRoleId} failed:`, err.message) }
}

// REMOVE các role-reward khác mà member đang giữ
for (const rid of managedRoleIds) {
  if (rid === targetRoleId) continue
  if (member.roles.cache.has(rid)) {
    try { await member.roles.remove(rid) }
    catch (err) { console.error(`[LevelService] remove role ${rid} failed:`, err.message) }
  }
}
```

Phần build embed & gửi message giữ nguyên — vẫn dùng `rewards` đã fetch.

## Scope
- **1 file thay đổi:** [bot/src/services/level-service.js](../../bot/src/services/level-service.js)
- **0 DB migration**
- **0 dashboard UI change**
- **0 command change**

## Behavior Notes
- Bao gồm cả role kèm badge (badge có `role_id`) — vẫn nằm trong `roleRewards`
- User cũ stack nhiều role: KHÔNG auto-dọn ngay. Khi user chat lên cấp mới → bot tự dọn (vì logic mới chạy mọi lần level-up).
  - **Lưu ý:** Đây là side-effect tự nhiên, không phải feature. Admin có thể chủ động dọn tay nếu muốn.
- Edge case `newLevel=0` và có reward level=0: vẫn chọn role đó

## Risks
| Risk | Mitigation |
|---|---|
| Bot role hierarchy thấp | try/catch, log lỗi, không crash |
| Multiple reward cùng `level_required` | `reduce` chọn cái cuối (deterministic theo thứ tự DB) |
| Reward role bị xoá khỏi DB nhưng user còn giữ | Không trong scope — role mồ côi do admin xử lý |

## Success Criteria
- [ ] User chat lên level X → chỉ giữ 1 role-reward có level_required cao nhất ≤ X
- [ ] User đang stack nhiều role-reward → lên cấp kế → các role thấp bị remove
- [ ] Không reward eligible (level rất thấp) → remove hết role-reward đang giữ
- [ ] Embed level-up vẫn hiển thị đúng "Nhận role X"

## Out of Scope
- Toggle stack mode
- Dashboard UI
- DB schema change
- `/set-level` integration
- Backfill batch tool

## Unresolved
Không còn.
