---
name: Auto-Mod Lite
slug: auto-mod-lite
status: in-progress
created: 2026-05-18
branch: master
mode: auto
brainstorm: plans/reports/brainstorm-260518-1431-auto-mod-lite.md
blockedBy: []
blocks: []
---

# Auto-Mod Lite — Plan Overview

Module tự động phát hiện và xử phạt vi phạm (spam, invite, bad-word, mass-mention, repeat) với ladder action (warn → mute → kick). Tích hợp dashboard config + logs viewer. Đóng gói theo pattern module có sẵn (`bot/src/modules/auto-mod/`).

**Source:** [brainstorm-260518-1431-auto-mod-lite.md](../reports/brainstorm-260518-1431-auto-mod-lite.md)
**Module pattern reference:** `bot/src/modules/mini-game/` + `bot/src/modules/_loader.js`

## Phases

| # | Phase | Status | Effort |
|---|---|---|---|
| 1 | [DB schema + db-automod.js](phase-01-db-schema.md) | ✅ done | 1 ngày |
| 2 | [Rules engine + state + 5 rules](phase-02-rules-engine.md) | ✅ done | 3 ngày |
| 3 | [Action engine + logging + hook message-create](phase-03-action-engine.md) | ✅ done | 1 ngày |
| 4 | [Dashboard config API + UI](phase-04-dashboard-config.md) | ✅ done | 2 ngày |
| 5 | [Dashboard logs viewer](phase-05-dashboard-logs.md) | ✅ done (gộp với P4) | 1 ngày |
| 6 | [Test thực tế + tinh chỉnh](phase-06-test-tuning.md) | ⏳ chờ test thực tế | 1-2 ngày |

**Tổng:** ~1.5 tuần

## Key dependencies

- Module loader sẵn có (`_loader.js`) — cần mở rộng hỗ trợ `messageHandlers` array (tương tự `buttonHandlers`)
- Event `message-create.js` — cần chèn pipeline auto-mod trước logic XP/link (early-return nếu tin bị xóa)
- `shared/db.js` — thêm migration cho 4 bảng mới qua `db-automod.js`
- Moderation commands có sẵn (`mute.js`, `kick.js`) — action engine tái sử dụng logic timeout/kick

## Success criteria
- 5 rules hoạt động, có thể toggle độc lập per-guild
- Ladder action chính xác theo warn count
- Dashboard config lưu/đọc đúng, UI logs phân trang được
- False positive < 2% sau tuần đầu test
- Latency check < 50ms/message

## Risks
| Risk | Mitigation |
|---|---|
| False positive | Whitelist channel/role, log đầy đủ |
| Performance regex bad-word | Compile cache, `\b` boundary |
| State spam mất khi restart | Acceptable, in-memory Map TTL |
| Conflict với event message-create hiện có | Pipeline chạy trước, return early khi tin bị xóa |

## Unresolved questions
1. Appeal flow — phase 2 (sau MVP)
2. Bad-word default list tiếng Việt — để trống, admin tự thêm
3. Anti-raid — phase 2
4. Tích hợp honor (vi phạm trừ điểm) — TBD
