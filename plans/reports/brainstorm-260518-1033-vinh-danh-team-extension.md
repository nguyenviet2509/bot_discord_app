# Brainstorm — Mở rộng Vinh Danh: Team mode

**Date:** 2026-05-18
**Status:** Design FINAL ✅ — Ready for `/ck:plan`
**Parent:** [brainstorm-260518-0928-vinh-danh-top3.md](brainstorm-260518-0928-vinh-danh-top3.md) + plan [260518-1016-vinh-danh-top3-member](../260518-1016-vinh-danh-top3-member/plan.md)

## Problem statement
Đã có `/vinhdanh` (Top 3 cá nhân, Champion Spotlight). Cần thêm option vinh danh team (1-10 member) với layout khác. Giữ tương thích code hiện có, không refactor đè.

## Design FINAL

### Command structure (breaking change)
- `/vinhdanh ca-nhan ...` (rename từ `/vinhdanh` hiện tại) — Top 3 Champion Spotlight
- `/vinhdanh team ...` (mới) — Team Roster
- Subcommand thay vì 2 command riêng → gọn command list

### Team subcommand
```
/vinhdanh team
  user1   (required)
  user2..user10 (optional)
  banner  (required, image)
  channel (optional)
→ Modal popup:
  • Tiêu đề (default "BẢNG VÀNG TEAM THÁNG X/YYYY")
  • Tên team (vd "Biệt đội Bug Hunter")
  • Lý do vinh danh team (1 mô tả chung, max 500 chars)
```

### Embed layout Team Roster
```json
{
  "content": "🎉 Vinh danh team **{teamName}** — <@u1> ... <@uN> 🎉",
  "embeds": [{
    "author": { "name": "🏛️ {title}" },
    "title": "🎖️ {teamName}",
    "description": "> *\"{reason}\"*",
    "color": 16766720,
    "fields": [
      { "name": "👥 Thành viên (cột 1)", "value": "✨ <@u1>\n✨ <@u2>...", "inline": true },
      { "name": "👥 Thành viên (cột 2)", "value": "✨ <@uN/2+1>...", "inline": true }
    ],
    "image": { "url": "<banner>" },
    "footer": { "text": "✦ {N} thành viên · Vinh danh bởi {guildName} ✦" }
  }]
}
```

- N <= 5: chỉ 1 cột (không tách)
- N 6-10: 2 cột, chia đôi (cột 1 chứa ceil(N/2))
- Auto-react 🎉 👏 giữ nguyên

### DB schema mới
Bảng `honor_team_history`:
```sql
CREATE TABLE IF NOT EXISTS honor_team_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT,
  title TEXT NOT NULL,
  team_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  banner_url TEXT,
  member_ids TEXT NOT NULL,  -- JSON array of user IDs
  created_by TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_honor_team_guild ON honor_team_history(guild_id, created_at DESC);
```

Bảng `honor_history` (Top 3) giữ nguyên — KISS, không thay đổi.

### Dashboard updates
- Trang `honor-config.html` thêm tab/section "Lịch sử Team" (riêng với "Lịch sử Cá nhân")
- Preview block hỗ trợ 2 mode: cá nhân và team (dropdown chọn type)
- Reuse role/channel settings chung cho cả 2 type

### `/vinhdanh-history` updates
- Liệt kê cả 2 type, sắp theo `created_at DESC`
- Mỗi entry có icon phân biệt: 👤 cá nhân, 👥 team
- Optional: thêm filter option `type:[ca-nhan|team]`

## Files dự kiến

**Tạo mới:**
- `shared/build-honor-team-embed.js` — builder cho team layout
- (logic team subcommand thêm vào `bot/src/commands/vinh-danh.js`)

**Modify:**
- `shared/db-honor.js` — thêm CRUD cho `honor_team_history`
- `shared/db.js` — thêm CREATE TABLE
- `bot/src/commands/vinh-danh.js` — restructure thành subcommand (`ca-nhan` + `team`)
- `bot/src/commands/vinh-danh-history.js` — UNION cả 2 bảng, hiển thị icon phân biệt
- `bot/src/services/honor-service.js` — thêm `publishHonorTeam`
- `dashboard/routes/honor.js` — thêm endpoint `/api/honor/team-history` + preview mode team
- `dashboard/public/honor-config.html` + js — thêm tab team

## Implementation notes
- Modal max 5 inputs: title + team_name + reason = 3 input → OK (còn dư 2)
- Slash subcommand: `data.addSubcommand(sub => sub.setName('team')...)` — discord.js v14 hỗ trợ
- Modal customId convention: `honor:modal:top3:<nonce>` và `honor:modal:team:<nonce>` để route đúng
- Pending cache trong honor-service: thêm key suffix `:team` để không xung đột

## Rủi ro
- **Breaking change `/vinhdanh` → `/vinhdanh ca-nhan`**: cần thông báo admin trước khi deploy
- **10 user options dài**: nếu user lười nhập, có thể nhập 1-2 user → cần validate ≥ 3 member (3 là ngưỡng "team")
- **Modal text quá ngắn cho lý do team**: 500 chars có thể không đủ nếu team dài; nhưng tăng lên = embed bị crowded

## Success criteria
- `/vinhdanh ca-nhan` vẫn hoạt động y như cũ
- `/vinhdanh team user1:@a banner:[img]` → modal hiện → submit → embed Team Roster với 1 thành viên
- `/vinhdanh team user1..user10 ...` → embed 2 cột 5+5
- `/vinhdanh-history` liệt kê cả 2 type, icon phân biệt
- Dashboard tab "Lịch sử Team" hoạt động độc lập

## Next steps
Chạy `/ck:plan` để sinh implementation plan đầy đủ.

## Unresolved questions
- Ngưỡng tối thiểu thành viên team: 3? 5? (tạm chốt: ≥ 3)
- Có cần thêm avatar grid (thumbnail/image render) hay chỉ mention text? (tạm chốt: text mention, KISS)
