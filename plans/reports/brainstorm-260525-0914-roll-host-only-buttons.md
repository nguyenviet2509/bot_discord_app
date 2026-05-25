---
title: "ROLL — Host-only Start/Cancel buttons via ephemeral"
date: 2026-05-25
type: brainstorm
status: ready-for-plan
---

# Brainstorm: ROLL Host-Only Control Buttons

## Problem

Hiện tại public message của `/roll-start` hiển thị 3 nút cho mọi user: Tham gia, Bắt đầu, Hủy. Member bấm Start/Cancel bị reject ephemeral → UX không tốt, thấy nút vô dụng.

User muốn:
- Public chỉ hiển thị 1 nút **Tham gia/Rời khỏi** (toggle) cho mọi member
- Chỉ **host** (người gõ `/roll-start`) thấy & dùng nút **Bắt đầu** và **Hủy session**

## Discord Constraint

Discord button là **per-message**, không per-user → không thể render khác nhau cho mỗi viewer trên cùng 1 message. Phải dùng pattern khác: ephemeral / DM / separate command.

## Decisions (sau interview)

| # | Quyết định |
|---|------------|
| 1 | "Hủy" trong yêu cầu = **Rời khỏi session** (toggle Join/Leave). Member chỉ 1 nút duy nhất. |
| 2 | UX pattern: **Public 1 nút Tham gia + ephemeral cho host kèm Start/Cancel** |
| 3 | Edge case host reload: thêm slash command **`/roll-control`** để host re-open ephemeral |
| 4 | Permission: **strict host-only** (bỏ admin override `ManageGuild`) |

## Solution Design

### Flow

```
/roll-start
  → Bot post public message với 1 nút "Tham gia/Rời khỏi"
  → Bot reply ephemeral cho host (interaction.reply ephemeral) kèm 2 nút "Bắt đầu" + "Hủy"
  → Host bấm Start trong ephemeral → edit public message → result embed
  → Host bấm Cancel → edit public → cancel embed
  → Nếu host reload Discord → /roll-control → bot re-reply ephemeral
```

### Code Changes (vs current implementation)

#### 1. `roll-renderer.js`
Tách `buildPendingButtons` → 2 hàm:
- `buildPublicButtons(sessionId, joined)` — 1 nút Tham gia/Rời (toggle)
- `buildHostButtons(sessionId)` — 2 nút Bắt đầu + Hủy

#### 2. `roll-button-handler.js`
- Phân biệt customId:
  - `mg:roll:join:<id>` — public, validate `message.id === session.message_id`
  - `mg:roll:host-start:<id>` — ephemeral, **skip** message.id check
  - `mg:roll:host-cancel:<id>` — ephemeral, **skip** message.id check
- Vẫn check `channel_id` match (ephemeral cùng channel).
- Host actions: verify `interaction.user.id === session.host_id` (no admin fallback).

#### 3. `commands/roll.js`
Sau khi insert session:
- Edit public message với `buildPublicButtons` (1 nút)
- `interaction.editReply` ephemeral kèm `buildHostButtons` (2 nút) thay vì plain text

#### 4. `roll-lifecycle.js`
- Đổi `ensureHostOrAdmin` → `ensureHost` (strict, no admin).
- `onStart`/`onCancel` không cần biết source ephemeral vs public — chỉ cần verify host.

#### 5. New file `commands/roll-control.js`
Host-only slash command:
```
/roll-control
  → query active session by guild
  → verify caller.id === session.host_id
  → reply ephemeral với buildHostButtons
```
- Reject nếu không có active session hoặc không phải host.
- Permission gate: `setDefaultMemberPermissions(ManageGuild)` (UI hint), in-execute check `user.id === host_id`.

#### 6. `manifest.js`
Thêm `roll-control` vào commands list.

### Files Affected

**Modify:**
- `bot/src/modules/mini-game/services/roll-renderer.js`
- `bot/src/modules/mini-game/handlers/roll-button-handler.js`
- `bot/src/modules/mini-game/services/roll-lifecycle.js`
- `bot/src/modules/mini-game/commands/roll.js`
- `bot/src/modules/mini-game/manifest.js`

**Create:**
- `bot/src/modules/mini-game/commands/roll-control.js`

## Pros / Cons

| Pros | Cons |
|------|------|
| UX rõ — member không thấy nút vô dụng | Thêm 1 slash command + complexity ephemeral lifecycle |
| Strict host-only đơn giản, không cần admin perm logic | Mất admin force-cancel (host AFK → phải đợi timeout) |
| Reuse component đã có (ephemeral reply pattern giống RPS) | Ephemeral có thể mất khi reload → cần `/roll-control` |
| Bảo mật: chỉ host bấm được button host (interaction.user.id check) | Edge: nếu host rời server giữa session → không ai start/cancel được, chỉ chờ timeout |

## Risks & Mitigation

| Risk | Severity | Mitigation |
|------|---------|-----------|
| Ephemeral mất khi reload | Medium | `/roll-control` re-open |
| Host rời server giữa session | Low | Timer expire auto-cancel sau N phút (đã có) |
| Race: 2 ephemeral reply (host gõ `/roll-control` 2 lần) | Low | Cả 2 nút work, không state corrupt (DB là source of truth) |
| Admin lo lắng không control được | Low | Document rõ: host-only by design; admin có thể xóa qua dashboard sau |

## Effort Estimate

~1.5h:
- Renderer split: 15p
- Handler customId routing: 15p
- Command roll.js + ephemeral host buttons: 30p
- New `/roll-control`: 20p
- Compile check + manual test 6 scenarios: 30p

## Success Criteria

- [ ] Member chỉ thấy 1 nút "Tham gia/Rời khỏi" trên public message
- [ ] Host nhận ephemeral kèm 2 nút Start/Cancel ngay sau `/roll-start`
- [ ] Member không bấm được Start/Cancel (không thấy nút)
- [ ] Host bấm Start/Cancel trên ephemeral → public message update đúng
- [ ] `/roll-control` reject non-host
- [ ] `/roll-control` reply ephemeral cho host với buttons khi có active session
- [ ] Timer expire vẫn auto-cancel khi host AFK

## Out of Scope

- Admin force-cancel (đã decline ở decision #4)
- DM host thay vì ephemeral (Discord DM bị nhiều user tắt)
- Cancel by anyone (đã decline ở decision #1)

## Next Steps

Tạo plan implementation chi tiết qua `/ck:plan`.

## Unresolved Questions

Không có — design đã đủ chi tiết để implement.
