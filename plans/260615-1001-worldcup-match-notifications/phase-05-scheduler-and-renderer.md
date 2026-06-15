# Phase 05 — Scheduler + Embed Renderer + Idempotency

## Context

- Tham khảo `bot/src/utils/daily-cron.js` cho pattern setInterval/cron.
- Discord.js v14 EmbedBuilder.

## Overview

- Priority: P0
- Status: pending
- Trái tim của feature: cron 60s + renderer + idempotency + catch-up khi bot vừa start.

## Files

### Create
- `bot/src/modules/worldcup/services/notification-renderer.js` — build embed + content (ping).
- `bot/src/modules/worldcup/services/notification-scheduler.js` — tick + lookup + send.
- `bot/src/modules/worldcup/utils/format-time.js` — wrap `Intl.DateTimeFormat` cho timezone.

### Modify
- `bot/src/modules/worldcup/register.js` — start scheduler khi `client` ready, kèm catch-up run 1 lần.

## Renderer API

```js
// notification-renderer.js
function buildMatchEmbed({ match, team1, team2, timezone, nowMs }) {
  // returns { content, embeds }
  // content: nếu rolePingId thì `<@&id>` else ''
  // embeds: EmbedBuilder.toJSON()
}
```

Embed:
- Title: `🏆 Trận đấu Worldcup sắp diễn ra`
- Description: `**{name1}**  vs  **{name2}**`
- Field "Giờ thi đấu": `HH:mm (tz) — còn ~N phút` (Intl format)
- Field "Vòng": label theo round (group → `Vòng bảng {groupName}`, r16 → `Vòng 1/8`, qf → `Tứ kết`, sf → `Bán kết`, 3rd → `Tranh hạng 3`, final → `Chung kết`)
- Color: group=`#3b82f6`, knockout=`#ef4444`, final=`#facc15`

## Scheduler algorithm

```js
// notification-scheduler.js
async function tick(client, db, { isCatchUp = false } = {}) {
  const configs = listEnabledConfigs(db)
  if (!configs.length) return
  const now = Date.now()
  const maxLeadMin = Math.max(...configs.map(c => c.notify_before_minutes))
  const upperMs = isCatchUp
    ? now + 2 * 60_000             // catch-up tick: ±2m
    : now + (maxLeadMin + 2) * 60_000
  const lowerMs = isCatchUp ? now - 2 * 60_000 : now

  const matches = findUpcomingMatches(db, { fromMs: lowerMs, toMs: upperMs })
  if (!matches.length) return

  const teams = listTeams(db)   // cached
  const teamMap = new Map(teams.map(t => [t.id, t]))

  for (const cfg of configs) {
    const N = cfg.notify_before_minutes
    for (const m of matches) {
      const diffMin = (m.kick_off_at - now) / 60_000
      const inWindow = isCatchUp
        ? diffMin >= 0 && diffMin <= N    // catch-up: gửi bù bất kỳ trận nào trong (0, N] phút
        : diffMin >= N - 1 && diffMin <= N + 1
      if (!inWindow) continue
      if (hasSent(db, m.id, cfg.guild_id)) continue
      try {
        const channel = await client.channels.fetch(cfg.channel_id)
        if (!channel?.isTextBased()) continue
        const payload = buildMatchEmbed({
          match: m,
          team1: teamMap.get(m.team1_id),
          team2: teamMap.get(m.team2_id),
          timezone: cfg.timezone,
          nowMs: now,
          rolePingId: cfg.role_ping_id,
        })
        await channel.send(payload)
        markSent(db, m.id, cfg.guild_id, Date.now())
      } catch (err) {
        console.error('[worldcup] send fail', { matchId: m.id, guildId: cfg.guild_id }, err.message)
      }
    }
  }
}

function start(client, db) {
  // Run catch-up sau 5s khi bot ready
  setTimeout(() => tick(client, db, { isCatchUp: true }).catch(console.error), 5000)
  // Tick mỗi 60s
  setInterval(() => tick(client, db).catch(console.error), 60_000)
}
```

## Register integration

```js
// register.js
const { start: startScheduler } = require('./services/notification-scheduler')
module.exports = function register(client, ctx) {
  // ... migrations + seed
  client.once('ready', () => startScheduler(client, db))
}
```

## Steps

1. Tạo `format-time.js`:
   - `formatLocalTime(unixMs, tz) → "HH:mm"`.
   - `formatRemaining(unixMs, nowMs) → "còn ~30 phút"`.
2. Tạo `notification-renderer.js`.
3. Tạo `notification-scheduler.js` theo algorithm trên.
4. Hook vào `register.js` qua `client.once('ready', ...)`.
5. Wire `/test-send` Phase 04 dùng cùng renderer.
6. Test thủ công: tạo match cách now 31p, chờ tick phút 30 → verify gửi.

## Todo

- [ ] format-time util
- [ ] notification-renderer
- [ ] notification-scheduler (tick + start)
- [ ] Catch-up on ready
- [ ] Idempotency check qua notification-log
- [ ] Register hook
- [ ] Phase 04 /test-send reuse renderer
- [ ] Manual test gửi đúng phút

## Success criteria

- Tạo match `now+30m`, N=30 → gửi 1 tin ở phút 30 trước trận.
- Restart bot phút 29 → catch-up không gửi (đã có log).
- Restart bot phút 31 (chưa từng gửi) → tick thường vào phút 30 → gửi 1 lần.
- 2 guild config khác N (30, 60) → nhận tin ở phút tương ứng.

## Risks

- Channel bị xoá / bot mất quyền → log lỗi, không retry vô hạn (lỗi nuốt qua try/catch ở từng match/guild).
- Clock skew giữa server và Discord → buffer ±1 phút đủ.
- Quá nhiều guild × quá nhiều match → query lọc theo time window nên O(n) nhỏ. Acceptable cho WC scale (64 trận).

## Next

Phase 06 — smoke test E2E.
