// ============================================================
// Voice In/Out Notification Section
// ============================================================
document.addEventListener('alpine:init', () => {
  Alpine.data('voiceLogSection', () => ({
    form: {
      enabled: false,
      notify_channel_id: '',
      watched_channels: [],
      join_template: '{user} đã vào kênh `{channel}` .',
      leave_template: '{user} đã rời kênh `{channel}` .',
      use_embed: false,
      embed_color_join: '#22c55e',
      embed_color_leave: '#ef4444',
      show_author: true,
      show_footer: true,
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
            use_embed: !!cfg.use_embed,
            embed_color_join: cfg.embed_color_join || '#22c55e',
            embed_color_leave: cfg.embed_color_leave || '#ef4444',
            show_author: cfg.show_author == null ? true : !!cfg.show_author,
            show_footer: cfg.show_footer == null ? true : !!cfg.show_footer,
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
          use_embed: this.form.use_embed,
          embed_color_join: this.form.embed_color_join,
          embed_color_leave: this.form.embed_color_leave,
          show_author: this.form.show_author,
          show_footer: this.form.show_footer,
        })
        if (res?.success) this.showToast('Đã lưu ✓', 'green')
        else this.showToast(res?.error || 'Lưu thất bại', 'red')
      } catch (err) {
        this.showToast(err.message || 'Lỗi mạng', 'red')
      }
      this.saving = false
    },

    renderPreview(tpl) {
      const escaped = String(tpl || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      return escaped
        .replace(/\{user\}/g, '<span style="color:#5865f2;background:#5865f21a;padding:0 2px;border-radius:3px">@TênThànhViên</span>')
        .replace(/\{username\}/g, '<span style="color:#5865f2">TênThànhViên</span>')
        .replace(/\{channel\}/g, '<span style="background:#383a40;padding:0 4px;border-radius:3px;font-family:monospace;font-size:.9em">GoldenStar</span>')
        .replace(/\{time\}/g, '<span style="color:#949ba4">14:14</span>')
        .replace(/`([^`]+)`/g, '<code style="background:#383a40;padding:0 4px;border-radius:3px;font-family:monospace;font-size:.9em">$1</code>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>')
    },

    showToast(msg, color = 'green') {
      this.toast = { msg, color }
      setTimeout(() => { this.toast = null }, 3000)
    },
  }))
})
