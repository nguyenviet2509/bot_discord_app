---
title: Voice In/Out Notification
description: >-
  Discord bot gửi thông báo khi member join/leave voice channel, cấu hình qua
  dashboard
status: pending
priority: P2
branch: master
tags:
  - voice
  - notification
  - dashboard
blockedBy: []
blocks: []
created: '2026-06-14T04:31:20.285Z'
createdBy: 'ck:plan'
source: skill
---

# Voice In/Out Notification

## Overview

Thêm tính năng theo dõi voice channel: khi member join/leave 1 voice channel trong whitelist, bot gửi tin nhắn vào 1 text channel cấu hình sẵn. Toàn bộ cấu hình (toggle, channel notify, danh sách voice channel theo dõi, template tin nhắn) quản lý qua dashboard SPA.

**Out of scope:** switch message riêng, mute/deafen/stream, per-channel routing, voice session logging, embed UI, DM.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [DB schema + helpers](./phase-01-db-schema-helpers.md) | Completed |
| 2 | [Bot voice event handler](./phase-02-bot-voice-event-handler.md) | Completed |
| 3 | [Dashboard backend routes](./phase-03-dashboard-backend-routes.md) | Completed |
| 4 | [Dashboard UI tab](./phase-04-dashboard-ui-tab.md) | Completed |
| 5 | [Manual verification](./phase-05-manual-verification.md) | Pending |

## Dependencies

Không. Feature mới hoàn toàn, chỉ thêm intent `GuildVoiceStates` vào client (non-privileged, không cần re-authorize app).

## Key Design Decisions

- **DB shape**: 1 bảng `voice_log_settings` (per guild), whitelist voice channels lưu JSON array trong cột `watched_channels`. KISS — khớp pattern `welcome_template`.
- **Switch (A→B)**: xử lý = 2 message (leave A + join B) nếu cả 2 trong whitelist. Không có template "move" riêng.
- **Notify scope**: 1 text channel duy nhất toàn guild.
- **Placeholders**: `{user}` (mention), `{username}` (no mention), `{channel}` (voice name), `{time}` (HH:mm).
- **No DB logging**: chỉ gửi notify, không lưu voice session.
