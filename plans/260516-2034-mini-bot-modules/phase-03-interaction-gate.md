# Phase 03 — Gate trong interaction-create

## Overview
- Priority: must
- Status: ⏳ pending
- Estimate: XS (~15 phút)
- Depends: Phase 01, 02

Chặn command thuộc module nếu guild chưa bật module đó.

## Files
- `bot/src/events/interaction-create.js` (modify)

## Logic

Trước khi gọi `command.execute(interaction)`, thêm:

```js
const moduleKey = command._module
if (moduleKey) {
  const manifest = client._modules?.get(moduleKey)
  // Resolve enabled: explicit DB > manifest.defaultEnabled
  const dbState = isModuleEnabled(interaction.guildId, moduleKey) // returns null nếu không có row
  const enabled = dbState === null ? !!manifest?.defaultEnabled : dbState
  if (!enabled) {
    return interaction.reply({
      content: `⚠️ Module **${manifest?.name || moduleKey}** chưa được bật cho server này. Vào dashboard để bật.`,
      ephemeral: true,
    })
  }
}
```

`isModuleEnabled` ở Phase 01 cần trả về `null` (chưa có row) vs `boolean` (đã có row), không chỉ boolean. → Update Phase 01 helper cho đúng.

## Steps
1. Đọc `bot/src/events/interaction-create.js` để biết vị trí gọi execute
2. Thêm import `isModuleEnabled` từ `shared/db.js`
3. Insert block gate trước `await command.execute(interaction)`
4. Verify core command vẫn chạy (không có `_module` → bypass)

## Todo
- [ ] Update helper `isModuleEnabled` trả `null | boolean` (sửa Phase 01 nếu đã làm trước)
- [ ] Modify `bot/src/events/interaction-create.js` thêm gate
- [ ] Manual test: tạo module dummy, không enable → command bị chặn
- [ ] Manual test: core command (`/rank`) vẫn chạy bình thường

## Risks
- Forget update `isModuleEnabled` return shape → core command vẫn chạy nhưng module mặc-định-on luôn bị tắt. → Test cả 2 trường hợp.

## Success criteria
- Core command (`/rank`, `/leaderboard`...) không bị ảnh hưởng
- Module command khi `enabled=false` → reply ephemeral, không execute
- Module với `defaultEnabled=true` và chưa có DB row → vẫn execute
