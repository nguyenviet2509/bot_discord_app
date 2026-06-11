# Phase 03 — Module Skeleton `wc-pickem`

**Status:** pending | **Priority:** P0 | **Effort:** XS (~1h)
**Depends on:** Phase 01, 02

## Context

Existing module pattern: [bot/src/modules/mini-game/](../../bot/src/modules/mini-game/). Loader đọc `manifest.js` để quyết định nạp module và hiện trên dashboard.

## Files

**Create:**
- `bot/src/modules/wc-pickem/manifest.js`
- `bot/src/modules/wc-pickem/register.js`
- `bot/src/modules/wc-pickem/commands/.gitkeep` (placeholder, slash commands ở phase sau)
- `bot/src/modules/wc-pickem/handlers/.gitkeep`
- `bot/src/modules/wc-pickem/services/.gitkeep`

## Content

### manifest.js
```js
module.exports = {
  key: 'wc-pickem',
  name: 'Dự đoán World Cup 2026',
  description: 'Daily Pick\'em 1X2 + Bracket Challenge cho mùa WC 2026. Reward setup ở dashboard.',
  defaultEnabled: false,
  commands: ['wc-bracket', 'wc-leaderboard', 'wc-prizes'],
}
```

### register.js
```js
// Đăng ký button handler + start cron poller khi module enabled
const pickemButtonHandler = require('./handlers/pickem-button-handler')
const matchPoller = require('./services/match-poller')

module.exports = function register(client, ctx) {
  ctx.buttonHandlers.push(pickemButtonHandler.handle)
  matchPoller.start(client) // start cron jobs
}
```

## Todo

- [ ] Create folder structure
- [ ] Write manifest.js theo template
- [ ] Write register.js skeleton (handler + poller mới chỉ có stub trước, code thật ở Phase 04)
- [ ] Verify loader nhận module (kiểm tra dashboard tab Modules có entry mới)

## Success Criteria

- Module xuất hiện trong dashboard Modules list
- Bật/tắt qua dashboard hoạt động (toggle `guild_modules.enabled`)
- Bot không crash khi module bật/tắt
