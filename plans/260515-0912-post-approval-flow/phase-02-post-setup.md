# Phase 02 — `/post-setup` Admin Command

**Priority:** High
**Status:** pending
**Depends on:** Phase 01

## Overview
Slash command admin dùng để cấu hình: channel #review (text), forum #public, admin role được duyệt bài.

## Related Files
- **New:** `bot/src/commands/post-setup.js`

## Command Spec
3 subcommands:
- `/post-setup channels entry:<text-ch> review:<text-ch> public:<forum>` — set 3 channels
- `/post-setup admin-role role:<role> action:<add|remove>` — manage admin roles
- `/post-setup show` — hiển thị config hiện tại

**3 channels:**
| Tên | Loại | Mục đích |
|---|---|---|
| `entry` | Text | Nơi member chạy `/post` (vd: `#đăng-bài-mua-bán`) |
| `review` | Text | Queue chờ duyệt, chỉ admin xem |
| `public` | Forum | Bài đã duyệt hiển thị thành thread |

## Implementation Steps
1. Build SlashCommandBuilder với 3 subcommands
2. Permission: chỉ user có `ManageGuild` mới chạy được (`setDefaultMemberPermissions`)
3. Validate `entry` & `review` type === `GuildText` (0), `public` type === `GuildForum` (15)
4. Validate bot có permission: `SendMessages` trong entry & review, `CreatePublicThreads` + `ManageThreads` + `SendMessagesInThreads` trong forum
5. Lưu via `updatePostSettings()`
6. Reply ephemeral confirmation embed

## Todo
- [ ] Khung command với 3 subcommands
- [ ] Validate channel types
- [ ] Validate bot permissions trên 2 channel
- [ ] Implement `channels` subcommand
- [ ] Implement `admin-role` add/remove (parse JSON array từ DB)
- [ ] Implement `show` subcommand
- [ ] Test với channel sai type → reply lỗi rõ ràng

## Success Criteria
- Admin set xong, `getSettings(guildId)` trả về đủ 3 field mới
- Bot permission insufficient → reply ephemeral cảnh báo cụ thể
- Non-admin chạy lệnh → bị Discord block trước khi tới bot (defaultMemberPermissions)

## Risks
- Forum channel có thể bật "require tag" → cảnh báo admin nếu detect `availableTags.length > 0 && defaultReactionEmoji === null` (best-effort)
