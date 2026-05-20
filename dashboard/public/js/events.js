// Tab "Quan ly Events" — Alpine component + SortableJS drag-drop.
// Endpoints: /api/events, /api/events/groups, /api/events/types, /api/events/reorder

const PAGE_LIMIT = 10
const BUILTIN_TYPES = ['giveaway', 'raffle', 'trivia']

function getToken() { return localStorage.getItem('token') }

async function api(method, path, body) {
  const token = getToken()
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const r = await fetch(path, opts)
  if (r.status === 401) {
    localStorage.removeItem('token')
    try { window.top.location.href = '/login.html' } catch (_) { window.location.href = '/login.html' }
    throw new Error('Unauthorized')
  }
  if (!r.ok) {
    let err = `HTTP ${r.status}`
    try { err = (await r.json()).error || err } catch (_) {}
    throw new Error(err)
  }
  return r.json()
}

// unix sec → 'dd/MM/yyyy HH:mm'
function formatUnix(sec) {
  if (!sec) return ''
  const d = new Date(sec * 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// unix sec → 'YYYY-MM-DDTHH:mm' (datetime-local input)
function unixToInputStr(sec) {
  if (!sec) return ''
  const d = new Date(sec * 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 'YYYY-MM-DDTHH:mm' → unix sec (local time)
function inputStrToUnix(s) {
  if (!s) return null
  const ms = new Date(s).getTime()
  if (Number.isNaN(ms)) return null
  return Math.floor(ms / 1000)
}

function eventsTab() {
  return {
    loading: false,
    saving: false,
    groups: [],
    showEventModal: false,
    editingEvent: null,
    eventForm: emptyEventForm(),
    typeSuggestions: [...BUILTIN_TYPES],
    saveStatus: '',
    saveStatusClass: 'text-slate-400',
    _eventSortables: [],
    _groupSortable: null,

    async init() {
      await this.loadAll()
    },

    flash(text, ok = true) {
      this.saveStatus = text
      this.saveStatusClass = 'text-sm ' + (ok ? 'text-emerald-600' : 'text-red-600')
      setTimeout(() => { this.saveStatus = '' }, 2500)
    },

    formatTime(sec) { return formatUnix(sec) },

    async loadAll() {
      this.loading = true
      try {
        const rawGroups = await api('GET', '/api/events/groups')
        // Append "Chua phan nhom" sentinel
        this.groups = [
          ...rawGroups.map(g => ({ ...g, events: [], page: 1, total: 0, limit: PAGE_LIMIT })),
          { id: null, name: 'Chưa phân nhóm', sort_order: 9999, events: [], page: 1, total: 0, limit: PAGE_LIMIT, event_count: 0 },
        ]
        await Promise.all(this.groups.map(g => this.loadGroupEvents(g, 1)))
        this.$nextTick(() => {
          this.initGroupSortable()
          this.initEventSortables()
        })
      } catch (err) {
        this.flash('Lỗi tải: ' + err.message, false)
      } finally {
        this.loading = false
      }
    },

    async loadGroupEvents(group, page = 1) {
      const gidParam = group.id === null ? 'null' : group.id
      const res = await api('GET', `/api/events?group_id=${gidParam}&page=${page}&limit=${PAGE_LIMIT}`)
      group.events = res.items
      group.total = res.total
      group.page = res.page
      group.limit = res.limit
    },

    async changePage(group, page) {
      const maxPage = Math.max(1, Math.ceil(group.total / group.limit))
      const target = Math.max(1, Math.min(maxPage, page))
      if (target === group.page) return
      try {
        await this.loadGroupEvents(group, target)
        this.$nextTick(() => this.initEventSortables())
      } catch (err) {
        this.flash('Lỗi chuyển trang: ' + err.message, false)
      }
    },

    // ---- Groups CRUD ----

    async openCreateGroup() {
      const name = prompt('Tên nhóm mới:')
      if (!name || !name.trim()) return
      try {
        await api('POST', '/api/events/groups', { name: name.trim() })
        await this.loadAll()
        this.flash('Đã tạo nhóm')
      } catch (err) {
        this.flash('Lỗi tạo nhóm: ' + err.message, false)
      }
    },

    async renameGroup(group) {
      const name = prompt('Tên mới:', group.name)
      if (!name || !name.trim() || name.trim() === group.name) return
      try {
        await api('PUT', `/api/events/groups/${group.id}`, { name: name.trim() })
        group.name = name.trim()
        this.flash('Đã đổi tên')
      } catch (err) {
        this.flash('Lỗi: ' + err.message, false)
      }
    },

    async deleteGroup(group) {
      if (!confirm(`Xóa nhóm "${group.name}"? Events bên trong sẽ chuyển sang "Chưa phân nhóm".`)) return
      try {
        await api('DELETE', `/api/events/groups/${group.id}`)
        await this.loadAll()
        this.flash('Đã xóa nhóm')
      } catch (err) {
        this.flash('Lỗi xóa: ' + err.message, false)
      }
    },

    initGroupSortable() {
      if (this._groupSortable) { this._groupSortable.destroy(); this._groupSortable = null }
      const el = this.$refs.groupList
      if (!el) return
      this._groupSortable = new Sortable(el, {
        handle: '.group-drag-handle',
        filter: '.no-drag',
        animation: 150,
        onEnd: async () => {
          const orderedIds = [...el.children]
            .map(node => node.dataset.groupId)
            .filter(v => v && v !== '')
            .map(v => parseInt(v))
            .filter(Number.isInteger)
          try {
            await api('PUT', '/api/events/groups/reorder', { orderedIds })
            this.flash('Đã sắp xếp nhóm')
          } catch (err) {
            this.flash('Lỗi sắp xếp: ' + err.message, false)
            await this.loadAll()
          }
        }
      })
    },

    initEventSortables() {
      this._eventSortables.forEach(s => s.destroy())
      this._eventSortables = []
      this.groups.forEach(group => {
        const key = group.id === null ? 'null' : group.id
        const el = document.querySelector(`[data-event-list="${key}"]`)
        if (!el) return
        const s = new Sortable(el, {
          group: 'events',
          animation: 150,
          delay: 120,
          delayOnTouchOnly: true,
          ghostClass: 'sortable-ghost',
          chosenClass: 'sortable-chosen',
          onEnd: (evt) => this.onEventDrop(evt),
        })
        this._eventSortables.push(s)
      })
    },

    async onEventDrop(evt) {
      const toEl = evt.to
      const fromEl = evt.from
      const parseList = (raw) => (raw === 'null' ? null : parseInt(raw))
      const toGroupId = parseList(toEl.dataset.eventList)
      const fromGroupId = parseList(fromEl.dataset.eventList)

      const updates = []
      const collect = (listEl, gid) => {
        ;[...listEl.children].forEach((node, idx) => {
          const id = parseInt(node.dataset.eventId)
          if (Number.isInteger(id)) updates.push({ id, group_id: gid, sort_order: idx })
        })
      }
      collect(toEl, toGroupId)
      if (fromEl !== toEl) collect(fromEl, fromGroupId)

      try {
        await api('PUT', '/api/events/reorder', { updates })
        // Refetch 2 group de dong bo total + UI on dinh
        const toGroup = this.groups.find(g => (g.id === null ? null : g.id) === toGroupId)
        const fromGroup = this.groups.find(g => (g.id === null ? null : g.id) === fromGroupId)
        if (toGroup) await this.loadGroupEvents(toGroup, toGroup.page)
        if (fromGroup && fromGroup !== toGroup) await this.loadGroupEvents(fromGroup, fromGroup.page)
        this.$nextTick(() => this.initEventSortables())
        this.flash('Đã cập nhật')
      } catch (err) {
        this.flash('Lỗi sắp xếp: ' + err.message, false)
        await this.loadAll()
      }
    },

    // ---- Event CRUD ----

    async openCreateEvent(groupId) {
      this.editingEvent = null
      this.eventForm = emptyEventForm()
      this.eventForm.group_id = groupId === undefined ? null : groupId
      await this.refreshTypeSuggestions(this.eventForm.group_id)
      this.showEventModal = true
    },

    async openEditEvent(ev) {
      this.editingEvent = ev
      this.eventForm = {
        name: ev.name || '',
        description: ev.description || '',
        type: ev.type || '',
        status: !!ev.status,
        group_id: ev.group_id === null || ev.group_id === undefined ? null : ev.group_id,
        start_at_str: unixToInputStr(ev.start_at),
        end_at_str: unixToInputStr(ev.end_at),
      }
      await this.refreshTypeSuggestions(this.eventForm.group_id)
      this.showEventModal = true
    },

    async refreshTypeSuggestions(groupId) {
      try {
        const gidParam = groupId === null || groupId === undefined ? 'null' : groupId
        const list = await api('GET', `/api/events/types?group_id=${gidParam}`)
        this.typeSuggestions = Array.isArray(list) && list.length ? list : [...BUILTIN_TYPES]
      } catch (_) {
        this.typeSuggestions = [...BUILTIN_TYPES]
      }
    },

    async saveEvent() {
      const f = this.eventForm
      const name = (f.name || '').trim()
      const type = (f.type || '').trim().toLowerCase()
      if (!name) return this.flash('Tên event bắt buộc', false)
      if (!type) return this.flash('Loại event bắt buộc', false)
      if (!/^[a-z0-9_-]{1,30}$/.test(type)) return this.flash('Loại event chỉ a-z, 0-9, _, -, tối đa 30 ký tự', false)
      const startAt = inputStrToUnix(f.start_at_str)
      const endAt = inputStrToUnix(f.end_at_str)
      if (startAt && endAt && endAt <= startAt) return this.flash('Kết thúc phải sau bắt đầu', false)

      const payload = {
        name,
        description: f.description || '',
        type,
        status: !!f.status,
        start_at: startAt,
        end_at: endAt,
        group_id: f.group_id === null || f.group_id === '' ? null : Number(f.group_id),
      }
      this.saving = true
      try {
        if (this.editingEvent) {
          await api('PUT', `/api/events/${this.editingEvent.id}`, payload)
        } else {
          await api('POST', '/api/events', payload)
        }
        this.showEventModal = false
        await this.loadAll()
        this.flash('Đã lưu event')
      } catch (err) {
        this.flash('Lỗi lưu: ' + err.message, false)
      } finally {
        this.saving = false
      }
    },

    async toggleStatus(ev) {
      try {
        await api('PUT', `/api/events/${ev.id}`, { status: !ev.status })
        ev.status = ev.status ? 0 : 1
        this.flash(ev.status ? 'Đã bật' : 'Đã tắt')
      } catch (err) {
        this.flash('Lỗi: ' + err.message, false)
      }
    },

    async deleteEvent(ev) {
      if (!confirm(`Xóa event "${ev.name}"?`)) return
      try {
        await api('DELETE', `/api/events/${ev.id}`)
        const group = this.groups.find(g => (g.id === null ? null : g.id) === ev.group_id)
        if (group) {
          // Neu xoa lam page hien tai trong thi lui 1 trang
          if (group.events.length === 1 && group.page > 1) {
            await this.loadGroupEvents(group, group.page - 1)
          } else {
            await this.loadGroupEvents(group, group.page)
          }
          this.$nextTick(() => this.initEventSortables())
        } else {
          await this.loadAll()
        }
        this.flash('Đã xóa')
      } catch (err) {
        this.flash('Lỗi xóa: ' + err.message, false)
      }
    },
  }
}

function emptyEventForm() {
  return {
    name: '',
    description: '',
    type: 'giveaway',
    status: false,
    group_id: null,
    start_at_str: '',
    end_at_str: '',
  }
}

window.eventsTab = eventsTab
