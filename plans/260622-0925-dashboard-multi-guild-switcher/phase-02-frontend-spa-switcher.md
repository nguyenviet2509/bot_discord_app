---
phase: 2
name: Frontend SPA Switcher + apiFetch Wrapper
status: pending
priority: high
effort: M
---

# Phase 2: SPA Frontend

## Overview
- Thêm dropdown switcher ở sidebar SPA
- `app.js`: `apiFetch` wrapper với `ensureGuildReady()` block race
- Clear `localStorage.guildId` khi logout
- Audit 8 SPA js files dùng `apiFetch`

## Files

### Modify
- `dashboard/public/index.html` — thêm `<select id="guild-switcher">`
- `dashboard/public/js/app.js` — state + init + wrapper + logout clear
- `dashboard/public/js/*.js` — audit chuyển fetch → apiFetch (SPA-only files)

## Implementation

### Step 1: HTML switcher
Trong `index.html`, đầu sidebar:
```html
<div class="px-4 py-3 border-b border-slate-200">
  <label class="text-xs text-slate-500 mb-1 block">Server</label>
  <select id="guild-switcher" class="input-field w-full text-sm" disabled>
    <option>Đang tải...</option>
  </select>
</div>
```
Theo skill `dashboard-layout`: dùng class `.input-field`.

### Step 2: `app.js` — state + init + wrapper
```js
const state = {
  currentGuildId: localStorage.getItem('guildId') || ''
}

let guildReadyPromise = null

function ensureGuildReady() {
  if (!guildReadyPromise) guildReadyPromise = initGuildSwitcher()
  return guildReadyPromise
}

async function initGuildSwitcher() {
  const sel = document.getElementById('guild-switcher')
  const res = await fetch('/api/servers', {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (res.status === 401) { window.location.href = '/login.html'; return }
  if (!res.ok) { sel.innerHTML = '<option>Lỗi tải</option>'; throw new Error('servers fetch fail') }

  const guilds = await res.json()
  if (!guilds.length) {
    sel.innerHTML = '<option>Bot chưa join guild</option>'
    return
  }

  // Validate state.currentGuildId thuộc list, không thì fallback guild đầu
  if (!state.currentGuildId || !guilds.find(g => g.id === state.currentGuildId)) {
    state.currentGuildId = guilds[0].id
    localStorage.setItem('guildId', state.currentGuildId)
  }

  sel.innerHTML = guilds.map(g =>
    `<option value="${g.id}" ${g.id === state.currentGuildId ? 'selected' : ''}>${g.name}</option>`
  ).join('')
  sel.disabled = false

  sel.addEventListener('change', (e) => {
    localStorage.setItem('guildId', e.target.value)
    window.location.reload()
  })
}

// CRITICAL: await ensureGuildReady để tránh race
async function apiFetch(url, opts = {}) {
  await ensureGuildReady()

  // Skip append cho cross-guild / public routes
  const skipGuild = /^\/api\/(auth|servers|license|admin)\b/.test(url)
  if (!skipGuild && state.currentGuildId) {
    const sep = url.includes('?') ? '&' : '?'
    url = `${url}${sep}guildId=${state.currentGuildId}`
  }
  const headers = { ...(opts.headers || {}), Authorization: `Bearer ${token}` }
  const res = await fetch(url, { ...opts, headers })
  if (res.status === 401) { window.location.href = '/login.html'; throw new Error('401') }
  return res
}

window.apiFetch = apiFetch

// Logout handler clear localStorage
function logout() {
  localStorage.removeItem('token')
  localStorage.removeItem('guildId')  // CLEAR — red-team L2
  window.location.href = '/login.html'
}
```

### Step 3: Init order
Đảm bảo `ensureGuildReady()` được gọi trước khi bất kỳ tab nào fetch.
```js
// Khi app boot:
document.addEventListener('DOMContentLoaded', async () => {
  await ensureGuildReady()
  // → render tabs, fetch data
})
```

Vì `apiFetch` đã có `await ensureGuildReady()` ở đầu, ngay cả khi tab fetch sớm cũng sẽ tự đợi → an toàn.

### Step 4: Audit 8 SPA js files
Files: `automod.js`, `events.js`, `honor-config.js`, `licenses.js`, `roll-history.js`, `voice-log.js`, `voice-stats.js`, `worldcup.js`.

Lưu ý: Một số file này có thể CHỈ dùng cho standalone HTML (Phase 3). Audit từng cái:
- Nếu chỉ dùng trong SPA index → đổi sang `apiFetch`
- Nếu cả 2 → có thể share helper `apiFetch` global

Pattern: `fetch('/api/...` → `apiFetch('/api/...`

### Step 5: Verify
- Open dashboard, dropdown hiện danh sách guild bot join
- Mở DevTools Network: mọi request `/api/...` có `?guildId=`
- Switch guild → reload → tab analytics đổi data
- F5 → giữ guild đã chọn
- Click logout → localStorage clear cả `token` và `guildId`

## Todo
- [ ] Thêm `<select id="guild-switcher">` vào `index.html`
- [ ] `app.js`: `state`, `ensureGuildReady`, `initGuildSwitcher`, `apiFetch`
- [ ] Logout handler clear `localStorage.guildId`
- [ ] Audit 8 SPA js files chuyển sang `apiFetch`
- [ ] Test switch/reload/logout
- [ ] Commit Phase 2

## Success Criteria
- Dropdown switcher hoạt động
- Mọi fetch SPA có `?guildId=` (trừ skip list)
- Race condition: tab fetch sớm vẫn đợi `ensureGuildReady`
- Logout clear localStorage

## Risks
- File js dùng `fetch` raw bỏ sót → grep `fetch\('/api` cuối phase
- Tab có XHR thay vì fetch → ít khả năng nhưng audit
