# Phase 6 — Testing + Deploy

**Priority:** P0
**Effort:** S (~30 min)
**Depends on:** Phase 1-5

## Test checklist

### DB
- [ ] Restart bot → `honor_team_history` tự tạo
- [ ] CRUD smoke test qua node REPL

### Bot
- [ ] `/vinhdanh ca-nhan user1 user2 user3 banner` → modal cũ → publish OK (regression)
- [ ] `/vinhdanh team user1 banner` (1 member) → modal team → publish embed 1 field
- [ ] `/vinhdanh team user1..user5 banner` → embed 1 field dọc
- [ ] `/vinhdanh team user1..user10 banner` → embed 2 field inline (5+5)
- [ ] `/vinhdanh team user1..user7 banner` → embed 2 field inline (4+3)
- [ ] Member trùng → reject với message rõ
- [ ] Modal team reason chứa markdown → escape OK
- [ ] DB record `honor_team_history.member_ids` parse được JSON array
- [ ] Auto-react 🎉 👏

### History
- [ ] Tạo 1 top3 + 1 team → `/vinhdanh-history` liệt kê đúng thứ tự, icon 👤/👥
- [ ] Link "Xem" mở message gốc

### Dashboard
- [ ] Tab "Cá nhân" hiện danh sách top3, tab "Team" hiện team
- [ ] Preview switch mode top3 ↔ team render đúng
- [ ] Save settings vẫn lưu/load đúng (role + channel chung)

## Deploy
- Restart bot → auto register lại slash command (data thay đổi sang subcommand)
- Discord client refresh → `/vinhdanh` hiện ra 2 subcommand

## Communication
⚠️ Thông báo admin: `/vinhdanh ...` cũ giờ là `/vinhdanh ca-nhan ...` (breaking change)

## Success criteria
- Tất cả test pass
- Không có lỗi log
- Cả 2 mode dùng song song được
