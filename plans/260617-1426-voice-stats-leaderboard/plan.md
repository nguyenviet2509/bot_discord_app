---
title: Voice Statistics Leaderboard
description: Thống kê người dùng voice nhiều nhất - slash command + dashboard tab
status: completed
priority: P2
branch: master
tags:
  - voice
  - statistics
  - dashboard
  - slash-command
blockedBy: []
blocks: []
created: '2026-06-17T07:26:00.000Z'
---

# Voice Statistics Leaderboard

## Overview

Track thời gian member ở trong các voice channel được watch (reuse config voice-log), expose qua slash command `/voicetop` `/voicestats` và tab dashboard "Thống kê Voice" với leaderboard + filter range (today/7d/30d/all/custom).

## Approach

- **Schema**: 1 bảng raw `voice_sessions(user_id, guild_id, channel_id, joined_at, left_at, duration_sec)`. Index `(guild_id, user_id, joined_at)` + partial index active sessions.
- **Tracking**: hook vào `voiceStateUpdate` hiện có. INSERT khi join watched, UPDATE khi leave. Close orphan + scan current state khi bot ready.
- **Surface**: 2 slash command + 1 tab dashboard mới (sidebar nav).
- **Config toggle**: tách field `voice_stats_enabled` riêng (decouple voice_log).

## Phases

| # | Phase | Status | Files |
|---|-------|--------|-------|
| 1 | [DB schema + helpers](phase-01-db-schema.md) | completed | `shared/db-voice-stats.js` |
| 2 | [Bot tracking logic](phase-02-bot-tracking.md) | completed | `voice-state-update.js`, `ready.js` |
| 3 | [Slash commands](phase-03-slash-commands.md) | completed | `commands/voice-stats.js` |
| 4 | [Dashboard tab + API](phase-04-dashboard-ui.md) | completed | `routes/voice-stats.js`, UI |

## Key Decisions

- **Raw sessions only** (option A từ brainstorm): YAGNI/KISS, không cần daily aggregate cho scale hiện tại
- **Scope = watched_channels** (reuse từ voice-log): không track ngoài range admin định nghĩa
- **Bot exclude tự động** (member.user.bot check đã có)
- **Slash response**: `/voicetop` public, `/voicestats` ephemeral (privacy cá nhân)
- **Privacy toggle**: `voice_stats_enabled` riêng để admin có thể bật voice-log mà không log stats

## Dependencies

- Reuse `voice_log_settings.watched_channels` (đọc only)
- `shared/db.js` (better-sqlite3 connection)
- Discord.js `voiceStateUpdate` event (đã có handler)

## Risks

- **Bot restart mất duration**: orphan close set `left_at = joined_at` → accept loss
- **AFK 24h+**: session quá 24h → cap duration ở query time (`MIN(left_at, joined_at + 86400)`)
- **Storage**: ~50 bytes/session, scale tốt

## Success Criteria

- `/voicetop range:7d` trả về đúng leaderboard, embed format đẹp
- Dashboard tab show cùng số với slash cho cùng range
- Bot restart không inflate data
- Query 100k rows <100ms
