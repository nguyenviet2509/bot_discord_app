# Phase 05 — Dashboard UI

## Overview

- **Priority:** High
- **Status:** not-started
- **Depends on:** Phase 04 (Dashboard API must be running)
- **Description:** Single-page admin dashboard with Alpine.js + Tailwind CSS (CDN). No build step needed. Covers login, rewards management, members overview, and settings.

## Stack

- **Alpine.js** (CDN) — reactive UI without build tooling
- **Tailwind CSS** (CDN play.tailwindcss.com) — utility-first styling
- **No React/Vue/bundler** — KISS principle, zero build complexity
- Served statically by Express from `dashboard/public/`

## Pages / Routes (SPA via hash routing)

```
#/login     — Login form
#/rewards   — Rewards manager (default after login)
#/members   — Members table
#/settings  — Bot settings
```

## UI Wireframes

### Login Page (`login.html`)
```
┌─────────────────────────────────┐
│         🤖 Level Bot            │
│         Admin Dashboard         │
│                                 │
│  Username: [____________]       │
│  Password: [____________]       │
│            [  Login  ]          │
│                                 │
│  (error message if invalid)     │
└─────────────────────────────────┘
```

### Rewards Page (`#/rewards` in `index.html`)
```
┌──────────────────────────────────────────────────────┐
│  REWARDS          [+ Add Reward]                     │
│  ─────────────────────────────────────────────────   │
│  Level  Type   Role/Badge          Actions           │
│  1      role   🟤 Đồng             [Edit] [Delete]   │
│  3      role   ⚪ Bạc              [Edit] [Delete]   │
│  5      role   🟡 Vàng             [Edit] [Delete]   │
│  2      badge  🏅 Newbie Badge     [Edit] [Delete]   │
│                                                      │
│  ─── Add / Edit Reward Modal ───                     │
│  Level Required: [__]                                │
│  Type: ( ) Role  ( ) Badge                           │
│  Role: [dropdown from Discord roles]                 │
│  Badge: [Upload image] [Name field]                  │
│  [Cancel] [Save]                                     │
└──────────────────────────────────────────────────────┘
```

### Members Page (`#/members`)
```
┌──────────────────────────────────────────────────────┐
│  MEMBERS          [Search: ____________]             │
│  ─────────────────────────────────────────────────   │
│  #   Username          Level  XP       Last Active   │
│  1   @Alice            12     2100     2h ago        │
│  2   @Bob              10     1650     5h ago        │
│  ...                                  [Reset XP]     │
└──────────────────────────────────────────────────────┘
```

### Settings Page (`#/settings`)
```
┌──────────────────────────────────────────────────────┐
│  SETTINGS                                            │
│  ─────────────────────────────────────────────────   │
│  XP per message:  Min [15]  Max [25]                 │
│  Cooldown:        [60] seconds                       │
│  Level-up channel: [channel-id input]                │
│                                                      │
│  [Save Settings]                                     │
└──────────────────────────────────────────────────────┘
```

## Architecture

```
dashboard/public/
├── login.html          — Standalone login page
├── index.html          — SPA shell (nav + router via Alpine + hash)
└── js/
    └── app.js          — Alpine.js data store + API helpers
```

## Implementation Steps

1. **`dashboard/public/login.html`**:
   - Minimal centered card layout
   - Alpine.js `x-data` with `{ username, password, error, loading }`
   - On submit: `POST /api/auth/login` → store JWT in `localStorage.setItem('token', ...)`
   - On success: `window.location = '/index.html'`
   - On error: show error message

2. **`dashboard/public/js/app.js`**:
   - Global Alpine store: `Alpine.store('auth', { token, logout() })`
   - `api(method, path, body, file)` helper — auto-attach `Authorization: Bearer` header
   - On load: check `localStorage.getItem('token')`, if missing → redirect to login
   - Hash router: `window.addEventListener('hashchange', ...)` → render correct section

3. **`dashboard/public/index.html`**:
   - Sidebar nav: Rewards / Members / Settings / Logout
   - Main content area with 3 sections shown/hidden via Alpine `x-show`
   - Each section is an Alpine component with own `x-data`

4. **Rewards section**:
   - On mount: `GET /api/rewards` + `GET /api/discord/roles` (for dropdown)
   - Render table of rewards
   - Add/Edit modal with form:
     - Type radio: role vs badge
     - Role: `<select>` populated from Discord roles API
     - Badge: `<input type="file">` → `POST /api/rewards/upload` first, then save URL
   - Delete: confirmation inline → `DELETE /api/rewards/:id`

5. **Members section**:
   - On mount: `GET /api/members`
   - Client-side search filter (Alpine `x-data` with `search` variable)
   - Reset XP button → `DELETE /api/members/:id/xp` → confirm dialog
   - Relative time display: `last_message_at` → "X hours ago"

6. **Settings section**:
   - On mount: `GET /api/settings`
   - Form with Alpine bindings
   - `PUT /api/settings` on save
   - Success/error toast notification

## Design Tokens

```
Color scheme (dark sidebar, light main):
- Sidebar bg: #1e293b (slate-800)
- Sidebar text: #94a3b8 (slate-400)
- Active nav: #3b82f6 (blue-500)
- Main bg: #f8fafc (slate-50)
- Card bg: white
- Accent: #6366f1 (indigo-500) for buttons
```

## Todo

- [ ] login.html — auth form
- [ ] public/js/app.js — api helper, Alpine store, hash router
- [ ] index.html — SPA shell with nav
- [ ] Rewards section — table + add/edit modal + badge upload
- [ ] Members section — table + search + reset XP
- [ ] Settings section — form + save

## Success Criteria

- Login with wrong credentials shows error (no redirect)
- Login with correct credentials redirects to dashboard
- Can add a role reward — appears in table immediately
- Can upload badge image — preview shown in modal
- Can delete reward — removed from table
- Can reset member XP — XP shows 0 in table after
- Settings save persists after page refresh
- Unauthenticated access to index.html redirects to login.html
