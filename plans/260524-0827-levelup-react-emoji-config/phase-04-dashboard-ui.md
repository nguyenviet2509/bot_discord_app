# Phase 04 — Dashboard UI

## Goal
UI cho admin chỉnh emoji react per-tier + chance %.

## Files
- `dashboard/public/index.html` — thêm section trong tab "Tin nhắn Level Up".
- `dashboard/public/js/levelup-template.js` (hoặc file Alpine handler của tab) — load/save.

## Prerequisite
**BẮT BUỘC** load skill `dashboard-layout` trước khi viết HTML — dùng `.card`, `.input-field`, `.btn-primary`, color palette indigo/slate.

## Steps

### 1. Tìm tab "Tin nhắn Level Up" trong `index.html`
Search keyword: `level-up` hoặc `Tin nhắn Level Up`. Section mới đặt cuối tab (sau preview).

### 2. HTML section
```html
<div class="card mt-6" x-data="levelReactConfig">
  <h3 class="text-lg font-semibold text-slate-100">Auto-react khi level-up</h3>
  <p class="text-sm text-slate-400 mt-1">
    Bot tự thả emoji vào tin nhắn cuối của user khi họ lên level (chỉ khi level ≥ 10).
    Để trống emoji của 1 tier để tắt react cho tier đó.
  </p>

  <!-- Chance slider -->
  <div class="mt-4">
    <label class="block text-sm text-slate-300 mb-2">
      Tần suất react: <span class="text-indigo-400 font-semibold" x-text="chancePct + '%'"></span>
      <span x-show="chancePct > 30" class="text-amber-400 text-xs ml-2">⚠ Cao — có thể gây spam</span>
    </label>
    <input type="range" min="0" max="100" step="1" x-model.number="chancePct"
           class="w-full accent-indigo-500" />
  </div>

  <!-- Per-tier inputs -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
    <template x-for="t in tiers" :key="t.min">
      <div class="flex items-center gap-3">
        <span class="w-28 text-sm text-slate-300" x-text="t.name + ' (Lv ' + t.min + '+)'"></span>
        <input type="text" :placeholder="t.defaultBadge" x-model="t.emoji"
               class="input-field flex-1" maxlength="100" />
      </div>
    </template>
  </div>

  <div class="mt-4 flex gap-2">
    <button @click="save()" class="btn-primary" :disabled="saving" x-text="saving ? 'Đang lưu...' : 'Lưu cấu hình'"></button>
    <span x-show="saved" class="text-emerald-400 text-sm self-center">✓ Đã lưu</span>
  </div>
</div>
```

### 3. Alpine handler `levelReactConfig`
Thêm vào file JS của tab (hoặc inline script trước `index.html` đóng):
```js
document.addEventListener('alpine:init', () => {
  Alpine.data('levelReactConfig', () => ({
    chancePct: 8,
    saving: false,
    saved: false,
    tiers: [
      { min: 10,  name: 'Sắt',        defaultBadge: '⚫', emoji: '' },
      { min: 20,  name: 'Đồng',       defaultBadge: '🟤', emoji: '' },
      { min: 30,  name: 'Bạc',        defaultBadge: '⚪', emoji: '' },
      { min: 40,  name: 'Vàng',       defaultBadge: '🟡', emoji: '' },
      { min: 50,  name: 'Bạch Kim',   defaultBadge: '🩵', emoji: '' },
      { min: 60,  name: 'Lục Bảo',    defaultBadge: '🟢', emoji: '' },
      { min: 70,  name: 'Kim Cương',  defaultBadge: '🔵', emoji: '' },
      { min: 80,  name: 'Cao Thủ',    defaultBadge: '🟣', emoji: '' },
      { min: 90,  name: 'Đại Cao Thủ',defaultBadge: '🟠', emoji: '' },
      { min: 100, name: 'Thách Đấu',  defaultBadge: '🔴', emoji: '' },
    ],
    async init() {
      const guildId = window.currentGuildId // theo pattern các tab khác
      const r = await fetch(`/api/level-react?guildId=${guildId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      if (r.status === 401) { location.href = '/login.html'; return }
      const data = await r.json()
      this.chancePct = data.chancePct ?? 8
      for (const t of this.tiers) {
        const found = data.perTier.find(x => x.tier_min_level === t.min)
        t.emoji = found?.react_emoji ?? ''
      }
    },
    async save() {
      this.saving = true; this.saved = false
      const body = {
        guildId: window.currentGuildId,
        chancePct: this.chancePct,
        perTier: this.tiers.map(t => ({
          tier_min_level: t.min,
          react_emoji: t.emoji.trim() || null,
        })),
      }
      const r = await fetch('/api/level-react', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(body),
      })
      this.saving = false
      if (r.ok) { this.saved = true; setTimeout(() => this.saved = false, 2000) }
    },
  }))
})
```

### 4. Lưu ý
- `window.currentGuildId` / `localStorage.getItem('token')` — match pattern các tab khác (kiểm tra file `js/` hiện có).
- Mobile: grid `md:grid-cols-2` tự fallback 1 cột < 768px.

## Done when
- Mở dashboard → tab Level Up → thấy section "Auto-react khi level-up".
- Đổi emoji + slider → click Lưu → check DB cột đúng giá trị.
- Reload page → giá trị persist.
