# Phase 04: Dashboard REST API

**Priority:** High | **Status:** pending
**Depends on:** Phase 01

## Overview
Express routes cho BlessCastle. Reuse JWT auth middleware + guild permission check theo pattern `dashboard/routes/honor.js` / `automod.js`.

## Files
- **Create:** `dashboard/routes/blesscastle.js` (~200 LOC)
- **Modify:** `dashboard/server.js` (hoặc router index) — mount `/api/blesscastle`

## Endpoints

```
GET    /api/blesscastle/:guildId/config
       → {voiceChannelIds:[], minMinutes, sessionStartHour, sessionEndHour, enabled}

PUT    /api/blesscastle/:guildId/config
       body: partial config
       → updated config

GET    /api/blesscastle/:guildId/members
       → [{userId, username, avatar, stars, thisWeek:{voiceSeconds, attendedManual, achieved}}]
       (JOIN Discord member cache/fetch for display info; only active rows)

POST   /api/blesscastle/:guildId/attendance
       body: {userId}
       → set manual attendance = 1 for current week
       Server-side check: chỉ cho phép Mon 00:00 → Fri 19:00 (Asia/Saigon)

DELETE /api/blesscastle/:guildId/attendance
       body: {userId}
       → set manual attendance = 0 for current week (untick)

POST   /api/blesscastle/:guildId/redeem
       body: {userId}
       → create redemption log (admin_id = req.user.id), reset stars to 0
       Server-side check: stars >= 3

GET    /api/blesscastle/:guildId/redemptions?limit=50
       → recent redemption records (JOIN member info)

GET    /api/blesscastle/:guildId/voice-channels
       → list voice channels của guild (reuse `dashboard/routes/discord-channels.js` pattern hoặc dùng bot IPC)
```

## Auth
- Reuse existing JWT middleware
- Guild permission: user phải là admin của guildId (check qua bot IPC hoặc cached member roles)
- Return 401 nếu no token, 403 nếu no permission

## Discord data resolution
- Member info (username, avatar): reuse pattern từ `honor.js` / `analytics.js`
- Voice channels: reuse `discord-channels.js` với filter `type === GUILD_VOICE`

## Todo
- [ ] File `dashboard/routes/blesscastle.js` với router Express
- [ ] Implement all 8 endpoints
- [ ] Mount vào server.js
- [ ] Server-side validation: time window (T2 → 19h thứ 6) cho manual tick
- [ ] Server-side check stars >= 3 trước khi redeem
- [ ] Error responses format consistent

## Success Criteria
- Postman/curl test all endpoints OK
- Manual tick sau 19h thứ 6 → 400 error
- Redeem khi stars < 3 → 400 error
- Non-admin user → 403

## Risks
- Discord API rate limit khi fetch nhiều members → dùng cache trước
- Race: 2 admin cùng redeem 1 user → cần transaction hoặc last-write-wins với warning
