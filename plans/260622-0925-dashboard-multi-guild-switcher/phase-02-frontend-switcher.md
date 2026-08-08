---
phase: 2
name: Frontend Guild Switcher UI + apiFetch Wrapper
status: pending
priority: high
effort: M
---

# Phase 2: Frontend Switcher

## Overview
Thêm dropdown chọn guild ở sidebar, wrap mọi fetch để tự append `?guildId=`, lưu lựa chọn vào localStorage.

## Files

### Modify
- `dashboard/public/index.html` — thêm guild switcher UI ở sidebar (trên menu)
- `dashboard/public/js/app.js` — global state, apiFetch wrapper, init logic
- `dashboard/public/js/*.js` (audit từng file) — đảm bảo dùng apiFetch (nếu chưa thì refactor)

## Implementation

### Step 1: UI Switcher
Trong `index.html`, ngay sau header logo của sidebar, thêm:
```html
<div class="px-4 py-3 border-b border-slate-200">
  <label class="text-xs text-slate-500 mb-1 block">Server</label>
  <select id="guild-switcher" class="input-field w-full text-sm">
    <option value="">Đang tải...</option>
  </select>
</div>
```
Theo `dashboard-layout` skill rules: dùng `.input-field` class hiện có.

### Step 2: `app.js` — state + init
```js
// Đầu file, sau khi có token
const state = {
  currentGuildId: localStorage.getItem('guildId') || ''
}

async function initGuildSwitcher() {
  const sel = document.getElementById('guild-switcher')
  const res = await fetch('/api/servers', {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) {
    if (res.status === 401) { window.location.href = '/login.html'; return }
    sel.innerHTML = '<option>Lỗi tải</option>'
    return
  }
  const guilds = await res.json()
  if (!guilds.length) { sel.innerHTML = '<option>Bot chưa join guild</option>'; return }

  // Nếu state rỗng hoặc không thuộc list → chọn guild đầu
  if (!state.currentGuildId || !guilds.find(g => g.id === state.currentGuildId)) {
    state.currentGuildId = guilds[0].id
    localStorage.setItem('guildId', state.currentGuildId)
  }

  sel.innerHTML = guilds.map(g =>
    `<option value="${g.id}" ${g.id === state.currentGuildId ? 'selected' : ''}>${g.name}</option>`
  ).join('')

  sel.addEventListener('change', (e) => {
    localStorage.setItem('guildId', e.target.value)
    window.location.reload()
  })
}
```

### Step 3: `apiFetch` wrapper
```js
async function apiFetch(url, opts = {}) {
  // Append guildId vào mọi /api/... (trừ /api/auth, /api/servers, /api/license, /api/admin)
  const skipGuild = /^\/api\/(auth|servers|license|admin|managed-bots|commands)\b/.test(url)
  if (!skipGuild && state.currentGuildId) {
    const sep = url.includes('?') ? '&' : '?'
    url = `${url}${sep}guildId=${state.currentGuildId}`
  }
  const headers = { ...(opts.headers || {}), Authorization: `Bearer ${token}` }
  const res = await fetch(url, { ...opts, headers })
  if (res.status === 401) { window.location.href = '/login.html'; throw new Error('401') }
  return res
}
```
Expose `window.apiFetch = apiFetch` để các file js khác xài.

### Step 4: Init order
```js
// Sau khi token đã load
await initGuildSwitcher()
// → các tab init sau (gọi apiFetch)
```

### Step 5: Audit `dashboard/public/js/*.js`
Files: `automod.js`, `events.js`, `honor-config.js`, `licenses.js`, `roll-history.js`, `voice-log.js`, `voice-stats.js`, `worldcup.js`.

Cho mỗi file: tìm `fetch('/api/...` → thay bằng `apiFetch('/api/...`. Nếu file có helper riêng → cập nhật helper để gọi `apiFetch`.

Standalone HTML pages (`automod.html`, `events.html`, `honor-config.html`, `roll-history.html`, `worldcup.html`, `levelup-preview.html`): cũng phải đọc `localStorage.guildId` và xài apiFetch (hoặc inline helper nếu không share `app.js`).

## Todo
- [ ] Thêm `<select id="guild-switcher">` vào `index.html` sidebar
- [ ] `app.js`: state + `initGuildSwitcher()` + `apiFetch()` wrapper
- [ ] Expose `window.apiFetch`
- [ ] Audit/refactor 8 file `dashboard/public/js/*.js` dùng `apiFetch`
- [ ] Audit 6 standalone HTML pages
- [ ] Test thủ công: switch guild → page reload → tab khác đổi data
- [ ] Refresh → giữ guild đã chọn

## Success Criteria
- Dropdown hiện tên + icon (optional) các guild bot join
- Switch → reload → mọi tab đổi data
- LocalStorage persist
- 401 fallback redirect login vẫn work

## Risks
- File js gọi `fetch` trực tiếp không qua wrapper → audit kỹ
- Standalone HTML không share state với SPA index → cần inline guildId logic
- Race: guildSwitcher chưa init xong mà tab fetch đã bắn → đặt init **trước** các tab load
