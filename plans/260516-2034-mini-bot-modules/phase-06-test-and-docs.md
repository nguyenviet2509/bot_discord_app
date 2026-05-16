# Phase 06 — Test E2E + docs sync

## Overview
- Priority: should
- Status: ⏳ pending
- Estimate: S (~30-45 phút)
- Depends: tất cả phase trước

E2E sanity test trên guild dev + cập nhật docs.

## Test checklist

### Bot boot
- [ ] `npm run bot` boot không lỗi
- [ ] Log: `[Modules] Loaded 1 module: mini-game`
- [ ] Slash commands register thành công (kiểm log `[Commands] ✅`)

### Module disabled (default)
- [ ] `/rps kéo` → reply ephemeral "Module chưa bật"
- [ ] `/rank` (core) → vẫn chạy bình thường

### Module enabled (qua dashboard)
- [ ] Toggle ON ở dashboard → DB có row `enabled=1`
- [ ] `/rps kéo` → reply embed, coin balance update
- [ ] `/odd-even chẵn 50` (balance < 50 cho phép âm) → trừ đúng
- [ ] `/guess-number start 1 100` → tạo session; `/guess-number guess 50` → reply hint hoặc thắng
- [ ] `/guess-number guess` ở channel khác cùng guild → "không có game"
- [ ] Guess đúng → +50 coin, session xoá
- [ ] `/coin balance` → đúng số dư
- [ ] `/coin history` → list 5 tx gần nhất

### Toggle OFF runtime
- [ ] Tắt qua dashboard → command tiếp theo bị gate chặn (không restart bot)

### Regression core
- [ ] `/leaderboard`, `/post`, `/ban`, `/mute`... đều chạy bình thường

## Docs cần update

| File | Update |
|---|---|
| `docs/codebase-summary.md` | Thêm section "Modules system" mô tả `bot/src/modules/` |
| `docs/system-architecture.md` | Diagram (text) load flow: core commands + modules loader |
| `docs/code-standards.md` | Convention manifest cho module mới |
| `docs/project-changelog.md` | Entry mới: "Added module system + mini-game pilot + coin economy" |

## Steps
1. Chạy checklist test thủ công, ghi kết quả vào comment phase
2. Fix bug nếu có (loop về phase tương ứng)
3. Update 4 docs file
4. Delegate `docs-manager` nếu cần review docs

## Todo
- [ ] Chạy full test checklist
- [ ] Fix bug (nếu có)
- [ ] Update `docs/codebase-summary.md`
- [ ] Update `docs/system-architecture.md`
- [ ] Update `docs/code-standards.md` — convention module
- [ ] Update `docs/project-changelog.md`

## Success criteria
- Tất cả checkbox test PASS
- Docs phản ánh hạ tầng module mới
- Plan status → `completed`
