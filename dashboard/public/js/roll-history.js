// Alpine controller cho trang lich su ROLL.
// JWT auth qua localStorage.token (giong cac trang khac).

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.token || ''}` }
}

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { ...authHeaders(), 'Content-Type': 'application/json', ...(opts.headers || {}) },
  })
  if (res.status === 401) {
    location.href = '/login.html'
    throw new Error('Unauthorized')
  }
  return res
}

document.addEventListener('alpine:init', () => {
  Alpine.data('rollHistorySection', () => ({
    items: [], total: 0, page: 1, pageSize: 20,
    filters: { from: '', to: '' },
    selected: null,
    showDetail: false,
    clearDays: 30,
    showNuke: false,
    nukeInput: '',
    loading: false,

    async init() { await this.load() },

    async load() {
      this.loading = true
      try {
        const qs = new URLSearchParams({ page: this.page, pageSize: this.pageSize })
        if (this.filters.from) qs.set('from', Math.floor(new Date(this.filters.from).getTime() / 1000))
        if (this.filters.to)   qs.set('to', Math.floor(new Date(this.filters.to + 'T23:59:59').getTime() / 1000))
        const res = await apiFetch(`/api/roll-history?${qs}`)
        const data = await res.json()
        this.items = data.data || []
        this.total = data.total || 0
      } catch (err) {
        console.error(err)
      } finally {
        this.loading = false
      }
    },

    async openDetail(id) {
      try {
        const res = await apiFetch(`/api/roll-history/${id}`)
        if (!res.ok) { alert('Không lấy được chi tiết.'); return }
        this.selected = await res.json()
        this.showDetail = true
      } catch (err) { console.error(err) }
    },

    async clearOld() {
      if (!confirm(`Xóa session cũ hơn ${this.clearDays} ngày?`)) return
      try {
        const res = await apiFetch(`/api/roll-history?olderThanDays=${this.clearDays}`, { method: 'DELETE' })
        const j = await res.json()
        if (!res.ok) { alert(j.error || 'Lỗi'); return }
        alert(`Đã xóa ${j.deleted} session.`)
        this.page = 1
        await this.load()
      } catch (err) { console.error(err) }
    },

    async nuke() {
      if (this.nukeInput !== 'NUKE') return
      try {
        const res = await apiFetch('/api/roll-history/all', {
          method: 'DELETE',
          body: JSON.stringify({ confirm: 'NUKE' }),
        })
        const j = await res.json()
        if (!res.ok) { alert(j.error || 'Lỗi'); return }
        alert(`Đã xóa toàn bộ ${j.deleted} session.`)
        this.showNuke = false
        this.nukeInput = ''
        this.page = 1
        await this.load()
      } catch (err) { console.error(err) }
    },

    fmtTime(unixSec) {
      if (!unixSec) return '—'
      const d = new Date(unixSec * 1000)
      const pad = n => String(n).padStart(2, '0')
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    },
  }))
})
