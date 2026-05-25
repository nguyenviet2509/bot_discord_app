---
title: "ROLL — Host-only Start/Cancel buttons via ephemeral"
description: "Public 1 nút Tham gia, ephemeral host-only kèm Start/Cancel, thêm /roll-control re-open ephemeral."
status: completed
priority: P2
branch: "master"
tags: [mini-game, discord, ux]
blockedBy: []
blocks: []
created: "2026-05-25T02:14:30.000Z"
createdBy: "ck:plan"
source: skill
---

# ROLL Host-Only Buttons

## Overview

Hiện public message hiển thị 3 nút cho mọi member, member bấm Start/Cancel bị reject. Refactor để member chỉ thấy 1 nút Tham gia/Rời, host nhận ephemeral kèm Start/Cancel. Thêm `/roll-control` để host re-open ephemeral nếu reload Discord. Strict host-only (bỏ admin override).

**Brainstorm:** [plans/reports/brainstorm-260525-0914-roll-host-only-buttons.md](../reports/brainstorm-260525-0914-roll-host-only-buttons.md)

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Renderer + Handler + Lifecycle refactor](./phase-01-refactor-buttons.md) | Completed |
| 2 | [/roll-control command + manifest + test](./phase-02-roll-control.md) | Completed |

## Key Decisions (từ brainstorm)

1. **Public buttons:** chỉ 1 nút Tham gia/Rời (toggle), member không thấy Start/Cancel.
2. **Host control:** ephemeral reply kèm Start/Cancel buttons.
3. **Edge case reload:** slash command `/roll-control` host-only để re-open ephemeral.
4. **Permission:** strict host-only — bỏ admin override `ManageGuild`.
5. **customId namespace:**
   - `mg:roll:join:<id>` — public, validate message.id
   - `mg:roll:host-start:<id>` — ephemeral, skip message.id check
   - `mg:roll:host-cancel:<id>` — ephemeral, skip message.id check

## Dependencies

- Phase 1 → Phase 2 (command roll-control reuse renderer + handler đã refactor)

## Out of Scope

- Admin force-cancel/force-start
- DM host pattern
- Member ability to cancel session
