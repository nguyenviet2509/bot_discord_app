---
phase: 7
title: "Test & Docs"
status: pending
priority: P3
effort: "2h"
dependencies: [6]
---

# Phase 7: Test & Docs

## Overview

Manual test toàn bộ flow, update docs codebase summary, kiểm tra commit message convention.

## Requirements

**Functional:**
- Test 11 scenarios E2E (xem checklist)
- Update `docs/codebase-summary.md` thêm section mini-game ROLL
- Update `docs/system-architecture.md` nếu cần (schema + flow chart)

**Non-functional:**
- Không có lỗi runtime trong console khi chạy flow
- Compile check pass cho tất cả file mới/sửa

## Architecture

Không có code mới, chỉ test + docs.

## Related Code Files

- **Modify:**
  - `docs/codebase-summary.md`
  - (Optional) `docs/system-architecture.md`
  - (Optional) `docs/project-changelog.md` — entry "ROLL multi-player game"

## Implementation Steps

### 7.1. Manual test scenarios (Discord)

| # | Kịch bản | Kỳ vọng |
|---|----------|---------|
| 1 | Non-admin gọi `/roll-start` | Reject ephemeral "Chỉ admin..." |
| 2 | Admin gọi `/roll-start so-nguoi-toi-da:5 thoi-han-phut:2` | Embed public + ephemeral confirm |
| 3 | Admin gọi lần 2 cùng guild | Reject "đã có session active #N" |
| 4 | User bấm Tham gia | Join, embed update sau 1s (debounce) |
| 5 | 5 user join trong 100ms | Chỉ 1 lần edit message, list đầy đủ 5 người |
| 6 | User join → bấm Tham gia lần 2 | Toggle thành Rời khỏi, embed update |
| 7 | Đủ 5/5 → user thứ 6 bấm Tham gia | Reply ephemeral "Đã đủ 5/5" |
| 8 | Admin bấm Bắt đầu khi 1 người | Reply "Cần ≥ 2 người" |
| 9 | 3 người, admin bấm Bắt đầu | Result embed, winner ping, 3 score unique trong [1..100] |
| 10 | Admin bấm Hủy giữa chừng | Cancel embed, embed update ngay |
| 11 | Timeout 2 phút đến + < 2 người | Auto cancel "Hết hạn, không đủ người" |
| 12 | Restart bot khi session `open` còn hạn | Bot ready → timer reschedule, log "[roll:sweep] Re-schedule" |
| 13 | Restart bot khi session đã hết hạn | Cancel ngay, edit embed |
| 14 | Update DB thủ công state='rolling' → restart | Force cancel "Bot restart giữa lúc roll" |

### 7.2. Dashboard test

| # | Kịch bản | Kỳ vọng |
|---|----------|---------|
| 1 | Mở tab "Lịch sử ROLL" chưa login | Redirect login |
| 2 | Sau login | Load list, hiển thị session đã tạo |
| 3 | Filter guildId | Chỉ session của guild đó |
| 4 | Filter date range | Đúng cutoff |
| 5 | Click row | Modal detail với participants + score |
| 6 | Nút "Xóa > 30 ngày" | Confirm dialog → xóa, count = 0 row mới (vì chưa có data cũ) |
| 7 | Nút "Xóa tất cả" + gõ NUKE | Xóa hết, list rỗng |
| 8 | Xóa session → kiểm DB | `roll_participant` của session đó cũng bị xóa (CASCADE) |

### 7.3. Compile + lint check

```bash
cd f:/projects/bot_discord_app
# Compile tất cả file mới
for f in \
  bot/src/modules/mini-game/commands/roll.js \
  bot/src/modules/mini-game/handlers/roll-button-handler.js \
  bot/src/modules/mini-game/services/roll-engine.js \
  bot/src/modules/mini-game/services/roll-timeout.js \
  bot/src/modules/mini-game/services/roll-session-store.js \
  bot/src/modules/mini-game/services/roll-lifecycle.js \
  bot/src/modules/mini-game/services/roll-renderer.js \
  dashboard/routes/roll-history.js
do
  node -e "require('./$f')" && echo "OK: $f" || echo "FAIL: $f"
done
```

### 7.4. Update `docs/codebase-summary.md`

Thêm section dưới phần mini-game RPS:

```markdown
### Mini-game ROLL (multi-player)

**Module path:** `bot/src/modules/mini-game/`

Slash command: `/roll-start so-nguoi-toi-da thoi-han-phut` (admin only)

**Flow:** session pending (open) → host bấm Bắt đầu → roll random unique 1-100 → finished.
Auto-cancel khi timeout hoặc bot restart phát hiện zombie.

**DB tables:** `roll_session`, `roll_participant`
**Engine:** Fisher-Yates partial shuffle + `crypto.randomInt` (uniform, unique)
**Dashboard:** Tab "Lịch sử ROLL" — list/detail/clear-by-days/nuke
```

### 7.5. Update `docs/project-changelog.md`

```markdown
## [unreleased] - 2026-05-24

### Added
- Mini-game ROLL multi-player: `/roll-start` (admin), random unique 1-100, vinh danh top 1
- Dashboard tab "Lịch sử ROLL" với filter + clear cũ + nuke
- Schema mới: `roll_session`, `roll_participant`
```

### 7.6. Git commit

Theo `.claude/rules/auto-commit-push.md`:
```
feat: add ROLL multi-player mini-game + dashboard history

- Phase 1: roll_session + roll_participant schema
- Phase 2: services (store, engine, timeout, lifecycle)
- Phase 3: renderer + button handler with debounce
- Phase 4: /roll-start slash command + register
- Phase 5: startup sweep for zombie sessions
- Phase 6: dashboard history tab + API
- Phase 7: docs + manual test

Plan: plans/260524-2349-roll-mini-game/
```

## Success Criteria

- [ ] 14 scenario Discord pass
- [ ] 8 scenario dashboard pass
- [ ] Tất cả file mới compile pass
- [ ] `docs/codebase-summary.md` cập nhật
- [ ] `docs/project-changelog.md` có entry
- [ ] Commit + push theo convention

## Risk Assessment

| Risk | Severity | Mitigation |
|------|---------|-----------|
| Test bỏ sót edge case | Medium | Checklist 22 scenarios cover hầu hết flow |
| Docs lệch implementation | Low | Cập nhật trong cùng phase, review trước commit |
| Manual test tốn thời gian | Low | Có thể skip test 5 (concurrency) nếu khó tái hiện, log debounce đã đủ verify |
