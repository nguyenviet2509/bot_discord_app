# Phase 03 — Slash Commands: /rank, /leaderboard

## Overview

- **Priority:** High
- **Status:** not-started
- **Depends on:** Phase 01 (db.js), Phase 02 (level-service.js)
- **Description:** Two slash commands for members to check their stats and compete

## Commands

### `/rank [@user]`
- Optional `@user` parameter — defaults to command invoker
- Shows: avatar, current level, XP progress bar (text-based), rank position in server
- Response: ephemeral optional (public is better for engagement)

```
┌────────────────────────────────────────┐
│  📊 Rank — @Username                   │
│  ─────────────────────────────────     │
│  Level: 5                              │
│  XP: 475 / 570  [████████░░] 83%       │
│  Server Rank: #3                       │
└────────────────────────────────────────┘
```

### `/leaderboard`
- Top 10 members by XP in the server
- Sorted DESC by XP
- Shows rank number, username, level, XP
- No pagination needed for < 100 members

```
┌────────────────────────────────────────┐
│  🏆 Leaderboard — Top 10               │
│  ─────────────────────────────────     │
│  #1  @Alice   Level 12  •  2,100 XP    │
│  #2  @Bob     Level 10  •  1,650 XP    │
│  #3  @You     Level 5   •  475 XP      │
│  ...                                   │
└────────────────────────────────────────┘
```

## Architecture

```
bot/src/commands/
├── rank.js           — SlashCommandBuilder + execute()
└── leaderboard.js    — SlashCommandBuilder + execute()
```

## Implementation Steps

1. **`bot/src/commands/rank.js`**:
   - `SlashCommandBuilder` with optional `user` option (UserType)
   - `execute(interaction)`:
     - Resolve target user (option or interaction.user)
     - `db.getUser(targetId, guildId)`
     - If no user found → reply "No XP data yet"
     - `levelFromXp()`, `xpForNextLevel()`
     - Compute progress %: `(user.xp - xpForLevel(level)) / (xpForNextLevel - xpForLevel(level))`
     - Build text progress bar: 10 chars, `█` filled, `░` empty
     - Compute rank: `db.getUserRank(userId, guildId)` — COUNT users with xp > this user + 1
     - Reply with embed

2. **`bot/src/commands/leaderboard.js`**:
   - No options
   - `execute(interaction)`:
     - `db.getLeaderboard(guildId, 10)` — SELECT top 10 ORDER BY xp DESC
     - Map to formatted lines, fetch Discord usernames via `client.users.fetch(id)`
     - Highlight requester's position if in top 10
     - Reply with embed

3. **Add to `shared/db.js`**:
   - `getUserRank(userId, guildId)` — `SELECT COUNT(*)+1 FROM users WHERE guild_id=? AND xp > (SELECT xp FROM users WHERE id=? AND guild_id=?)`
   - `getLeaderboard(guildId, limit)` — `SELECT * FROM users WHERE guild_id=? ORDER BY xp DESC LIMIT ?`

## Todo

- [ ] commands/rank.js
- [ ] commands/leaderboard.js
- [ ] db.getUserRank() helper
- [ ] db.getLeaderboard() helper
- [ ] Run deploy-commands.js to register with Discord

## Success Criteria

- `/rank` shows correct XP, level, progress bar, rank number
- `/rank @otherUser` shows their stats
- `/leaderboard` shows top 10 sorted correctly
- Commands appear in Discord slash command autocomplete
- No unhandled promise rejections on unknown users

## Edge Cases

- User has no XP yet → friendly message, not an error
- Leaderboard with < 10 members → show all available
- Target user left the server → `client.users.fetch()` still works by ID, show "(unknown)" for display name
