# Phase 03 — Events CRUD & Pagination

**Status:** pending
**Priority:** high
**Effort:** ~3h
**Depends on:** Phase 02

## Goal
Form tạo/sửa event + render danh sách events trong từng group + phân trang per-group (10/page).

## Files
- **Edit:** `dashboard/public/index.html` — thêm modal form event, slot list events trong group
- **Edit:** `dashboard/public/js/events.js` — thêm logic events

## Event form fields
| Field | Type | Required | Note |
|---|---|---|---|
| name | text | Y | |
| description | textarea | N | |
| type | combobox (input+datalist) | Y | Built-in: `giveaway`, `raffle`, `trivia`. User nhập type mới → tự được suggest cho group đó các lần sau |
| status | toggle | N | default disabled |
| start_at | datetime-local | N | convert → unix seconds |
| end_at | datetime-local | N | validate end_at > start_at |
| group_id | select | N | "Chưa phân nhóm" + list groups hiện có |

## Type combobox (per-group custom types)

### Backend — thêm 1 endpoint vào `routes/events.js`
```
GET /api/events/types?guild_id&group_id  → ["giveaway","raffle","trivia","lottery",...]
```
SQL: `SELECT DISTINCT type FROM events WHERE guild_id=? AND (group_id IS ? OR group_id=?)` + merge với built-in constant.

### Frontend
```js
const BUILTIN_TYPES = ['giveaway', 'raffle', 'trivia']

async loadTypesForGroup(groupId) {
  const gidParam = groupId === null ? 'null' : groupId
  const res = await api(`/api/events/types?guild_id=${this.guildId}&group_id=${gidParam}`)
  // res already merged built-in + distinct; nếu backend chỉ trả custom thì merge tại đây
  return [...new Set([...BUILTIN_TYPES, ...res])]
}

async openCreate(groupId = null) {
  this.typeSuggestions = await this.loadTypesForGroup(groupId)
  // ...show modal
}
```

```html
<input list="event-type-options" x-model="eventForm.type" required />
<datalist id="event-type-options">
  <template x-for="t in typeSuggestions" :key="t">
    <option :value="t"></option>
  </template>
</datalist>
```

### Validation
- Frontend: `type.trim().length > 0`, max 30 chars, regex `/^[a-z0-9_-]+$/i` (tránh ký tự lạ)
- Backend: cùng rule, reject nếu fail

## Alpine extensions (`events.js`)
```js
// State thêm
showEventModal: false,
editingEvent: null,    // null = create, object = edit
eventForm: { name:'', description:'', type:'giveaway', status:0, start_at:null, end_at:null, group_id:null },

async loadEventsForGroup(group, page = 1) {
  const gidParam = group.id === null ? 'null' : group.id
  const res = await api(`/api/events?guild_id=${this.guildId}&group_id=${gidParam}&page=${page}&limit=10`)
  group.events = res.items
  group.total = res.total
  group.page = page
},

async loadAllGroupEvents() {
  await Promise.all(this.groups.map(g => this.loadEventsForGroup(g, 1)))
},

openCreate(groupId = null) { this.editingEvent = null; this.eventForm = { ...defaults, group_id: groupId }; this.showEventModal = true },
openEdit(ev) { this.editingEvent = ev; this.eventForm = { ...ev }; this.showEventModal = true },

async saveEvent() {
  // validate
  if (!this.eventForm.name.trim()) return alert('Tên event không được trống')
  if (this.eventForm.start_at && this.eventForm.end_at && this.eventForm.end_at <= this.eventForm.start_at) {
    return alert('Thời gian kết thúc phải sau thời gian bắt đầu')
  }
  const payload = { ...this.eventForm, guild_id: this.guildId }
  if (this.editingEvent) {
    await api(`/api/events/${this.editingEvent.id}`, { method:'PATCH', body: payload })
  } else {
    await api('/api/events', { method:'POST', body: payload })
  }
  this.showEventModal = false
  await this.loadAllGroupEvents()
},

async toggleStatus(ev) {
  await api(`/api/events/${ev.id}`, { method:'PATCH', body: { status: ev.status ? 0 : 1 } })
  ev.status = ev.status ? 0 : 1
},

async deleteEvent(ev) {
  if (!confirm(`Xóa event "${ev.name}"?`)) return
  await api(`/api/events/${ev.id}`, { method:'DELETE' })
  const group = this.groups.find(g => g.id === ev.group_id || (g.id === null && ev.group_id == null))
  await this.loadEventsForGroup(group, group.page)
},
```

## Pagination UI per group
```html
<div class="pagination" x-show="group.total > 10">
  <button @click="loadEventsForGroup(group, group.page-1)" :disabled="group.page<=1">◀</button>
  <span x-text="`${group.page} / ${Math.ceil(group.total/10)}`"></span>
  <button @click="loadEventsForGroup(group, group.page+1)"
          :disabled="group.page >= Math.ceil(group.total/10)">▶</button>
</div>
```

## Event card render
- Tên, badge type, badge status (xanh/xám), thời gian (nếu có) format `dd/MM/yyyy HH:mm`
- Hành động: [✏️ Sửa] [⏯️ Toggle] [🗑️ Xóa]

## Todo
- [ ] Modal form (Alpine `x-show` + backdrop)
- [ ] Load events sau khi loadGroups xong
- [ ] CRUD event với validate
- [ ] Toggle status inline
- [ ] Pagination buttons per group
- [ ] Format datetime hiển thị (tiếng Việt)
- [ ] Endpoint `GET /api/events/types?guild_id&group_id` (Phase 01 update — append)
- [ ] Combobox type với datalist (built-in + per-group distinct)
- [ ] Validate type regex `^[a-z0-9_-]+$`, max 30 chars

## Success Criteria
- Tạo event mới → hiện trong group đúng
- Sửa event giữ nguyên page hiện tại
- Toggle status cập nhật ngay không reload
- Xóa event refetch đúng group, giữ page (auto-back nếu page rỗng)
- Phân trang per-group độc lập, không reset khi thao tác group khác
- Validate end_at > start_at

## Risks
- Datetime timezone (server unix vs UI local) → dùng `new Date(unix*1000)` cho hiển thị, ngược lại khi gửi
- Pagination state lost khi reload all → chấp nhận, default page 1
