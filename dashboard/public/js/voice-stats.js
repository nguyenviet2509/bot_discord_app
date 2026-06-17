// ============================================================
// Voice Statistics Section (leaderboard tab) - client-side pagination
// ============================================================
document.addEventListener('alpine:init', () => {
  Alpine.data('voiceStatsSection', () => ({
    range: '7d',
    customFrom: '',
    customTo: '',
    leaderboard: [],
    rangeLabel: '',
    enabled: true,
    loading: false,
    toast: null,
    channels: [],
    // Pagination
    page: 1,
    pageSize: 20,

    async init() {
      if (!checkAuth()) return
      try {
        const channels = await api('GET', '/discord/channels')
        if (Array.isArray(channels)) this.channels = channels
      } catch (_) {}
      try {
        const s = await api('GET', '/voice-stats/settings')
        this.enabled = !!s.voice_stats_enabled
      } catch (_) {}
      await this.load()
    },

    onRangeChange() {
      if (this.range !== 'custom') this.load()
    },

    async load() {
      this.loading = true
      this.page = 1
      try {
        const params = new URLSearchParams({ range: this.range, limit: '500' })
        if (this.range === 'custom') {
          if (this.customFrom) params.set('from', this.customFrom)
          if (this.customTo) params.set('to', this.customTo)
        }
        const data = await api('GET', `/voice-stats?${params.toString()}`)
        this.leaderboard = Array.isArray(data.leaderboard) ? data.leaderboard : []
        this.rangeLabel = data.range?.label || ''
        this.enabled = !!data.enabled
      } catch (err) {
        this.showToast(err.message || 'Lỗi tải dữ liệu', 'red')
      }
      this.loading = false
    },

    async toggleEnabled() {
      try {
        await api('PUT', '/voice-stats/settings', { voice_stats_enabled: this.enabled })
        this.showToast(this.enabled ? 'Đã bật thống kê ✓' : 'Đã tắt thống kê', 'green')
      } catch (err) {
        this.enabled = !this.enabled
        this.showToast(err.message || 'Lỗi lưu cấu hình', 'red')
      }
    },

    // ============ Pagination helpers ============
    get totalPages() {
      return Math.max(1, Math.ceil(this.leaderboard.length / this.pageSize))
    },

    get paged() {
      const start = (this.page - 1) * this.pageSize
      return this.leaderboard.slice(start, start + this.pageSize)
    },

    get pageNumbers() {
      const tp = this.totalPages
      const cur = this.page
      if (tp <= 7) return Array.from({ length: tp }, (_, i) => i + 1)
      const out = [1]
      const start = Math.max(2, cur - 1)
      const end = Math.min(tp - 1, cur + 1)
      if (start > 2) out.push('...')
      for (let i = start; i <= end; i++) out.push(i)
      if (end < tp - 1) out.push('...')
      out.push(tp)
      return out
    },

    onPageSizeChange() {
      this.page = 1
    },

    prevPage() { if (this.page > 1) this.page-- },
    nextPage() { if (this.page < this.totalPages) this.page++ },
    goPage(p) {
      if (typeof p !== 'number' || p < 1 || p > this.totalPages) return
      this.page = p
    },

    // Index hien thi (1-based) cho row tai vi tri i trong trang hien tai
    displayIndex(i) {
      return (this.page - 1) * this.pageSize + i + 1
    },

    // ============ Formatters ============
    formatDuration(sec) {
      const s = Math.max(0, Math.floor(Number(sec) || 0))
      const h = Math.floor(s / 3600)
      const m = Math.floor((s % 3600) / 60)
      const ss = s % 60
      if (h > 0) return `${h}h ${m}m`
      if (m > 0) return `${m}m ${ss}s`
      return `${ss}s`
    },

    resolveChannel(top) {
      if (!top) return '—'
      const c = this.channels.find(ch => String(ch.id) === String(top.id))
      const name = c ? `#${c.name}` : `#${top.id.slice(-4)}`
      return `${name} (${this.formatDuration(top.total_sec)})`
    },

    showToast(msg, color = 'green') {
      this.toast = { msg, color }
      setTimeout(() => { this.toast = null }, 3000)
    },
  }))
})
