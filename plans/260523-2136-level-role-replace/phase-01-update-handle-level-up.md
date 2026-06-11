# Phase 01 — Update `handleLevelUp` Role Logic

## Overview
- Priority: HIGH
- Effort: 15 phút
- Risk: thấp (1 file, có try/catch)

## File
[bot/src/services/level-service.js](../../bot/src/services/level-service.js) — function `handleLevelUp`, block role assign hiện tại tại line 106-118.

## Current Code (sẽ thay)
```js
const rewards = db.getRewards(guild.id)

// Assign roles: type='role' OR badge có kèm role_id
const roleRewards = rewards.filter(r => r.role_id && r.level_required <= newLevel)
for (const reward of roleRewards) {
  try {
    if (!member.roles.cache.has(reward.role_id)) {
      await member.roles.add(reward.role_id)
    }
  } catch (err) {
    console.error(`[LevelService] Failed to assign role ${reward.role_id}:`, err.message)
  }
}
```

## New Code
```js
const rewards = db.getRewards(guild.id)

// Single-tier role: chỉ giữ role-reward có level_required cao nhất ≤ newLevel
const roleRewards = rewards.filter(r => r.role_id)
const managedRoleIds = new Set(roleRewards.map(r => r.role_id))

const eligible = roleRewards.filter(r => r.level_required <= newLevel)
const top = eligible.length
  ? eligible.reduce((a, b) => (b.level_required > a.level_required ? b : a))
  : null
const targetRoleId = top?.role_id || null

// ADD target role nếu thiếu
if (targetRoleId && !member.roles.cache.has(targetRoleId)) {
  try {
    await member.roles.add(targetRoleId)
  } catch (err) {
    console.error(`[LevelService] Failed to assign role ${targetRoleId}:`, err.message)
  }
}

// REMOVE các role-reward khác mà member đang giữ (auto-dọn tier cũ)
for (const rid of managedRoleIds) {
  if (rid === targetRoleId) continue
  if (member.roles.cache.has(rid)) {
    try {
      await member.roles.remove(rid)
    } catch (err) {
      console.error(`[LevelService] Failed to remove role ${rid}:`, err.message)
    }
  }
}
```

## Implementation Steps
1. Mở file [bot/src/services/level-service.js](../../bot/src/services/level-service.js)
2. Thay block từ line 106 (`const rewards = db.getRewards(guild.id)`) đến line 118 (đóng `for` loop role assign) bằng New Code ở trên
3. Phần còn lại của hàm (build embed, send message) giữ nguyên — vẫn dùng biến `rewards` và `roleRewards`. Lưu ý `roleRewards` giờ không còn filter `level_required <= newLevel` → nếu chỗ khác trong hàm dùng `roleRewards` thì cần re-check. (Hiện tại không dùng — chỉ block role-assign dùng.)
4. Compile check: `node -c bot/src/services/level-service.js`
5. Restart bot, manual test

## Todo
- [ ] Thay block role-assign
- [ ] Verify không có code khác phụ thuộc `roleRewards` filter cũ
- [ ] Compile check pass
- [ ] Manual test 3 scenarios (dưới)

## Test Scenarios (manual trên dev guild)
1. **Lên cấp lần đầu:** User lvl 9, tạo rewards [10:RoleA, 20:RoleB]. User lên 10 → có RoleA, không có RoleB. ✓
2. **Lên cấp qua nhiều tier:** User lvl 10 (đang giữ RoleA). Chat lên 20 → có RoleB, RoleA bị remove. ✓
3. **Không reward eligible:** User lvl 5 (đang giữ RoleA do legacy). Lên 6 → RoleA bị remove (vì không reward nào ≤ 6 nếu reward thấp nhất là 10). ✓

## Success Criteria
- Sau level-up: member chỉ giữ đúng 1 role thuộc set `managedRoleIds` (hoặc 0 nếu không eligible)
- Embed notification vẫn render đúng (role mention trong field "🏅 Nhận được role")
- Bot không crash khi role hierarchy fail (chỉ log)

## Risks
- Nếu reward có `role_id` trùng nhau giữa nhiều record → `managedRoleIds` Set tự dedupe. OK.
- Performance: với ~10-20 rewards/guild, 2 loop O(n) = không vấn đề
