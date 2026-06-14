// ============================================================
// Voice In/Out Notification Section
// ============================================================
document.addEventListener('alpine:init', () => {
  Alpine.data('voiceLogSection', () => ({
    form: {
      enabled: false,
      notify_channel_id: '',
      watched_channels: [],
      join_template: '🔊 {user} vừa vào **{channel}** lúc {time}',
      leave_template: '👋 {username} đã rời **{channel}** lúc {time}',
    },
    voiceChannels: [],
    textChannels: [],
    loading: false,
    saving: false,
    toast: null,

    async init() {
      if (!checkAuth()) return
      await this.load()
    },

    async load() {
      this.loading = true
      try {
        const [cfg, channels] = await Promise.all([
          api('GET', '/voice-log'),
          api('GET', '/discord/channels'),
        ])
        if (cfg) {
          this.form = {
            enabled: !!cfg.enabled,
            notify_channel_id: cfg.notify_channel_id || '',
            watched_channels: Array.isArray(cfg.watched_channels) ? cfg.watched_channels.map(String) : [],
            join_template: cfg.join_template || this.form.join_template,
            leave_template: cfg.leave_template || this.form.leave_template,
          }
        }
        if (Array.isArray(channels)) {
          this.voiceChannels = channels.filter(c => c.type === 'voice')
          this.textChannels  = channels.filter(c => c.type === 'text')
        }
      } catch (err) {
        this.showToast(err.message || 'Lỗi tải dữ liệu', 'red')
      }
      this.loading = false
    },

    isWatched(id) {
      return this.form.watched_channels.includes(String(id))
    },

    toggleWatched(id) {
      const sid = String(id)
      const i = this.form.watched_channels.indexOf(sid)
      if (i >= 0) this.form.watched_channels.splice(i, 1)
      else this.form.watched_channels.push(sid)
    },

    selectAll() {
      this.form.watched_channels = this.voiceChannels.map(c => String(c.id))
    },

    clearAll() {
      this.form.watched_channels = []
    },

    insertVar(field, v) {
      this.form[field] = (this.form[field] || '') + v
    },

    async save() {
      if (!this.form.join_template?.trim() || !this.form.leave_template?.trim()) {
        this.showToast('Mẫu tin nhắn không được rỗng', 'red')
        return
      }
      this.saving = true
      try {
        const res = await api('PUT', '/voice-log', {
          enabled: this.form.enabled,
          notify_channel_id: this.form.notify_channel_id || null,
          watched_channels: this.form.watched_channels,
          join_template: this.form.join_template,
          leave_template: this.form.leave_template,
        })
        if (res?.success) this.showToast('Đã lưu ✓', 'green')
        else this.showToast(res?.error || 'Lưu thất bại', 'red')
      } catch (err) {
        this.showToast(err.message || 'Lỗi mạng', 'red')
      }
      this.saving = false
    },

    showToast(msg, color = 'green') {
      this.toast = { msg, color }
      setTimeout(() => { this.toast = null }, 3000)
    },
  }))
})
