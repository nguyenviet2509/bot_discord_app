# Phase 4 — History UNION (Cá nhân + Team)

**Priority:** P1
**Effort:** S (~30 min)
**Depends on:** Phase 1

## Approach
Thay vì query 2 bảng riêng, expose hàm `listHonorAllHistory(guildId, limit)` trong `shared/db-honor.js` dùng SQL UNION + sort by created_at DESC.

## SQL UNION
```sql
SELECT 'top3' AS type, id, guild_id, channel_id, message_id, title,
       NULL AS team_name, user1_id, user2_id, user3_id, NULL AS member_ids,
       created_by, created_at
FROM honor_history WHERE guild_id = ?
UNION ALL
SELECT 'team' AS type, id, guild_id, channel_id, message_id, title,
       team_name, NULL, NULL, NULL, member_ids,
       created_by, created_at
FROM honor_team_history WHERE guild_id = ?
ORDER BY created_at DESC
LIMIT ?
```

## Update `/vinhdanh-history` command
- Gọi `listHonorAllHistory(guildId, limit)`
- Loop render mỗi entry theo type:
  - type 'top3': icon 👤 + `🥇 @u1 🥈 @u2 🥉 @u3`
  - type 'team': icon 👥 + `🎖️ {team_name} · {N} thành viên`
- Link tới message giữ nguyên (cùng schema channel_id + message_id)

## Files modify
- `shared/db-honor.js` — thêm `listHonorAllHistory`
- `bot/src/commands/vinh-danh-history.js` — đổi sang dùng `listHonorAllHistory`, render phân biệt

## Todo
- [ ] SQL UNION hàm mới
- [ ] Render mỗi type khác icon/format
- [ ] Test với cả 0/1/nhiều của mỗi type

## Success criteria
- `/vinhdanh-history` liệt kê cả 2 type theo thứ tự thời gian
- Icon 👤 / 👥 phân biệt
- Link "Xem" mở đúng message gốc
