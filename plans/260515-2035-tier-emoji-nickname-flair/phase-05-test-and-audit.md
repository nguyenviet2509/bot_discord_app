# Phase 5 — Manual Test + Permission Audit

**Priority:** Medium
**Status:** pending
**Effort:** ~20 min
**Depends on:** Phase 1, 2, 3, 4

## Overview
Test thủ công các flow, thêm permission warning khi bot start nếu thiếu `MANAGE_NICKNAMES`.

## Related Files
- **Modify:** `bot/src/index.js` (hoặc nơi `ready` event) — log warning nếu bot thiếu permission.

## Implementation Steps

### 4.1 Permission audit on ready
Trong `clientReady`/`ready` event handler, sau khi bot online, loop qua các guild và check:
```js
client.guilds.cache.forEach(guild => {
  const me = guild.members.me
  if (me && !me.permissions.has('ManageNicknames')) {
    console.warn(`[Flair] Guild ${guild.name} (${guild.id}): bot thiếu MANAGE_NICKNAMES — flair feature sẽ không hoạt động.`)
  }
})
```

### 4.2 Manual test matrix
| Case | Setup | Expected |
|---|---|---|
| Lên tier mới | User lv 9, chat đủ XP lên lv 10 | Nick = `Tên ⚫` |
| Lên tier kế tiếp | User lv 19, lên lv 20 | Nick = `Tên 🟤` (strip `⚫`) |
| Cùng tier | User lv 11 → lv 12 | Nick không đổi |
| Owner | Server owner lên tier | Console log warn, no crash |
| Role cao hơn bot | User có role > bot | Console log warn, no crash |
| Nick dài | User có nick 31 ký tự + emoji | Truncate base, fit 32 |
| Opt-out đang có flair | `/flair off` | Emoji bị strip ngay |
| Opt-in chưa đủ lv | Lv 5 dùng `/flair on` | Reply "cần đạt lv 10" |
| Opt-in đủ lv | Lv 30 dùng `/flair on` (sau khi off) | Nick có emoji `🟤` |
| Admin custom badge | `/flair-config set tier:Sắt emoji:🦄` | DB lưu, view hiển thị `🦄 Sắt (custom)` |
| Member lên tier sau custom | Lv 9 → 10 sau khi admin custom Sắt = 🦄 | Nick = `Tên 🦄` |
| Admin reset all | `/flair-config reset` | Tất cả tier về badge mặc định |
| Reject invalid emoji | `/flair-config set tier:Sắt emoji:abc` | Reply lỗi, không lưu |
| Reject custom emoji Discord | `/flair-config set tier:Sắt emoji:<:rare:123>` | Reply lỗi |
| Non-admin dùng `/flair-config` | User thường mở menu | Command bị ẩn / Discord block |

### 4.3 Lưu ý dev
- Dùng admin command sẵn có (nếu có) để gán XP cho test user nhanh.
- Test trên guild dev trước khi merge.

## Todo
- [ ] Thêm permission audit trong `bot/src/index.js` ready handler
- [ ] Chạy bot, verify warning log nếu thiếu permission
- [ ] Chạy đủ test matrix
- [ ] Commit + push (conventional commit: `feat(bot): tier emoji nickname flair`)

## Success Criteria
- Tất cả case trong matrix pass.
- Bot không crash khi gặp owner / role hierarchy.
- Audit log không bị spam.

## Risks
- Test cần ≥ 2 user trên guild dev (1 owner, 1 normal). Nếu không có → mock bằng cách tạm gán role cao hơn bot cho test account.
