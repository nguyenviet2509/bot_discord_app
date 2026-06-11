# Phase 02 — Tab Skeleton & Groups CRUD

**Status:** pending
**Priority:** high
**Effort:** ~2h
**Depends on:** Phase 01

## Context
- Theo `.claude/rules/dashboard-ui.md` → MUST load skill `dashboard-layout` trước khi sửa
- Theo `.claude/rules/i18n.md` → tiếng Việt có dấu
- Existing tab pattern: [dashboard/public/index.html](../../dashboard/public/index.html), [dashboard/public/js/app.js](../../dashboard/public/js/app.js)
- Similar Alpine component: [dashboard/public/js/automod.js](../../dashboard/public/js/automod.js)

## Files
- **Edit:** `dashboard/public/index.html` — thêm nav-item sidebar + section tab
- **Create:** `dashboard/public/js/events.js` — Alpine component `eventsTab()`
- **Create (optional standalone):** `dashboard/public/events.html`

## Tab structure (trong `index.html`)
```html
<a class="nav-item" data-tab="events">Quản lý Events</a>
...
<section x-show="activeTab==='events'" x-data="eventsTab()" x-init="init()">
  <!-- Sticky header với title + nút [+ Tạo group] [+ Tạo event] -->
  <!-- Content: list group, mỗi group có header + slot events -->
</section>
```

## Alpine component skeleton (`events.js`)
```js
function eventsTab() {
  return {
    guildId: null,
    groups: [],          // [{id, name, sort_order, event_count, expanded, events, page, total}]
    loading: false,
    showCreateGroup: false,
    newGroupName: '',

    async init() {
      this.guildId = window.currentGuildId  // theo pattern existing
      await this.loadGroups()
    },

    async loadGroups() {
      const res = await api(`/api/events/groups?guild_id=${this.guildId}`)
      this.groups = res.map(g => ({ ...g, expanded: true, events: [], page: 1, total: 0 }))
      // sentinel "Chưa phân nhóm"
      this.groups.push({ id: null, name: 'Chưa phân nhóm', sort_order: 9999, expanded: true, events: [], page: 1, total: 0 })
    },

    async createGroup() { /* POST + reload */ },
    async renameGroup(g, name) { /* PATCH */ },
    async deleteGroup(g) {
      if (!confirm(`Xóa nhóm "${g.name}"? Events bên trong sẽ chuyển sang "Chưa phân nhóm".`)) return
      /* DELETE + reload */
    },
    async reorderGroups(orderedIds) { /* PATCH /groups/reorder */ },
  }
}
```

## UI requirements
- Group header: drag-handle icon ⋮⋮, tên group, badge count, nút rename/delete
- "Chưa phân nhóm" group: KHÔNG có nút delete, KHÔNG draggable (`filter` SortableJS)
- Toàn bộ class style theo `dashboard-layout` skill (`.card`, `.btn-primary`, `.btn-refresh`...)

## SortableJS load
Thêm vào `<head>` của `index.html`:
```html
<script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js"></script>
```

## Reorder groups (chỉ phần group level — events ở phase 04)
```js
new Sortable(this.$refs.groupList, {
  handle: '.group-drag-handle',
  filter: '.no-drag',  // chặn "Chưa phân nhóm"
  animation: 150,
  onEnd: async (evt) => {
    const orderedIds = [...evt.to.children]
      .map(el => parseInt(el.dataset.groupId))
      .filter(id => !isNaN(id))
    await this.reorderGroups(orderedIds)
  }
})
```

## Todo
- [ ] Load skill `dashboard-layout` trước
- [ ] Thêm nav-item + section vào `index.html`
- [ ] Include SortableJS CDN
- [ ] Tạo `events.js` với Alpine component + loadGroups/CRUD group
- [ ] Init SortableJS cho group list
- [ ] Test: tạo/đổi tên/xóa/kéo thả group OK

## Success Criteria
- Tab xuất hiện sidebar, click sang được
- Tạo group → reload list thấy
- Đổi tên/xóa group OK với confirm
- Kéo thả group → sort_order persist sau F5
- "Chưa phân nhóm" luôn ở cuối, không drag, không xóa

## Risks
- Style inconsistency nếu skip skill `dashboard-layout` → MUST load
- Z-index conflict giữa SortableJS ghost và sticky header
