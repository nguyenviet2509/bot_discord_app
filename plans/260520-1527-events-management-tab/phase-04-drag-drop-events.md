# Phase 04 — Drag-Drop Events (Cross-Group + Reorder)

**Status:** pending
**Priority:** medium
**Effort:** ~2h
**Depends on:** Phase 03

## Goal
SortableJS cho event list trong từng group, chung namespace để kéo cross-group + reorder trong cùng group.

## Files
- **Edit:** `dashboard/public/js/events.js`

## Implementation

### Init SortableJS sau khi render group list
Dùng `$nextTick` để chờ Alpine render xong DOM rồi mới attach Sortable:
```js
async loadAllGroupEvents() {
  await Promise.all(this.groups.map(g => this.loadEventsForGroup(g, 1)))
  this.$nextTick(() => this.initEventSortables())
},

initEventSortables() {
  // destroy instances cũ nếu có (re-init sau reload)
  this._eventSortables?.forEach(s => s.destroy())
  this._eventSortables = []
  this.groups.forEach(group => {
    const el = document.querySelector(`[data-event-list="${group.id ?? 'null'}"]`)
    if (!el) return
    const s = new Sortable(el, {
      group: 'events',        // chung namespace → cross-group
      animation: 150,
      delay: 150,             // mobile touch
      delayOnTouchOnly: true,
      onEnd: (evt) => this.onEventDrop(evt)
    })
    this._eventSortables.push(s)
  })
},

async onEventDrop(evt) {
  const toEl = evt.to
  const targetGroupId = toEl.dataset.eventList === 'null' ? null : parseInt(toEl.dataset.eventList)
  const fromGroupId = evt.from.dataset.eventList === 'null' ? null : parseInt(evt.from.dataset.eventList)

  // Build updates payload: snapshot toàn bộ children của to (và from nếu khác)
  const updates = []
  const collect = (listEl, groupId) => {
    [...listEl.children].forEach((node, idx) => {
      const id = parseInt(node.dataset.eventId)
      if (!isNaN(id)) updates.push({ id, group_id: groupId, sort_order: idx })
    })
  }
  collect(toEl, targetGroupId)
  if (fromGroupId !== targetGroupId) collect(evt.from, fromGroupId)

  await api('/api/events/reorder', {
    method: 'PATCH',
    body: { guild_id: this.guildId, updates }
  })

  // Refetch 2 group đó để đồng bộ pagination total + UI ổn định
  const toGroup = this.groups.find(g => (g.id ?? null) === targetGroupId)
  const fromGroup = this.groups.find(g => (g.id ?? null) === fromGroupId)
  await this.loadEventsForGroup(toGroup, 1)
  if (fromGroup !== toGroup) await this.loadEventsForGroup(fromGroup, fromGroup.page)
  this.$nextTick(() => this.initEventSortables())
},
```

### HTML structure
```html
<div class="event-list" :data-event-list="group.id ?? 'null'">
  <template x-for="ev in group.events" :key="ev.id">
    <div class="event-card" :data-event-id="ev.id">
      <!-- card content -->
    </div>
  </template>
</div>
```

## Edge cases
- Kéo event sang page 1 của group khác → reset page về 1 ở group đích (đã xử lý ở refetch)
- Kéo trong cùng group page=2 → group target = source, giữ page=2 sau refetch (cẩn thận: nếu sort_order đảo có thể event drag biến mất khỏi page 2 — chấp nhận, UX đủ ổn)
- Disable drag khi group đang loading (`pointer-events: none` qua class)

## Todo
- [ ] Add `_eventSortables` array + destroy cũ trước init
- [ ] Wire `onEnd` → build updates → PATCH `/api/events/reorder`
- [ ] Refetch 2 group sau drop
- [ ] Test cross-group drag
- [ ] Test reorder cùng group
- [ ] Test mobile touch (delay 150ms)

## Success Criteria
- Kéo event A từ Group X → Group Y: cập nhật `group_id`, sort_order reseq cả 2 group
- Reorder trong cùng group: sort_order persist sau F5
- Không bị flicker / duplicate khi refetch
- Mobile drag không xung đột scroll

## Risks
- Race condition khi user drag liên tục → cần disable drag tạm thời trong khi PATCH (set `this.dragging = true`, Sortable `disabled` option)
- Sortable re-init mỗi lần load có thể leak listener nếu không destroy → đã xử lý

## Post-completion
- Cập nhật `docs/codebase-summary.md` nếu có (mention tab Events)
- Test end-to-end với 3 group × 25 event mỗi group
