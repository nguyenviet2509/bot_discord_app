---
title: Tự động xóa thành viên đã rời nhóm khỏi thống kê EXP / Voice
slug: auto-remove-left-members
status: completed
created: 2026-06-18
mode: fast
blockedBy: []
blocks: []
---

# Plan: Auto-remove thành viên đã rời nhóm

## Mục tiêu

Khi thành viên rời guild, tự động xóa dữ liệu XP/level + voice stats. Dùng 2 lớp phòng thủ: event real-time + reconcile khi mở tab dashboard (catch trường hợp bot offline lúc rời).

## Context

- Brainstorm report: [reports/brainstorm-260618-0822-auto-remove-left-members.md](../reports/brainstorm-260618-0822-auto-remove-left-members.md) (sẽ tạo sau)
- Policy: **hard delete ngay** (rejoin = bắt đầu lại Lv.1 0 XP)
- Phạm vi: Members tab, Voice stats tab, Analytics tổng

## Phases

| # | Phase | Files | Status |
|---|-------|-------|--------|
| 1 | Thêm hàm `deleteVoiceStats` vào shared db | `shared/db-voice-stats.js` | done |
| 2 | Event-driven delete khi guildMemberRemove | `bot/src/events/guild-member-remove.js` | done |
| 3 | Reconcile khi mở tab Thành viên | `dashboard/routes/members.js` | done |
| 4 | Reconcile khi mở tab Voice stats | `dashboard/routes/voice-stats.js` | done |

---

## Phase 1: `deleteVoiceStats` helper

**File:** `shared/db-voice-stats.js`

Thêm hàm xóa toàn bộ voice_sessions của 1 user trong 1 guild:

```js
function deleteVoiceStats(guildId, userId) {
  return db()
    .prepare('DELETE FROM voice_sessions WHERE guild_id = ? AND user_id = ?')
    .run(guildId, userId)
}
```

Export trong `module.exports`.

---

## Phase 2: Event-driven cleanup

**File:** `bot/src/events/guild-member-remove.js`

Sau khi `logMemberEvent`, gọi thêm:
- `db.deleteUser(member.id, member.guild.id)` — xóa khỏi `users`
- `voiceStatsDb.deleteVoiceStats(member.guild.id, member.id)` — xóa voice sessions

Wrap try/catch riêng từng call để 1 lỗi không block call khác. Log fail bằng `console.error`.

---

## Phase 3: Reconcile route Members

**File:** `dashboard/routes/members.js`

Sau khi `fetchDiscordMembers` trả về list members:
1. Nếu `members` là array hợp lệ (không rỗng — guard chống Discord API fail):
   - Build `Set` các `discordUser.id`
   - Loop qua `users` (từ DB), xác định user nào KHÔNG có trong Set
   - Với mỗi user "ghost": `db.deleteUser(id, guildId)` + `voiceStatsDb.deleteVoiceStats(guildId, id)` + `db.logMemberEvent(guildId, id, 'leave')`
   - Filter `users` array trước khi `res.json`
2. Console.log số lượng cleanup nếu > 0: `[members reconcile] removed N ghost users`

**Edge case:** Nếu Discord API trả empty/error → KHÔNG xóa (giữ logic hiện tại). Phải có guard `members.length > 0` trước khi reconcile.

---

## Phase 4: Reconcile route Voice stats

**File:** `dashboard/routes/voice-stats.js`

Vị trí: trước khi build leaderboard response, fetch Discord API members 1 lần (reuse helper từ members.js — extract sang `shared/discord-api.js` nếu DRY cần thiết, hoặc duplicate cho KISS vì chỉ 2 chỗ).

Logic tương tự Phase 3:
- Lấy danh sách user_id có trong voice_sessions (DISTINCT)
- Cross-check với Discord member set
- User ghost → delete voice stats + users + log event
- Console.log nếu > 0

**Quyết định KISS:** Duplicate `fetchDiscordMembers` ở voice-stats.js (5 dòng code, không đáng extract module). Nếu sau này dùng 3+ chỗ thì refactor.

---

## Success criteria

- [ ] Member rời server lúc bot online → biến mất khỏi tab Thành viên ngay lần refresh tiếp theo
- [ ] Member rời lúc bot offline → biến mất khỏi tab Thành viên ngay khi user mở tab (reconcile)
- [ ] Voice stats không hiển thị user đã rời
- [ ] Analytics header (tổng thành viên, tổng XP, level cao nhất) tự động đúng (client compute từ filtered list)
- [ ] Không xóa nhầm khi Discord API fail (kiểm tra bằng cách mock fail)

## Risks

- Discord API rate limit nếu mở 2 tab liên tục → mỗi tab fetch 1 lần, hiện chưa cache. Chấp nhận, optimize sau nếu thành issue.
- Race: user rời đúng lúc reconcile chạy → cleanup ở request kế tiếp.

## Unresolved

None.
