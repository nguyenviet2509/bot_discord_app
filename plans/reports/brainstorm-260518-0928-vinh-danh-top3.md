# Brainstorm — Tính năng Vinh Danh Top 3 Member

**Date:** 2026-05-18
**Status:** Design FINAL ✅ — Ready for `/ck:plan`

## Problem statement
Discord bot cần command để admin gửi thông báo vinh danh Top 3 member đóng góp xuất sắc, mang sắc thái trang trọng. Bắt buộc 3 thông tin: tên member, lý do, ảnh banner.

## Final design (user đã chốt)

### Trigger
- Slash command thủ công: `/vinhdanh`
- Permission: theo role được config trong dashboard `Settings → Vinh Danh`

### Input flow
- Slash command với options:
  - `user1`, `user2`, `user3` (type: USER, required)
  - `banner` (type: ATTACHMENT, required)
  - `channel` (type: CHANNEL, optional — default channel hiện tại)
- Sau khi gõ command → Modal popup nhập:
  - Tiêu đề (custom, default = "BẢNG VÀNG THÁNG X/YYYY")
  - Lý do #1, lý do #2, lý do #3

### Output — Embed template (Mock 4 — Champion Spotlight)

```json
{
  "content": "🎉 Chúc mừng <@user1> <@user2> <@user3> 🎉",
  "embeds": [
    {
      "author": {
        "name": "🏛️ BẢNG VÀNG THÁNG 5/2026",
        "icon_url": "<guild icon>"
      },
      "title": "🥇 QUÁN QUÂN THÁNG 5 — {ChampionName}",
      "description": "> *\"{lý do quán quân}\"*",
      "color": 16766720,
      "thumbnail": { "url": "<avatar champion>" },
      "fields": [
        {
          "name": "🥈 Á QUÂN",
          "value": "**{RunnerUpName}**\n{lý do á quân}",
          "inline": true
        },
        {
          "name": "🥉 HẠNG BA",
          "value": "**{ThirdPlaceName}**\n{lý do hạng ba}",
          "inline": true
        }
      ],
      "image": { "url": "<banner admin upload>" },
      "footer": { "text": "✦ Vinh danh bởi {guild name} ✦" },
      "timestamp": "<ISO timestamp>"
    }
  ]
}
```

**Đặc trưng layout:**
- Author = tiêu đề tháng (compact, trên cùng)
- Title = highlight #1 (Quán quân)
- Description = quote lý do #1 (in nghiêng, có icon `>`)
- Thumbnail = avatar #1 (góc phải trên)
- Fields inline = #2 và #3 (2 cột ngang)
- Image = banner admin upload (cuối, full-width)
- Content message = ping 3 user + emoji 🎉

### Extras (đã chốt)
- ✅ Custom title mỗi lần (qua modal)
- ✅ Mention 3 user (qua content message)
- ✅ Bot auto-react `🎉` `👏` vào message embed
- ✅ Lưu lịch sử vào DB (bảng `honor_history`)
- ✅ Preview trong dashboard trước khi publish
- ✅ Lệnh phụ `/vinhdanh-history` (làm chung plan này)

### Dashboard config
- Trang mới: `Settings → Vinh Danh`
  - Chọn role được phép dùng command (multi-select)
  - Chọn channel default (optional)
- Trang preview: paste JSON / chọn từ form → render preview giống Discord (tận dụng pattern `levelup-preview.html` đã có)

### Persistence — DB schema
Bảng `honor_history`:
```
id INTEGER PK AUTOINCREMENT
guild_id TEXT
channel_id TEXT
message_id TEXT
title TEXT
banner_url TEXT
user1_id, user1_reason
user2_id, user2_reason
user3_id, user3_reason
created_by TEXT
created_at TIMESTAMP
```

Bảng `honor_settings` (1 row per guild):
```
guild_id TEXT PK
allowed_role_ids TEXT (JSON array)
default_channel_id TEXT
```

## Files dự kiến

**Tạo mới:**
- `bot/src/commands/vinh-danh.js` — slash command + modal handler
- `bot/src/commands/vinh-danh-history.js` — list lịch sử
- `bot/src/services/honor-service.js` — orchestrate build + persist
- `shared/db-honor.js` — CRUD `honor_history` + `honor_settings`
- `shared/build-honor-embed.js` — build EmbedBuilder (tái dùng dashboard preview)
- `dashboard/routes/honor.js` — config role + preview API
- `dashboard/public/honor-config.html` — UI config role + channel
- `dashboard/public/honor-preview.html` — preview embed

**Modify:**
- `bot/src/deploy-commands.js` — register 2 command mới
- `shared/db.js` — migration tạo 2 bảng
- `dashboard/server.js` — mount route honor
- `dashboard/public/index.html` — link tới trang config

## Rủi ro & trade-offs
- Discord modal max 5 inputs → đủ cho 1 title + 3 lý do
- Permission check 2 lớp: command-level (`defaultMemberPermissions`) + custom role check từ `honor_settings`
- I18n: toàn bộ tiếng Việt có dấu
- Banner attachment cần re-upload lên Discord khi gửi embed — discord.js xử lý sẵn

## Success criteria
- Admin có role được cấp quyền → gõ `/vinhdanh` → modal hiện → submit → embed Champion Spotlight publish trong <2s
- Banner hiển thị đúng, mention 3 user, auto-react 🎉 👏
- Bản ghi lưu vào `honor_history`
- Non-authorized user nhận "permission denied"
- `/vinhdanh-history` liệt kê 10 lần gần nhất
- Preview trong dashboard render giống Discord thật

## Next steps
Chạy `/ck:plan` để sinh implementation plan đầy đủ.

## Unresolved questions
*(Đã giải quyết tất cả)*
