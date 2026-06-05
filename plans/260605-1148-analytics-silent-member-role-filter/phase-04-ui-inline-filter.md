# Phase 04 — UI Inline Filter Card

**Status:** pending
**Priority:** medium
**Effort:** M
**Depends on:** Phase 03

## Goal

Thêm 2 dropdown role filter inline trên card "Member chưa chat lần nào" + nút Lưu (auto re-scan) + nút Bỏ filter.

## Files

**Modify:**
- `dashboard/public/index.html` (markup card)
- `dashboard/public/js/app.js` (Alpine state + methods)

## Steps

### app.js — state mới (analyticsSection, gần line 778)

```js
silentFilter: { include: '', exclude: '' },
guildRoles: [],
loadingFilterSave: false,
```

### app.js — load config + roles

Trong init/mount của analyticsSection (cùng chỗ gọi `loadSilent` ban đầu), thêm:
```js
async loadSilentFilterConfig() {
  try {
    const [cfg, roles] = await Promise.all([
      api('GET', '/analytics/silent-filter-config'),
      api('GET', '/analytics/guild-roles'),
    ])
    this.silentFilter.include = cfg?.include_role_id || ''
    this.silentFilter.exclude = cfg?.exclude_role_id || ''
    this.guildRoles = roles || []
  } catch (err) {
    console.error('[Analytics] loadSilentFilterConfig:', err)
  }
},
```
Gọi nó cùng lúc với `loadSilent` lần đầu vào tab analytics.

### app.js — save + re-scan

```js
async saveSilentFilter() {
  this.loadingFilterSave = true
  this.loadingSilent = true
  try {
    const res = await api('PUT', '/analytics/silent-filter-config', {
      include_role_id: this.silentFilter.include || null,
      exclude_role_id: this.silentFilter.exclude || null,
    })
    if (res?.warnings?.length) this.showToastTmp(res.warnings.join('\n'), 'amber')
    const data = await api('GET', '/analytics/silent-members?limit=500')
    this.silentMembers = data?.members || []
    this.silentTotal = data?.total || 0
    this.silentScannedAt = data?.scanned_at || null
  } catch (err) {
    this.showToastTmp(err.message, 'red')
  }
  this.loadingFilterSave = false
  this.loadingSilent = false
},

clearSilentFilter() {
  this.silentFilter.include = ''
  this.silentFilter.exclude = ''
  this.saveSilentFilter()
},
```

### index.html — markup card (chèn sau line 946, trước line 947 badge total)

```html
<!-- Role filter row -->
<div class="mb-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
  <div class="text-xs font-semibold text-slate-600 mb-2">Lọc theo role</div>
  <div class="flex flex-col md:flex-row gap-2">
    <select x-model="silentFilter.include" class="input-field flex-1 text-xs md:text-sm">
      <option value="">— Bất kỳ —</option>
      <template x-for="r in guildRoles" :key="r.id">
        <option :value="r.id" x-text="'Phải có: ' + r.name"></option>
      </template>
    </select>
    <select x-model="silentFilter.exclude" class="input-field flex-1 text-xs md:text-sm">
      <option value="">— Không loại trừ —</option>
      <template x-for="r in guildRoles" :key="r.id">
        <option :value="r.id" x-text="'Không có: ' + r.name"></option>
      </template>
    </select>
    <button @click="saveSilentFilter()" :disabled="loadingFilterSave || loadingSilent" class="btn-primary text-xs md:text-sm">
      <span x-text="loadingFilterSave ? 'Đang lưu...' : 'Lưu & quét lại'"></span>
    </button>
    <button @click="clearSilentFilter()" :disabled="loadingFilterSave || loadingSilent"
            x-show="silentFilter.include || silentFilter.exclude"
            class="btn-refresh text-xs md:text-sm">
      Bỏ filter
    </button>
  </div>
</div>
```

(Dùng class `.input-field`, `.btn-primary`, `.btn-refresh` theo dashboard-layout skill — đã có sẵn.)

## Checklist

- [ ] Vào tab Analytics → 2 dropdown load đủ roles guild
- [ ] Config persist hiển thị đúng selected khi reload trang
- [ ] Chọn role + Save → list re-scan, update đúng
- [ ] Bỏ filter → list về full
- [ ] Save button disable trong khi scan
- [ ] Warnings hiển thị khi role không tồn tại

## Risks

- `alert()` cho warning có thể annoying — chấp nhận (analytics section chưa có toast component).
- Số lượng role nhiều → dropdown dài. Roles thường < 50 → ok.
