// ============================================================
// Voice Statistics Section (leaderboard tab)
// ============================================================
document.addEventListener('alpine:init', () => {
  Alpine.data('voiceStatsSection', () => ({
    range: '7d',
    customFrom: '',
    customTo: '',
    limit: 20,
    leaderboard: [],
    rangeLabel: '',
    enabled: true,
    loading: false,
    toast: null,
    channels: [], // de resolve channel name

    async init() {
      if (!checkAuth()) return
      // Load channels mot lan de resolve ten channel
      try {
        const channels = await api('GET', '/discord/channels')
        if (Array.isArray(channels)) this.channels = channels
      } catch (_) {}
      // Load settings enabled state
      try {
        const s = await api('GET', '/voice-stats/settings')
        this.enabled = !!s.voice_stats_enabled
      } catch (_) {}
      await this.load()
    },

    onRangeChange() {
      // Khi chon preset khac custom → reload ngay
      if (this.range !== 'custom') this.load()
    },

    async load() {
      this.loading = true
      try {
        const params = new URLSearchParams({ range: this.range, limit: String(this.limit) })
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
        this.enabled = !this.enabled // rollback
        this.showToast(err.message || 'Lỗi lưu cấu hình', 'red')
      }
    },

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
