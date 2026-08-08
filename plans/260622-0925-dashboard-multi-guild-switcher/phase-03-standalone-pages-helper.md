---
phase: 3
name: Standalone HTML Pages Shared Helper
status: pending
priority: high
effort: S
---

# Phase 3: Standalone Pages Helper

## Overview
6 standalone HTML pages (`automod.html`, `events.html`, `honor-config.html`, `roll-history.html`, `worldcup.html`, `levelup-preview.html`) không share `app.js`. Cần shared helper inject vào mỗi page.

## Files

### Create
- `dashboard/public/js/guild-context.js` — shared helper

### Modify (6 pages)
- `dashboard/public/automod.html`
- `dashboard/public/events.html`
- `dashboard/public/honor-config.html`
- `dashboard/public/roll-history.html`
- `dashboard/public/worldcup.html`
- `dashboard/public/levelup-preview.html`

## Implementation

### Step 1: Helper `guild-context.js`
```js
// Shared helper cho standalone pages — KHÔNG depend app.js
;(function() {
  const token = localStorage.getItem('token')
  const guildId = localStorage.getItem('guildId') || ''

  if (!token) { window.location.href = '/login.html'; return }

  if (!guildId) {
    // Standalone page mở trực tiếp mà SPA chưa set guildId → fetch guild đầu
    fetch('/api/servers', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(guilds => {
        if (guilds && guilds.length) {
          localStorage.setItem('guildId', guilds[0].id)
          window.location.reload()
        }
      })
    return
  }

  // Wrapper: append guildId vào /api/... (trừ skip list)
  async function apiFetch(url, opts = {}) {
    const skip = /^\/api\/(auth|servers|license|admin)\b/.test(url)
    if (!skip) {
      const sep = url.includes('?') ? '&' : '?'
      url = `${url}${sep}guildId=${guildId}`
    }
    const headers = { ...(opts.headers || {}), Authorization: `Bearer ${token}` }
    const res = await fetch(url, { ...opts, headers })
    if (res.status === 401) { window.location.href = '/login.html'; throw new Error('401') }
    return res
  }

  // Hiển thị guild đang xem (nếu page có element #current-guild)
  const display = document.getElementById('current-guild')
  if (display) display.textContent = `Guild: ${guildId}`

  window.apiFetch = apiFetch
  window.GUILD_ID = guildId
  window.TOKEN = token
})()
```

### Step 2: Inject vào 6 HTML
Thêm vào `<head>` của mỗi page (TRƯỚC script khác):
```html
<script src="/js/guild-context.js"></script>
```

### Step 3: Refactor script trong từng page
- Thay mọi `fetch('/api/...` → `apiFetch('/api/...`
- Xóa duplicate code đọc localStorage / token / auth header (helper lo)

### Step 4: Verify
- Mở `automod.html` trực tiếp → page load đúng data của `localStorage.guildId`
- Clear localStorage → mở `automod.html` → auto fetch guild đầu rồi reload
- Switch guild trong SPA → mở `automod.html` mới → data đổi theo

## Todo
- [ ] Tạo `dashboard/public/js/guild-context.js`
- [ ] Inject `<script>` vào 6 HTML pages
- [ ] Refactor mỗi page dùng `apiFetch`
- [ ] Test mở trực tiếp từng standalone page
- [ ] Commit Phase 3

## Success Criteria
- 6 standalone pages hoạt động với guild active từ localStorage
- Không có hardcode env GUILD_ID
- Standalone page tự fallback khi localStorage rỗng

## Risks
- Page có inline `<script>` lấy token/guild trùng helper → conflict
- `worldcup.html` có thể có guildless mode (public) → audit kỹ
