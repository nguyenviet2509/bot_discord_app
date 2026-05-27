# Phase 02 — Frontend: Nút "Khởi động lại tất cả"

## Overview
- Priority: High
- Status: pending
- Depends on Phase 01 endpoint `POST /managed-bots/restart-all`.

## Files
**Modify:**
- `dashboard/public/js/app.js`
- `dashboard/public/index.html`

## Implementation Steps

### 1. `dashboard/public/js/app.js` — thêm method `restartAll()` trong `managedBotsSection`

Sau method `remove(bot)` (~line 1897), trước `handleFile(e)`:
```js
async restartAll() {
  if (!confirm('Khởi động lại tất cả bot đang bật? Có thể mất vài giây mỗi bot.')) return
  this.loading = true
  try {
    const r = await api('POST', '/managed-bots/restart-all')
    if (r?.error) {
      this.flash(r.error, false)
    } else {
      const ok = r.failed === 0
      this.flash(`Đã khởi động lại ${r.restarted}/${r.total} bot${r.failed ? ` (${r.failed} lỗi)` : ''}`, ok)
    }
    await this.load()
  } catch (e) {
    this.flash('Khởi động lại thất bại: ' + (e?.message || 'lỗi'), false)
  } finally {
    this.loading = false
  }
},
```

### 2. `dashboard/public/index.html` — thêm nút trong header tab Quản lý Bot

Tại [index.html:2146-2154](../../dashboard/public/index.html#L2146-L2154), chèn nút mới giữa "Làm mới" và "+ Thêm bot":
```html
<button @click="restartAll()" :disabled="loading || bots.length === 0" class="btn-refresh" title="Khởi động lại tất cả bot đang bật">
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
  <span>Khởi động lại tất cả</span>
</button>
```

Đặt SAU nút "Làm mới" và TRƯỚC nút "+ Thêm bot" trong cùng `flex items-center gap-3`.

## Todo
- [ ] Thêm method `restartAll()` trong [app.js](../../dashboard/public/js/app.js) section `managedBotsSection`
- [ ] Thêm nút trong header tab Quản lý Bot ở [index.html](../../dashboard/public/index.html)
- [ ] Test: bấm nút khi không có bot → disabled
- [ ] Test: bấm nút khi có bot → confirm dialog → toast báo N/M

## Success Criteria
- Nút hiển thị bên cạnh "Làm mới", style nhất quán (`btn-refresh`).
- Disable khi `loading` hoặc list rỗng.
- Confirm trước khi gọi API.
- Toast báo kết quả đúng format `"Đã khởi động lại X/Y bot (Z lỗi)"`.
- Sau khi gọi xong tự `load()` để refresh status realtime.

## Risks
- User spam nút → đã chặn bằng `:disabled="loading"`.
- Nếu Phase 01 chưa deploy → endpoint 404 → catch block báo "Khởi động lại thất bại".

## Dashboard UI compliance
Tuân thủ `.claude/rules/dashboard-ui.md` + skill `dashboard-layout`: dùng class `btn-refresh` có sẵn cho consistency với "Làm mới".
