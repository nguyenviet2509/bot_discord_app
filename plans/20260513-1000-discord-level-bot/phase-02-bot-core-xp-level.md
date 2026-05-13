# Phase 02 — Bot Core: XP System, Level Up, Role Assign

## Overview

- **Priority:** Critical
- **Status:** not-started
- **Depends on:** Phase 01 (shared/db.js must exist)
- **Description:** Discord bot entry point, messageCreate event handler, XP logic, level-up detection, role assignment, level-up notification with optional badge embed

## Key Insights

- `discord.js v14` uses `GatewayIntentBits` — must declare `MessageContent` + `GuildMembers` + `Guilds`
- Slash commands registered separately via `deploy-commands.js` — NOT auto-registered on startup
- `better-sqlite3` is synchronous — no async/await needed in db calls
- Role assign: `member.roles.add(roleId)` — requires bot role to be higher than target role
- Level formula (exponential): `xpForLevel(n) = 5 * n² + 50 * n + 100` — total XP to reach level n
- Cooldown stored as `last_message_at` Unix ms in db — no in-memory Map needed (survives restart)

## XP & Level Formula

```js
// XP required to reach level n (cumulative from 0)
function xpForLevel(level) {
  return 5 * (level ** 2) + 50 * level + 100
}

// Current level from total XP
function levelFromXp(xp) {
  let level = 0
  while (xp >= xpForLevel(level + 1)) level++
  return level
}

// XP thresholds (reference):
// Level 1:  155 XP
// Level 2:  220 XP
// Level 3:  295 XP
// Level 5:  475 XP
// Level 10: 1100 XP
// Level 20: 3100 XP
```

## Message Validation Rules

```
Valid message if ALL:
  - author.bot === false
  - guild exists (not DM)
  - content.length >= 5 (min to prevent reaction spam)
  - now - last_message_at > cooldown_seconds * 1000
```

## Flow: messageCreate event

```
1. Validate message (bot check, guild check, min length, cooldown)
2. Load guild_settings (xp_min, xp_max, cooldown_seconds, level_up_channel_id)
3. Random XP = floor(random * (xp_max - xp_min + 1)) + xp_min
4. Load user from DB (or create with xp=0, level=0)
5. user.xp += randomXP
6. newLevel = levelFromXp(user.xp)
7. leveledUp = newLevel > user.level
8. Update user: xp, level=newLevel, last_message_at=now
9. If leveledUp:
   a. Assign role rewards for newLevel (loop rewards where level_required <= newLevel)
   b. Find badge reward exactly at newLevel (type='badge')
   c. Send level-up embed to level_up_channel_id
      - With badge image if exists
      - With role mention if role reward exists
```

## Level-Up Embed Design

```
┌─────────────────────────────────────┐
│  🎉 Level Up!                       │
│                                     │
│  [Avatar] @Username                 │
│  Reached Level 5!                   │
│                                     │
│  XP: 475 | Next: 570 XP             │
│  Reward: @Vàng role                 │
│                                     │
│  [badge image if exists]            │
└─────────────────────────────────────┘
```

## Architecture

```
bot/src/
├── index.js                    — Discord client, load events, call initDb()
├── deploy-commands.js          — One-time script to register slash commands
├── events/
│   └── message-create.js       — messageCreate handler (validation + XP flow)
└── services/
    └── level-service.js        — xpForLevel(), levelFromXp(), handleLevelUp()
```

## Related Code Files

**Create:**
- `bot/src/index.js`
- `bot/src/deploy-commands.js`
- `bot/src/events/message-create.js`
- `bot/src/services/level-service.js`

## Implementation Steps

1. **`bot/src/services/level-service.js`**:
   - Export `xpForLevel(level)` — exponential formula
   - Export `levelFromXp(xp)` — iterate levels until threshold
   - Export `getXpForNextLevel(level)` — xp needed for next level (for embed progress display)
   - Export `handleLevelUp(client, guild, member, newLevel, settings)`:
     - Load rewards from DB where `level_required <= newLevel`
     - Assign Discord roles (skip if already has role, catch permission errors)
     - Find badge reward at exactly `newLevel`
     - Build and send embed to `level_up_channel_id`

2. **`bot/src/events/message-create.js`**:
   - Validate message (bot, guild, length ≥ 5, cooldown)
   - Load/create user via `db.getUser()`
   - Random XP, add to user
   - Detect level up
   - `db.upsertUser()` to save
   - If leveled up → `handleLevelUp()`

3. **`bot/src/index.js`**:
   - `GatewayIntentBits`: Guilds, GuildMessages, MessageContent, GuildMembers
   - `initDb()` on startup
   - Load events from `events/` directory dynamically
   - Load commands from `commands/` directory into `client.commands` Map
   - Handle `interactionCreate` for slash commands

4. **`bot/src/deploy-commands.js`**:
   - Read all files in `commands/`
   - POST to Discord REST API to register slash commands for GUILD_ID
   - Run once: `node src/deploy-commands.js`

## Todo

- [ ] services/level-service.js — XP formulas + handleLevelUp()
- [ ] events/message-create.js — validation + XP flow
- [ ] index.js — client setup + event/command loader
- [ ] deploy-commands.js — slash command registration script

## Success Criteria

- Bot comes online (`Ready! Logged in as BotName#0000`)
- Chatting in any channel adds XP (verify via SQLite query)
- Spam messages within cooldown are ignored
- Level-up embed appears in correct channel when threshold crossed
- Correct Discord role assigned on level up

## Security Considerations

- Never log full bot token
- Catch `DiscordAPIError` on role assign — bot may lack permission
- Message content length check prevents empty/reaction message spam
- Cooldown prevents XP farming from rapid messaging
