# Phase 02 — Module loader + manifest contract

## Overview
- Priority: must
- Status: ⏳ pending
- Estimate: S (~45-60 phút)
- Depends: Phase 01

Tạo cơ chế quét `bot/src/modules/<key>/` và nạp vào client. Không phá flow load command/event hiện tại.

## Files
- `bot/src/modules/_loader.js` (new)
- `bot/src/modules/.gitkeep` hoặc dummy README (optional)
- `bot/src/index.js` (modify — gọi loader sau khi load core commands/events)

## Manifest contract

`bot/src/modules/<key>/manifest.js`:
```js
module.exports = {
  key: 'mini-game',           // required, unique, kebab-case
  name: 'Mini Game',          // hiển thị UI
  description: '...',
  defaultEnabled: false,      // mới install, có bật mặc định không
  commands: ['guess-number','rps','odd-even'], // tên slash command thuộc module
}
```

`bot/src/modules/<key>/register.js` (optional):
```js
module.exports = function register(client, ctx) {
  // ctx: { manifest, modulePath }
  // Có thể đăng ký event listener riêng nếu cần
  // Commands tự load qua loader, không cần làm gì ở đây cho mini-game
}
```

## Loader contract

```js
// modules/_loader.js
function loadModules(client) {
  // 1. Scan modules/ → list folder có manifest.js
  // 2. Với mỗi folder:
  //    - require manifest, validate {key, name, commands}
  //    - check key trùng → throw
  //    - require commands/*.js, gắn cmd._module = manifest.key, set vào client.commands
  //    - kiểm tra trùng name với core commands → throw
  //    - require register.js nếu có → gọi register(client, { manifest })
  // 3. Lưu danh sách manifest vào client._modules = Map<key, manifest>
  // 4. Log: `[Modules] Loaded N modules: a, b, c`
}
```

## Modify `bot/src/index.js`

Sau block "Load events" (~line 38), thêm:
```js
const loadModules = require('./modules/_loader')
loadModules(client)
```

Auto-register slash commands hiện tại lặp qua `client.commands` → tự động bao gồm commands của module, không cần sửa gì thêm.

## Steps
1. Tạo folder `bot/src/modules/` + file `_loader.js`
2. Cài logic scan dir + validate manifest + load commands + duplicate check
3. Thêm 1 dòng require + call ở `bot/src/index.js`
4. Smoke test: chưa có module nào → loader log "Loaded 0 modules", bot boot bình thường

## Todo
- [ ] Tạo `bot/src/modules/_loader.js`
- [ ] Implement scan + manifest validation
- [ ] Implement command auto-load với gắn `_module` metadata
- [ ] Implement duplicate command name check
- [ ] Support optional `register.js`
- [ ] Modify `bot/src/index.js` gọi loader
- [ ] Smoke test boot bot

## Risks
- Module có command trùng name với core (vd: `rank`) → loader crash sớm, log rõ tên command + module. Tốt: phát hiện sớm.
- `manifest.commands` khai báo lệch với file thật trong `commands/` → loader warn (không throw).

## Success criteria
- Boot bot không lỗi khi chưa có module
- Sau Phase 04 (có `mini-game/`), log `[Modules] Loaded 1 module: mini-game`
- `client.commands` chứa cả core và module commands, mỗi cmd module có `_module === 'mini-game'`
