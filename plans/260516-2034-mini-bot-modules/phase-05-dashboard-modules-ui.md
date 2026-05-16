# Phase 05 — Dashboard API + UI /modules

## Overview
- Priority: must
- Status: ⏳ pending
- Estimate: L (~4h, gồm detail panel + usage stats API)
- Depends: Phase 02 (cần manifest), Phase 01 (cần DB)

API + page web để admin xem danh sách module và toggle on/off per-guild.

## Files (new)
- `dashboard/routes/modules.js`
- `dashboard/public/modules.html`
- `dashboard/public/js/modules.js`

## Files (modify)
- `dashboard/server.js` (mount route)
- `dashboard/public/index.html` hoặc sidebar nav (thêm link "Modules")

## Manifest discovery từ dashboard

Vấn đề: bot và dashboard là 2 process khác nhau. Dashboard không có `client._modules`. Cần đọc manifest trực tiếp từ filesystem.

Giải pháp: helper `dashboard/routes/modules.js` tự `fs.readdirSync('../bot/src/modules')` + `require manifest.js`. Cache 1 lần lúc startup (manifest static, không đổi runtime).

```js
const path = require('path')
const fs = require('fs')

function loadManifests() {
  const dir = path.join(__dirname, '../../bot/src/modules')
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => {
      const manifestPath = path.join(dir, d.name, 'manifest.js')
      if (!fs.existsSync(manifestPath)) return null
      try { return require(manifestPath) } catch { return null }
    })
    .filter(Boolean)
}
const MANIFESTS = loadManifests()
```

## API

```
GET  /api/modules?guild_id=<id>
  → [{key, name, description, defaultEnabled, enabled, commands}]
  enabled = DB row có sẵn ? row.enabled : manifest.defaultEnabled

POST /api/modules/toggle
  body: { guild_id, module_key, enabled }
  → { ok: true, enabled }

GET  /api/modules/:key/detail?guild_id=<id>
  → {
      manifest: {...},
      stats: { uses7d, uniqueUsers, coinPaid, errors24h, enabledAt },
      commandDetails: [{name, desc, uses}],
      topUsers: [{user_id, user_name, uses, coin}],
      activity: [{icon, text, time}],
    }
  Gộp 4 helper getModule* để tránh 4 round-trip.

POST /api/modules/:key/settings (optional, scope mở rộng)
  body: { guild_id, default_channel_id?, allowed_role_ids? }
```

Validate module_key tồn tại trong MANIFESTS cho mọi endpoint.

Reuse middleware auth hiện có (xem `dashboard/routes/settings.js` để biết pattern).

## UI

**Tham chiếu mockup:** [mockup-modules-page.html](mockup-modules-page.html)

Page `modules.html`:
- Header tương đồng các trang khác
- Stats row 3 thẻ (tổng module / đang bật / tổng commands)
- Grid 2 cột cards: icon + tên + key + badge + switch + mô tả + chip commands
- Click card → mở modal chi tiết 5 tab (Stats / Commands / Top users / Activity / Settings)
- Switch trên card có `@click.stop` để không mở modal khi toggle

`modules.js`:
- `fetch('/api/modules?guild_id=...')` lúc load → render grid
- Click card → `fetch('/api/modules/:key/detail?guild_id=...')` → render modal
- Switch event → POST toggle, optimistic update + toast
- Tab switch trong modal: local state, không fetch lại

Cần lấy `guild_id` từ URL/localStorage giống các page khác (check pattern ở `dashboard/public/js/app.js`).

## Detail panel — 5 tabs

| Tab | Data source |
|---|---|
| Stats | `getModuleStats` (7d window) + manifest `defaultEnabled` |
| Commands | `getModuleCommandStats` join manifest descriptions |
| Top users | `getModuleTopUsers` (limit 5, 7d window) |
| Activity | `getModuleActivity` (limit 10, format icon theo result) |
| Settings | Toggle + `default_channel_id` + `allowed_role_ids` (cần bảng `guild_module_config` mở rộng — out of pilot scope, để placeholder UI) |

## Steps
1. Tạo `dashboard/routes/modules.js`, viết `loadManifests()` + 2 endpoint
2. Mount route trong `dashboard/server.js`: `app.use('/api/modules', require('./routes/modules'))`
3. Tạo `modules.html` (copy layout từ 1 page hiện có như rewards.html)
4. Tạo `modules.js` với fetch + render + toggle
5. Thêm nav link "Modules" ở sidebar
6. Manual test: enable mini-game → bot gate cho qua

## Todo
- [ ] `routes/modules.js` với `loadManifests` + GET list + POST toggle
- [ ] Endpoint `GET /api/modules/:key/detail` gộp 4 helper getModule*
- [ ] Mount ở `server.js`
- [ ] `modules.html` layout (sidebar + header + stats row + grid + modal)
- [ ] `js/modules.js` Alpine data: list fetch + toggle + open detail modal + tab switch
- [ ] Thêm nav link "Modules" ở sidebar (index.html)
- [ ] Test enable/disable mini-game qua UI
- [ ] Test detail modal: stats hiển thị đúng sau khi chơi vài trận mini-game

## Risks
- Bot process đã load module nhưng admin tắt qua dashboard → cần persist ngay vào DB (đã làm) + bot check DB mỗi lần execute (đã làm ở Phase 03). KHÔNG cần restart bot. ✅
- 2 process share `database.sqlite` qua WAL → an toàn (already used cho settings).
- Path `../../bot/src/modules` cứng — không vấn đề vì monorepo workspaces.

## Success criteria
- Page `/modules.html?guild_id=<id>` hiện list module với state đúng
- Toggle on/off persist vào `guild_modules` và có hiệu lực ngay ở bot (không restart)
- Module mới thêm vào filesystem → reload dashboard process → tự hiện
