---
title: "Mini-game ROLL multi-player"
description: "Thêm mini-game ROLL (N người, random unique 1-100) vào module mini-game, có dashboard quản lý lịch sử."
status: completed
priority: P2
branch: "master"
tags: [mini-game, discord, dashboard]
blockedBy: []
blocks: []
created: "2026-05-24T16:51:17.613Z"
createdBy: "ck:plan"
source: skill
---

# Mini-game ROLL multi-player

## Overview

Thêm mini-game ROLL multi-player vào module `bot/src/modules/mini-game`:
- `/roll-start` (admin/mod) tạo session với option max-người + thời hạn
- Embed có nút **Tham gia/Rời khỏi** (toggle), **Bắt đầu roll**, **Hủy**
- Khi chốt: random unique uniform 1-100 (Fisher-Yates + crypto.randomInt), vinh danh top 1 + ranking đầy đủ
- Không cược coin (vui)
- 1 guild = 1 session active
- Dashboard view lịch sử + clear theo ngày / nuke

**Tham chiếu brainstorm:** [plans/reports/brainstorm-260524-2349-roll-mini-game.md](../reports/brainstorm-260524-2349-roll-mini-game.md)

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [DB Schema](./phase-01-db-schema.md) | Completed |
| 2 | [Services Core](./phase-02-services-core.md) | Completed |
| 3 | [Renderer & Handler](./phase-03-renderer-handler.md) | Completed |
| 4 | [Slash Command](./phase-04-slash-command.md) | Completed |
| 5 | [Startup Sweep](./phase-05-startup-sweep.md) | Completed |
| 6 | [Dashboard](./phase-06-dashboard.md) | Completed |
| 7 | [Test & Docs](./phase-07-test-docs.md) | Completed |

## Key Decisions (chốt từ brainstorm)

1. ~~**Pool scale**: thêm cột `score_max INTEGER DEFAULT 100` (forward-compat). Phase 1 clamp 100.~~ **REVISED (Validation 2026-05-25):** Bỏ cột `score_max` — hardcode 100. YAGNI. Khi cần custom range → ALTER TABLE sau.
2. **Edit embed spam**: debounce 1s coalesce + bypass khi state change.
3. **Zombie session restart**: startup sweep + re-schedule timer + stuck-rolling guard.
4. **Random**: Fisher-Yates partial từ pool `[1..score_max]` với `crypto.randomInt` (uniform, audit-proof).
5. **State machine**: `open → rolling → finished` hoặc `open → cancelled`. Transition wrap SQLite transaction.

## Dependencies

- Phase 1 → Phase 2 (services cần schema)
- Phase 2 → Phase 3 (renderer cần store)
- Phase 3 → Phase 4 (command cần button handler)
- Phase 4 → Phase 5 (sweep cần lifecycle hoàn chỉnh)
- Phase 5 → Phase 6 (dashboard cần data + state ổn định)
- Phase 6 → Phase 7

## Red Team Review

### Session — 2026-05-25
**Findings:** 13 (13 accepted, 0 rejected — scope-critic findings noted but không apply do user đã chốt brainstorm)
**Severity breakdown:** 2 Critical, 9 High, 2 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Dashboard API thiếu per-guild ACL — bất kỳ authed user nào đọc/xóa được mọi guild | Critical | Accept | Phase 6 |
| 2 | Nuke endpoint: confirm token cố định + default-no-guildId wipe toàn bộ | Critical | Accept | Phase 6 |
| 3 | Button `onStart`/`onCancel` không check host/admin — participant force-roll được | High | Accept | Phase 3 |
| 4 | Insert-then-send race → zombie open session khi `channel.send` fail | High | Accept | Phase 4 |
| 5 | Thiếu UNIQUE partial index — 2 admin /roll-start cùng lúc tạo duplicate | High | Accept | Phase 1 |
| 6 | `addParticipant` capacity check + insert không atomic — vượt max_players | High | Accept | Phase 2 |
| 7 | Sweep query trước khi schema init xong → fresh deploy crash | High | Accept | Phase 5 |
| 8 | Crash giữa `transitionToRolling` và `settleScores` → mất kết quả; phải wrap 1 txn | High | Accept | Phase 2 |
| 9 | Debounce race: late `scheduleEdit` ghi đè result embed sau `editNow` | High | Accept | Phase 3 |
| 10 | Timer fire trong transition window; `cancelSession` nhận cả `rolling` → ghi đè finished | High | Accept | Phase 2 |
| 11 | Embed `field.value` limit = **1024** (plan ghi 4096) → overflow ~35 mentions | High | Accept | Phase 3 |
| 12 | Thiếu `allowedMentions` → 100 user = mass-ping storm | Medium | Accept | Phase 2,3,4,5 |
| 13 | customId hijack: không validate `message.id` / `channel.id` khớp session | Medium | Accept | Phase 3 |

Chi tiết fix nằm trong section `## Red Team Fixes (2026-05-25)` của từng phase file.

**Rejected (noted, không apply):**
- 4-file service split / state machine / startup sweep / dashboard tab / score_max forward-compat / 16h estimate → user đã chốt trong brainstorm, để nguyên scope.
- Audit commit-reveal random / ephemeral deprecation / engine pool alloc → minor, không lift.

## Validation Log

### Session 1 — 2026-05-25
**Trigger:** Post red-team validation interview, làm rõ quyết định còn mở.
**Questions asked:** 8

#### Questions & Answers

1. **[Architecture]** Dashboard JWT hiện tại có claim per-guild chưa?
   - **Answer:** Kiểm tra routes hiện có rồi copy pattern (Recommended)
   - **Rationale:** Phase 6 phải đọc `dashboard/routes/automod.js` + `scheduled-messages.js` **trước** khi viết code → copy pattern scope guild đã có. Nếu codebase chưa có pattern → escalate trước khi tiếp tục.

2. **[Architecture]** Audit log cho nuke / clear-old-days lưu ở đâu?
   - **Answer:** Console log + file log
   - **Rationale:** Không tạo bảng audit mới. Log line text-based với `actor_user_id/action/guild_id/count` vào stdout (winston/console đã có). YAGNI cho fun-game data.

3. **[Scope]** Khi participant list dài (>30 user), embed render thế nào?
   - **Answer:** Truncate "... và N người khác" sau 30
   - **Rationale:** Đảm bảo `field.value < 1024` chắc chắn. Đơn giản hơn split fields. Result embed cũng truncate top 30, ghi chú N còn lại.

4. **[Architecture]** Sweep startup chạy lúc nào?
   - **Answer:** Trong `ready` handler, **await** trước khi attach interaction listener
   - **Rationale:** Tránh race window user bấm button khi zombie session chưa xử lý. Phase 5 cần đảo flow: `await sweepOnStartup()` rồi mới `client.on('interactionCreate', ...)`.

5. **[Scope]** Cột `score_max` forward-compat?
   - **Answer:** Bỏ, hardcode 100
   - **Rationale:** YAGNI. Brainstorm decision #1 revert. Phase 1 schema bỏ cột, Phase 2 engine hardcode `scoreMax=100`, Phase 3 footer dùng const.

6. **[Scope]** Service file split: giữ 4 file?
   - **Answer:** Giữ 4 file như plan
   - **Rationale:** Match pattern RPS đã có trong codebase. Tổng < 200 dòng/file, đúng modularization rule.

7. **[Risks]** Nuke confirm token?
   - **Answer:** Hardcode 'NUKE' + audit log + bắt buộc guildId
   - **Rationale:** Mis-click guard đủ với single-admin context. Audit log để debug. Frontend prompt user gõ 'NUKE'.

8. **[Assumption]** Slash command deploy?
   - **Answer:** Check pattern hiện tại, theo như RPS
   - **Rationale:** Phase 4 step 4.4 phải grep `bot/src/` tìm script deploy của `/rps` → follow y hệt. Không tự quyết global vs guild-scoped.

#### Confirmed Decisions
- Bỏ `score_max` column — hardcode 100
- 4-file split giữ nguyên
- Embed truncate at 30 mentions, dùng description thay field
- Sweep await trong ready trước khi attach listener
- Dashboard authz: copy pattern existing routes (mandatory pre-check)
- Audit: console + file log, không cần bảng mới
- Nuke: hardcoded NUKE + audit + required guildId
- Slash deploy: follow RPS pattern

#### Impact on Phases
- **Phase 1:** Bỏ `score_max INTEGER DEFAULT 100`, bỏ note forward-compat
- **Phase 2:** Engine signature `rollScores(n)` không nhận `scoreMax`, hardcode 100. Store/lifecycle bỏ `scoreMax` param.
- **Phase 3:** Footer embed dùng const `'Pool điểm: 1-100 · Không trùng'`. Renderer truncate list ở 30 mentions, dùng `setDescription` thay `addFields` cho participant list.
- **Phase 4:** Bỏ `SCORE_MAX_DEFAULT` const. Step 4.4 phải grep tìm script deploy RPS cụ thể trước khi viết.
- **Phase 5:** Đảo flow `bot/src/index.js`: `await sweepOnStartup(client)` **trước** khi attach `interactionCreate` listener (hoặc làm cho listener short-circuit khi sweep chưa xong).
- **Phase 6:** Step đầu phải đọc `automod.js` + `scheduled-messages.js` để copy auth pattern. Audit log dùng `console.log('[roll-history:audit]', ...)` không tạo bảng mới.

## Out of scope

- Cược coin (extend sau bằng escrow pattern như RPS)
- Multiple sessions/guild
- Leaderboard cross-session
- Score range custom qua option lệnh (đã forward-compat sẵn cột)
- Animation rolling
