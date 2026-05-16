// ============================================================
// Helpers
// ============================================================
async function api(method, path, body = null) {
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json'

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : null,
  })

  if (res.status === 401) {
    localStorage.removeItem('token')
    window.location.href = '/login.html'
    return null
  }

  return res.json()
}

function checkAuth() {
  if (!localStorage.getItem('token')) {
    window.location.href = '/login.html'
    return false
  }
  return true
}

function timeAgo(unixSeconds) {
  if (!unixSeconds) return 'Chưa có'
  const diff = Math.floor(Date.now() / 1000) - unixSeconds
  if (diff < 60) return `${diff}s trước`
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`
  return `${Math.floor(diff / 86400)} ngày trước`
}

function getAvatarUrl(userId, avatarHash) {
  if (avatarHash) return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=64`
  return null
}

function getInitials(username) {
  if (!username) return '?'
  return username.charAt(0).toUpperCase()
}

function avatarBgColor(userId) {
  const palette = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#6366f1','#a855f7','#ec4899']
  const hash = (userId || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return palette[hash % palette.length]
}

function levelBadgeStyle(level) {
  if (level >= 100) return 'background:#fff0f0;color:#ff4655'  // Thách Đấu
  if (level >= 90)  return 'background:#fff3e0;color:#e65100'  // Đại Cao Thủ
  if (level >= 80)  return 'background:#f3e5f5;color:#7b1fa2'  // Cao Thủ
  if (level >= 70)  return 'background:#e3f2fd;color:#0277bd'  // Kim Cương
  if (level >= 60)  return 'background:#e8f5e9;color:#2e7d32'  // Lục Bảo
  if (level >= 50)  return 'background:#e0f7fa;color:#00838f'  // Bạch Kim
  if (level >= 40)  return 'background:#fffde7;color:#f9a825'  // Vàng
  if (level >= 30)  return 'background:#eceff1;color:#546e7a'  // Bạc
  if (level >= 20)  return 'background:#fbe9e7;color:#bf360c'  // Đồng
  if (level >= 10)  return 'background:#f5f5f5;color:#455a64'  // Sắt
  return 'background:#f1f5f9;color:#94a3b8'                    // Chưa xếp hạng
}

// ============================================================
// Rewards Section
// ============================================================
document.addEventListener('alpine:init', () => {
  Alpine.data('rewardsSection', () => ({
    rewards: [],
    roles: [],
    loading: false,
    modal: false,
    uploading: false,
    saving: false,
    sending: false,
    pushingIcon: false,
    testChannelId: localStorage.getItem('rewards_test_channel_id') || '',
    form: { level_required: 1, type: 'role', role_id: '', badge_url: '', badge_name: '' },
    editId: null,
    toast: null,

    async init() {
      if (!checkAuth()) return
      await this.load()
    },

    async load() {
      this.loading = true
      const [rewards, roles] = await Promise.all([
        api('GET', '/rewards'),
        api('GET', '/discord/roles'),
      ])
      this.rewards = rewards || []
      this.roles = roles || []
      this.loading = false
    },

    openAdd() {
      this.editId = null
      this.form = { level_required: 1, type: 'role', role_id: '', badge_url: '', badge_name: '' }
      this.modal = true
    },

    openEdit(reward) {
      this.editId = reward.id
      this.form = {
        level_required: reward.level_required,
        type: reward.type,
        role_id: reward.role_id || '',
        badge_url: reward.badge_url || '',
        badge_name: reward.badge_name || '',
      }
      this.modal = true
    },

    async uploadImage(event) {
      const file = event.target.files[0]
      if (!file) return
      this.uploading = true
      const fd = new FormData()
      fd.append('image', file)
      const data = await api('POST', '/rewards/upload', fd)
      if (data?.url) this.form.badge_url = data.url
      this.uploading = false
    },

    async uploadRoleIcon(event) {
      const file = event.target.files[0]
      if (!file) return
      if (!this.form.role_id) {
        this.showToast('Cần chọn Role kèm theo trước', 'red')
        event.target.value = ''
        return
      }
      if (file.size > 256 * 1024) {
        this.showToast(`Ảnh ${(file.size / 1024).toFixed(0)}KB > 256KB. Discord yêu cầu ≤256KB.`, 'red')
        event.target.value = ''
        return
      }
      this.pushingIcon = true
      const fd = new FormData()
      fd.append('image', file)
      fd.append('role_id', this.form.role_id)
      try {
        const res = await api('POST', '/rewards/upload-role-icon', fd)
        if (res?.success) {
          this.showToast('Đã upload + push icon lên role ✓', 'green')
        } else {
          const hint = res?.hint ? `\n💡 ${res.hint}` : ''
          this.showToast((res?.error || 'Upload thất bại') + hint, 'red')
        }
      } catch (err) {
        this.showToast(err.message, 'red')
      }
      this.pushingIcon = false
      event.target.value = ''
    },

    async pushBadgeAsRoleIcon() {
      if (!this.form.badge_url || !this.form.role_id) {
        this.showToast('Cần có ảnh badge và role kèm theo', 'red')
        return
      }
      this.pushingIcon = true
      try {
        const res = await api('POST', '/rewards/push-role-icon', {
          badge_url: this.form.badge_url,
          role_id: this.form.role_id,
        })
        if (res?.success) {
          this.showToast('Đã push ảnh lên role làm icon ✓ — kiểm tra Server Settings → Roles', 'green')
        } else {
          const hint = res?.hint ? `\n💡 ${res.hint}` : ''
          this.showToast((res?.error || 'Push thất bại') + hint, 'red')
        }
      } catch (err) {
        this.showToast(err.message, 'red')
      }
      this.pushingIcon = false
    },

    async save() {
      this.saving = true
      try {
        if (this.editId) {
          await api('PUT', `/rewards/${this.editId}`, this.form)
        } else {
          await api('POST', '/rewards', this.form)
        }
        this.modal = false
        await this.load()
        this.showToast('Đã lưu thành công ✓', 'green')
      } catch (err) {
        this.showToast(err.message, 'red')
      }
      this.saving = false
    },

    async remove(id) {
      if (!confirm('Xoá reward này?')) return
      await api('DELETE', `/rewards/${id}`)
      this.rewards = this.rewards.filter(r => r.id !== id)
      this.showToast('Đã xoá ✓', 'green')
    },

    async sendTest() {
      if (!this.testChannelId.trim()) {
        this.showToast('Vui lòng nhập Channel ID', 'red')
        return
      }
      if (!this.form.level_required) {
        this.showToast('Cần nhập Level yêu cầu', 'red')
        return
      }
      localStorage.setItem('rewards_test_channel_id', this.testChannelId.trim())
      this.sending = true
      try {
        const res = await api('POST', '/rewards/test', {
          channel_id: this.testChannelId.trim(),
          reward: this.form,
        })
        if (res?.success) this.showToast('Đã gửi test ✓ — kiểm tra channel Discord', 'green')
        else this.showToast(res?.error || 'Gửi thất bại', 'red')
      } catch (err) {
        this.showToast(err.message, 'red')
      }
      this.sending = false
    },

    roleName(roleId) {
      const role = this.roles.find(r => r.id === roleId)
      return role ? role.name : roleId
    },

    showToast(msg, color = 'green') {
      this.toast = { msg, color }
      setTimeout(() => { this.toast = null }, 3000)
    },

    levelBadgeStyle,
  }))

  // ============================================================
  // Members Section
  // ============================================================
  Alpine.data('membersSection', () => ({
    members: [],
    rewards: [],
    roles: [],
    search: '',
    loading: false,
    toast: null,
    page: 1,
    limit: 20,

    async init() {
      await this.load()
    },

    // Phân trang client-side trên kết quả đã lọc
    get totalPages() {
      return Math.max(1, Math.ceil(this.filtered.length / this.limit))
    },

    get paged() {
      const start = (this.page - 1) * this.limit
      return this.filtered.slice(start, start + this.limit)
    },

    // Dãy số trang để hiển thị (rút gọn với '...')
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

    onSearchInput() {
      this.page = 1
    },

    onLimitChange() {
      this.page = 1
    },

    prevPage() { if (this.page > 1) this.page-- },
    nextPage() { if (this.page < this.totalPages) this.page++ },
    goPage(p) {
      if (typeof p !== 'number' || p < 1 || p > this.totalPages) return
      this.page = p
    },

    async load() {
      this.loading = true
      const [members, rewards, roles] = await Promise.all([
        api('GET', '/members'),
        api('GET', '/rewards'),
        api('GET', '/discord/roles'),
      ])
      this.members = members || []
      this.rewards = rewards || []
      this.roles = roles || []
      this.loading = false
    },

    // Moc reward (sort theo level asc) cho hien "Moc phan thuong"
    get rewardMilestones() {
      const sorted = [...this.rewards].sort((a, b) => a.level_required - b.level_required)
      return sorted.map(r => {
        let name = ''
        if (r.type === 'badge') name = r.badge_name || 'Badge'
        else if (r.type === 'role') {
          const role = this.roles.find(x => x.id === r.role_id)
          name = role ? role.name : 'Role'
        }
        return { id: r.id, level: r.level_required, name, type: r.type, badge_url: r.badge_url }
      })
    },

    get filtered() {
      const q = this.search.toLowerCase()
      if (!q) return this.members
      return this.members.filter(m =>
        (m.username || '').toLowerCase().includes(q) ||
        (m.global_name || '').toLowerCase().includes(q) ||
        (m.nickname || '').toLowerCase().includes(q) ||
        m.id.includes(q)
      )
    },

    async resetXp(member) {
      const name = member.nickname || member.global_name || member.username || member.id
      if (!confirm(`Reset XP của ${name}?`)) return
      await api('DELETE', `/members/${member.id}/xp`)
      member.xp = 0
      member.level = 0
      this.showToast('Đã reset XP', 'green')
    },

    async deleteMember(member) {
      const name = member.nickname || member.global_name || member.username || member.id
      if (!confirm(`Xóa hẳn record của ${name} (${member.id})?\nHành động này không thể hoàn tác.`)) return
      const res = await api('DELETE', `/members/${member.id}`)
      if (res && res.success) {
        this.members = this.members.filter((m) => m.id !== member.id)
        this.showToast('Đã xóa record', 'green')
      }
    },

    showToast(msg, color = 'green') {
      this.toast = { msg, color }
      setTimeout(() => { this.toast = null }, 3000)
    },

    timeAgo,
    getAvatarUrl,
    getInitials,
    avatarBgColor,
    levelBadgeStyle,
  }))

  // ============================================================
  // Scheduled Messages Section
  // ============================================================
  Alpine.data('scheduledMessagesSection', () => ({
    messages: [],
    groups: [],
    loading: false,
    saving: false,
    uploading: false,
    sendingId: null,
    modal: false,
    editId: null,
    draggedId: null,
    dragOverGroup: undefined, // undefined = none, null = ungrouped zone, number = group id
    statusFilter: 'all', // 'all' | 'enabled' | 'disabled'
    levelUpChannelId: '', // tu /settings, dung lam goi y khi tao leaderboard
    form: {
      name: '', channel_id: '', content: '', image_url: '',
      interval_minutes: 180, enabled: true,
      use_embed: false, embed_title: '', embed_color: '#6366f1',
      group_id: '', kind: 'text',
      schedule_mode: 'interval', // 'interval' | 'clock'
      schedule_time: '00:00',
      schedule_weekday: '', // '' = moi ngay, '0'..'6'
      start_time: '', // moc neo cho interval mode (HH:MM, optional)
    },
    toast: null,

    async init() {
      if (!checkAuth()) return
      await this.load()
    },

    async load() {
      this.loading = true
      const [msgs, grps, settings] = await Promise.all([
        api('GET', '/scheduled-messages'),
        api('GET', '/scheduled-messages/groups'),
        api('GET', '/settings'),
      ])
      this.messages = (msgs || []).map(m => ({ ...m, enabled: !!m.enabled }))
      this.groups = grps || []
      this.levelUpChannelId = settings?.level_up_reply_channel_id || ''
      this.loading = false
    },

    // Returns: [{ id, name, items }, ...] then { id: null, name: 'Chưa phân nhóm', items } if any
    get groupedMessages() {
      const byGroup = new Map()
      this.groups.forEach(g => byGroup.set(g.id, { id: g.id, name: g.name, items: [] }))
      const ungrouped = { id: null, name: 'Chưa phân nhóm', items: [] }
      const filtered = this.messages.filter(m => {
        if (this.statusFilter === 'enabled') return !!m.enabled
        if (this.statusFilter === 'disabled') return !m.enabled
        return true
      })
      filtered.forEach(m => {
        const gid = m.group_id
        if (gid && byGroup.has(gid)) byGroup.get(gid).items.push(m)
        else ungrouped.items.push(m)
      })
      const out = Array.from(byGroup.values())
      if (ungrouped.items.length > 0) out.push(ungrouped)
      return out
    },

    get statusCounts() {
      let enabled = 0, disabled = 0
      this.messages.forEach(m => { m.enabled ? enabled++ : disabled++ })
      return { all: this.messages.length, enabled, disabled }
    },

    async createGroup() {
      const name = prompt('Tên nhóm mới (vd: Thông báo Boss):')
      if (!name || !name.trim()) return
      const res = await api('POST', '/scheduled-messages/groups', { name: name.trim() })
      if (res?.error) return this.showToast(res.error, 'red')
      this.showToast('Đã tạo nhóm ✓', 'green')
      await this.load()
    },

    async renameGroup(g) {
      const name = prompt('Tên nhóm:', g.name)
      if (!name || !name.trim() || name.trim() === g.name) return
      await api('PUT', `/scheduled-messages/groups/${g.id}`, { name: name.trim() })
      this.showToast('Đã đổi tên ✓', 'green')
      await this.load()
    },

    async deleteGroup(g) {
      if (!confirm(`Xóa nhóm "${g.name}"? Các tin nhắn trong nhóm sẽ chuyển sang "Chưa phân nhóm".`)) return
      await api('DELETE', `/scheduled-messages/groups/${g.id}`)
      this.showToast('Đã xóa nhóm ✓', 'green')
      await this.load()
    },

    // ---- Drag & drop tin nhắn giữa các nhóm ----
    onDragStart(ev, m) {
      this.draggedId = m.id
      if (ev.dataTransfer) {
        ev.dataTransfer.effectAllowed = 'move'
        ev.dataTransfer.setData('text/plain', String(m.id)) // Firefox cần payload
      }
    },
    onDragEnd() {
      this.draggedId = null
      this.dragOverGroup = undefined
    },
    onDragOver(ev, groupId) {
      if (this.draggedId == null) return
      ev.preventDefault()
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move'
      // groupId: number | null
      if (this.dragOverGroup !== groupId) this.dragOverGroup = groupId
    },
    onDragLeave(groupId) {
      if (this.dragOverGroup === groupId) this.dragOverGroup = undefined
    },
    async onDrop(ev, groupId) {
      ev.preventDefault()
      const id = this.draggedId
      this.draggedId = null
      this.dragOverGroup = undefined
      if (!id) return
      const msg = this.messages.find(x => x.id === id)
      if (!msg) return
      const currentGid = msg.group_id || null
      const targetGid = groupId || null
      if (currentGid === targetGid) return
      // Optimistic update
      msg.group_id = targetGid
      try {
        const res = await api('PUT', `/scheduled-messages/${id}`, { group_id: targetGid })
        if (res?.error) {
          msg.group_id = currentGid
          this.showToast(res.error, 'red')
        } else {
          this.showToast('Đã chuyển nhóm ✓', 'green')
        }
      } catch (err) {
        msg.group_id = currentGid
        this.showToast(err.message, 'red')
      }
    },

    openCreate(presetGroupId = '') {
      this.editId = null
      this.form = {
        name: '', channel_id: '', content: '', image_url: '',
        interval_minutes: 180, enabled: true,
        use_embed: false, embed_title: '', embed_color: '#6366f1',
        group_id: presetGroupId || '', kind: 'text',
        schedule_mode: 'interval', schedule_time: '00:00', schedule_weekday: '',
        start_time: '',
      }
      this.modal = true
    },

    openEdit(m) {
      this.editId = m.id
      this.form = {
        name: m.name || '',
        channel_id: m.channel_id,
        content: m.content || '',
        image_url: m.image_url || '',
        interval_minutes: m.interval_minutes,
        enabled: !!m.enabled,
        use_embed: !!m.use_embed,
        embed_title: m.embed_title || '',
        embed_color: m.embed_color || '#6366f1',
        group_id: m.group_id || '',
        kind: m.kind === 'leaderboard' ? 'leaderboard' : 'text',
        schedule_mode: m.schedule_time ? 'clock' : 'interval',
        schedule_time: m.schedule_time || '00:00',
        schedule_weekday: m.schedule_weekday === null || m.schedule_weekday === undefined ? '' : String(m.schedule_weekday),
        start_time: m.start_time || '',
      }
      this.modal = true
    },

    // Khi doi kind sang leaderboard: goi y channel + schedule + content mau (chi khi tao moi)
    onKindChange() {
      if (this.editId) return
      if (this.form.kind === 'leaderboard') {
        if (!this.form.channel_id && this.levelUpChannelId) this.form.channel_id = this.levelUpChannelId
        if (this.form.schedule_mode === 'interval') {
          // Chuyen sang cron: moi tuan Chu Nhat 00:00
          this.form.schedule_mode = 'clock'
          this.form.schedule_time = '00:00'
          this.form.schedule_weekday = '0' // Chu Nhat
        }
        if (!this.form.content) {
          this.form.content = '🏆 **Bảng xếp hạng XP tuần này** 🏆\n\n{leaderboard}\n\nChúc mừng các thành viên tích cực!'
        }
      }
    },

    async uploadImage(event) {
      const file = event.target.files[0]
      if (!file) return
      this.uploading = true
      const fd = new FormData()
      fd.append('image', file)
      const data = await api('POST', '/scheduled-messages/upload', fd)
      if (data?.url) this.form.image_url = data.url
      this.uploading = false
    },

    async save() {
      if (!this.form.channel_id) return this.showToast('Thiếu channel_id', 'red')
      const isLb = this.form.kind === 'leaderboard'
      if (!isLb && !this.form.content && !this.form.image_url) return this.showToast('Phải có content hoặc ảnh', 'red')
      if (!this.form.interval_minutes || this.form.interval_minutes < 1) return this.showToast('Interval phải >= 1', 'red')
      if (this.form.schedule_mode === 'clock' && !/^\d{1,2}:\d{2}$/.test(this.form.schedule_time || '')) {
        return this.showToast('Giờ không hợp lệ (HH:MM)', 'red')
      }
      if (this.form.schedule_mode === 'interval' && this.form.start_time && !/^\d{1,2}:\d{2}$/.test(this.form.start_time)) {
        return this.showToast('Giờ bắt đầu không hợp lệ (HH:MM)', 'red')
      }
      this.saving = true
      try {
        const url = this.editId ? `/scheduled-messages/${this.editId}` : '/scheduled-messages'
        const method = this.editId ? 'PUT' : 'POST'
        const payload = {
          ...this.form,
          schedule_time: this.form.schedule_mode === 'clock' ? this.form.schedule_time : null,
          schedule_weekday: this.form.schedule_mode === 'clock' ? this.form.schedule_weekday : null,
          start_time: this.form.schedule_mode === 'interval' ? (this.form.start_time || null) : null,
        }
        delete payload.schedule_mode
        const res = await api(method, url, payload)
        if (res?.error) this.showToast(res.error, 'red')
        else {
          this.showToast('Đã lưu ✓', 'green')
          this.modal = false
          await this.load()
        }
      } catch (err) {
        this.showToast(err.message, 'red')
      }
      this.saving = false
    },

    async remove(m) {
      if (!confirm(`Xóa "${m.name || m.id}"?`)) return
      await api('DELETE', `/scheduled-messages/${m.id}`)
      this.showToast('Đã xóa ✓', 'green')
      await this.load()
    },

    async sendNow(m) {
      this.sendingId = m.id
      try {
        const res = await api('POST', `/scheduled-messages/${m.id}/send-now`, {})
        if (res?.success) this.showToast('Đã gửi ✓', 'green')
        else this.showToast(res?.error || 'Lỗi', 'red')
        await this.load()
      } catch (err) {
        this.showToast(err.message, 'red')
      }
      this.sendingId = null
    },

    showToast(msg, color = 'green') {
      this.toast = { msg, color }
      setTimeout(() => { this.toast = null }, 3000)
    },

    timeAgo,
  }))

  // ============================================================
  // Analytics Section
  // ============================================================
  Alpine.data('analyticsSection', () => ({
    summary: {},
    growth: [],
    heatmap: [],
    topChannels: [],
    inactive: [],
    silentMembers: [],
    silentTotal: 0,
    silentScannedAt: null,
    growthDays: '30',
    inactiveDays: '7',
    loading: false,
    loadingSilent: false,
    _chart: null,
    _heatmapMax: 0,

    async init() {
      if (!checkAuth()) return
      await this.load()
    },

    async load() {
      this.loading = true
      const [summary, growth, heatmap, topChannels, inactive, silent] = await Promise.all([
        api('GET', '/analytics/summary'),
        api('GET', `/analytics/growth?days=${this.growthDays}`),
        api('GET', '/analytics/heatmap'),
        api('GET', '/analytics/top-channels?limit=10'),
        api('GET', `/analytics/inactive?days=${this.inactiveDays}&limit=100`),
        api('GET', '/analytics/silent-members?limit=500'),
      ])
      this.summary = summary || {}
      this.growth = growth || []
      this.heatmap = heatmap || []
      this.topChannels = topChannels || []
      this.inactive = inactive || []
      this.silentMembers = silent?.members || []
      this.silentTotal = silent?.total || 0
      this.silentScannedAt = silent?.scanned_at || null
      this._heatmapMax = Math.max(1, ...this.heatmap.map(h => h.message_count))
      this.loading = false
      this.$nextTick(() => this.renderGrowthChart())
    },

    async loadGrowth() {
      this.growth = await api('GET', `/analytics/growth?days=${this.growthDays}`) || []
      this.renderGrowthChart()
    },

    async loadInactive() {
      this.inactive = await api('GET', `/analytics/inactive?days=${this.inactiveDays}&limit=100`) || []
    },

    // Trigger scan: fetch Discord, luu DB, reload list
    async loadSilent() {
      this.loadingSilent = true
      try {
        const scanRes = await api('POST', '/analytics/silent-members/scan', {})
        if (scanRes?.error) {
          this.showToastTmp(scanRes.error, 'red')
        }
        // Reload tu DB sau khi scan
        const data = await api('GET', '/analytics/silent-members?limit=500')
        this.silentMembers = data?.members || []
        this.silentTotal = data?.total || 0
        this.silentScannedAt = data?.scanned_at || null
      } catch (err) {
        this.showToastTmp(err.message, 'red')
      }
      this.loadingSilent = false
    },

    showToastTmp(msg, color) {
      // Reuse moderationSection toast pattern (analytics khong co toast nen alert)
      console.error('[Analytics]', msg)
      alert(msg)
    },

    joinedAgo(isoStr) {
      if (!isoStr) return '?'
      const sec = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000)
      if (sec < 86400) return 'hôm nay'
      const days = Math.floor(sec / 86400)
      if (days < 30) return days + ' ngày trước'
      const months = Math.floor(days / 30)
      if (months < 12) return months + ' tháng trước'
      return Math.floor(months / 12) + ' năm trước'
    },

    renderGrowthChart() {
      const canvas = document.getElementById('growthChart')
      if (!canvas || typeof Chart === 'undefined') return
      if (this._chart) this._chart.destroy()
      const labels = this.growth.map(g => g.day)
      const joins = this.growth.map(g => g.joins)
      const leaves = this.growth.map(g => -g.leaves)
      this._chart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Join', data: joins, backgroundColor: '#10b981' },
            { label: 'Leave', data: leaves, backgroundColor: '#ef4444' },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { stacked: true, grid: { display: false } },
            y: { stacked: true, ticks: { callback: v => Math.abs(v) } },
          },
          plugins: { legend: { position: 'top', align: 'end' } },
        },
      })
    },

    heatmapCellStyle(weekday, hour) {
      const cell = this.heatmap.find(h => h.weekday === weekday && h.hour === hour)
      const count = cell ? cell.message_count : 0
      if (count === 0) return 'background:#f1f5f9'
      const intensity = Math.min(count / this._heatmapMax, 1)
      const alpha = 0.15 + intensity * 0.85
      return `background:rgba(99,102,241,${alpha.toFixed(2)})`
    },

    heatmapCellLabel(weekday, hour) {
      const cell = this.heatmap.find(h => h.weekday === weekday && h.hour === hour)
      const count = cell ? cell.message_count : 0
      const days = ['CN','T2','T3','T4','T5','T6','T7']
      return `${days[weekday]} ${hour}h: ${count} message`
    },

    timeAgo,
    getAvatarUrl,
    getInitials,
    avatarBgColor,
  }))

  // ============================================================
  // Moderation Section
  // ============================================================
  Alpine.data('moderationSection', () => ({
    actions: [],
    activeBans: [],
    total: 0,
    page: 1,
    limit: 50,
    filterType: '',
    search: '',
    loading: false,
    unbanning: null,
    toast: null,
    _searchTimer: null,

    async init() {
      if (!checkAuth()) return
      await this.load()
    },

    async load() {
      this.loading = true
      const params = new URLSearchParams({
        action_type: this.filterType,
        search: this.search,
        page: this.page,
        limit: this.limit,
      })
      const data = await api('GET', `/moderation?${params}`)
      if (data) {
        this.actions = data.actions || []
        this.total = data.total || 0
        this.activeBans = data.active_bans || []
      }
      this.loading = false
    },

    get totalPages() {
      return Math.max(1, Math.ceil(this.total / this.limit))
    },

    onSearchInput() {
      clearTimeout(this._searchTimer)
      this._searchTimer = setTimeout(() => { this.page = 1; this.load() }, 350)
    },

    onFilterChange() { this.page = 1; this.load() },
    prevPage() { if (this.page > 1) { this.page--; this.load() } },
    nextPage() { if (this.page < this.totalPages) { this.page++; this.load() } },

    async unban(ban) {
      if (!confirm(`Gỡ ban ${ban.user_tag || ban.user_id}?`)) return
      this.unbanning = ban.user_id
      try {
        const res = await api('POST', '/moderation/unban', { user_id: ban.user_id, reason: 'Unban từ dashboard' })
        if (res?.success) {
          this.showToast('Đã gỡ ban ✓', 'green')
          await this.load()
        } else {
          this.showToast(res?.error || 'Lỗi', 'red')
        }
      } catch (err) {
        this.showToast(err.message, 'red')
      }
      this.unbanning = null
    },

    actionEmoji(t) {
      return { kick: '👢', ban: '🔨', unban: '✅', mute: '🔇', unmute: '🔊' }[t] || '•'
    },

    actionBadgeStyle(t) {
      const map = {
        kick:   { background: '#fef3c7', color: '#92400e' },
        ban:    { background: '#fee2e2', color: '#991b1b' },
        unban:  { background: '#d1fae5', color: '#065f46' },
        mute:   { background: '#e0e7ff', color: '#3730a3' },
        unmute: { background: '#dbeafe', color: '#1e40af' },
      }
      const s = map[t] || { background: '#f1f5f9', color: '#475569' }
      return `background:${s.background};color:${s.color}`
    },

    formatMs(ms) {
      if (!ms) return ''
      if (ms < 60000) return Math.floor(ms / 1000) + 's'
      if (ms < 3600000) return Math.floor(ms / 60000) + 'p'
      if (ms < 86400000) return Math.floor(ms / 3600000) + 'h'
      return Math.floor(ms / 86400000) + 'd'
    },

    formatTimestamp(unixSec) {
      if (!unixSec) return '—'
      return new Date(unixSec * 1000).toLocaleString('vi-VN')
    },

    showToast(msg, color = 'green') {
      this.toast = { msg, color }
      setTimeout(() => { this.toast = null }, 3000)
    },

    timeAgo,
  }))

  // ============================================================
  // Level Up Template Section
  // ============================================================
  Alpine.data('levelUpTemplateSection', () => ({
    form: {
      title: '🎉 Level Up!',
      description: 'Chúc mừng **{user}** đã đạt **Level {level}**!',
      milestone_description: '🎊 Chúc mừng **{user}** đã đạt **Level {level}** và nhận được **{reward}**!',
      show_tier_field: true, show_xp_field: true, show_progress_field: true,
      show_role_reward: true, show_badge_reward: true, show_badge_image: true,
      show_avatar: true, mention_user: true,
      color_mode: 'custom', custom_color: '#6366f1',
    },
    rewards: [],
    roles: [],
    previewLevel: '10',
    testChannelId: '1503985277683761232',
    loading: false,
    saving: false,
    sending: false,
    toast: null,

    async init() {
      if (!checkAuth()) return
      await this.load()
    },

    async load() {
      this.loading = true
      const [tpl, rewards, roles] = await Promise.all([
        api('GET', '/level-up-template'),
        api('GET', '/rewards'),
        api('GET', '/discord/roles'),
      ])
      if (tpl) {
        // SQLite trả 0/1 cho boolean → convert
        this.form = {
          title: tpl.title,
          description: tpl.description,
          milestone_description: tpl.milestone_description,
          show_tier_field: !!tpl.show_tier_field,
          show_xp_field: !!tpl.show_xp_field,
          show_progress_field: !!tpl.show_progress_field,
          show_role_reward: !!tpl.show_role_reward,
          show_badge_reward: !!tpl.show_badge_reward,
          show_badge_image: !!tpl.show_badge_image,
          show_avatar: !!tpl.show_avatar,
          mention_user: !!tpl.mention_user,
          color_mode: tpl.color_mode || 'tier',
          custom_color: tpl.custom_color || '#6366f1',
        }
      }
      this.rewards = rewards || []
      this.roles = roles || []
      this.loading = false
    },

    async save() {
      this.saving = true
      try {
        const res = await api('PUT', '/level-up-template', this.form)
        if (res?.success) this.showToast('Đã lưu ✓', 'green')
        else this.showToast(res?.error || 'Lỗi', 'red')
      } catch (err) {
        this.showToast(err.message, 'red')
      }
      this.saving = false
    },

    async sendTest() {
      if (!this.testChannelId.trim()) {
        this.showToast('Vui lòng nhập Channel ID', 'red')
        return
      }
      this.sending = true
      try {
        const res = await api('POST', '/level-up-template/test', {
          channel_id: this.testChannelId.trim(),
          level: Number(this.previewLevel),
          template: this.form,
        })
        if (res?.success) this.showToast('Đã gửi test ✓ — kiểm tra channel Discord', 'green')
        else this.showToast(res?.error || 'Gửi thất bại', 'red')
      } catch (err) {
        this.showToast(err.message, 'red')
      }
      this.sending = false
    },

    // Cac level co reward → option preview
    get previewLevelOptions() {
      const levels = [...new Set(this.rewards.map(r => r.level_required))].sort((a, b) => a - b)
      const opts = levels.map(lv => ({ value: String(lv), label: `Level ${lv} (có reward)` }))
      // Thêm 1 level "thường" không reward để preview
      const firstNoReward = [1, 5, 15, 25].find(lv => !levels.includes(lv)) || 1
      opts.unshift({ value: String(firstNoReward), label: `Level ${firstNoReward} (không reward)` })
      return opts
    },

    get previewIsMilestone() {
      // Milestone = level co reward
      return this.rewards.some(r => r.level_required === Number(this.previewLevel))
    },

    get previewColor() {
      return this.form.custom_color || '#6366f1'
    },

    get previewXp() {
      return Number(this.previewLevel) * 1000
    },

    get previewRewardAtLevel() {
      return this.rewards.find(r => r.level_required === Number(this.previewLevel))
    },

    get previewBadge() {
      const r = this.previewRewardAtLevel
      return r && r.type === 'badge' ? r : null
    },

    get previewRoleName() {
      const r = this.previewRewardAtLevel
      if (!r) return null
      const roleId = r.role_id
      if (!roleId) return null
      const role = this.roles.find(x => x.id === roleId)
      return role ? role.name : null
    },

    // Ten reward de hien trong field "Phan thuong" + chen vao {reward}
    get previewRewardName() {
      const r = this.previewRewardAtLevel
      if (!r) return ''
      if (r.type === 'badge') return r.badge_name || 'Badge'
      if (r.type === 'role') return this.previewRoleName || 'Role'
      return ''
    },

    renderTpl(str) {
      if (!str) return ''
      return str
        .replace(/\{user\}/g, 'User_ABC')
        .replace(/\{level\}/g, this.previewLevel)
        .replace(/\{xp\}/g, this.previewXp.toLocaleString())
        .replace(/\{reward\}/g, this.previewRewardName)
        .replace(/\{tier(_badge)?\}/g, '')
    },

    showToast(msg, color = 'green') {
      this.toast = { msg, color }
      setTimeout(() => { this.toast = null }, 3000)
    },
  }))

  // ============================================================
  // Settings Section
  // ============================================================
  Alpine.data('settingsSection', () => ({
    form: { xp_min: 15, xp_max: 25, cooldown_seconds: 60, level_up_channel_id: '', level_up_reply_channel_id: '', allowed_role_ids: [] },
    roles: [],
    newRoleId: '',
    loading: false,
    saving: false,
    reloadingRoles: false,
    toast: null,

    async init() {
      this.loading = true
      const [data, roles] = await Promise.all([
        api('GET', '/settings'),
        api('GET', '/discord/roles'),
      ])
      if (data) {
        this.form = {
          xp_min: data.xp_min,
          xp_max: data.xp_max,
          cooldown_seconds: data.cooldown_seconds,
          level_up_channel_id: data.level_up_channel_id || '',
          level_up_reply_channel_id: data.level_up_reply_channel_id || '',
          allowed_role_ids: Array.isArray(data.allowed_role_ids) ? data.allowed_role_ids : [],
        }
      }
      this.roles = roles || []
      this.loading = false
    },

    async reloadRoles() {
      this.reloadingRoles = true
      try {
        const roles = await api('GET', '/discord/roles')
        this.roles = roles || []
        this.showToast('Đã làm mới danh sách role ✓', 'green')
      } catch (err) {
        this.showToast(err.message || 'Lỗi làm mới role', 'red')
      }
      this.reloadingRoles = false
    },

    get availableRoles() {
      return this.roles.filter(r => !this.form.allowed_role_ids.includes(r.id))
    },

    roleName(roleId) {
      const r = this.roles.find(x => x.id === roleId)
      return r ? r.name : roleId
    },

    addAllowedRole() {
      if (!this.newRoleId) return
      if (!this.form.allowed_role_ids.includes(this.newRoleId)) {
        this.form.allowed_role_ids.push(this.newRoleId)
      }
      this.newRoleId = ''
    },

    removeAllowedRole(roleId) {
      this.form.allowed_role_ids = this.form.allowed_role_ids.filter(r => r !== roleId)
    },

    async save() {
      this.saving = true
      try {
        const res = await api('PUT', '/settings', this.form)
        if (res?.success) this.showToast('Đã lưu cài đặt ✓', 'green')
        else this.showToast(res?.error || 'Lỗi', 'red')
      } catch (err) {
        this.showToast(err.message, 'red')
      }
      this.saving = false
    },

    showToast(msg, color = 'green') {
      this.toast = { msg, color }
      setTimeout(() => { this.toast = null }, 3000)
    },
  }))

  // ============================================================
  // Commands Section
  // ============================================================
  Alpine.data('commandsSection', () => ({
    commands: [],
    loading: false,
    search: '',
    collapsed: {}, // map group name -> true if collapsed

    async init() {
      await this.load()
    },

    async load() {
      this.loading = true
      this.commands = await api('GET', '/commands') || []
      this.loading = false
    },

    // Lọc command theo từ khóa: khớp tên, mô tả, hoặc tên tham số.
    _matchesSearch(cmd) {
      const q = this.search.trim().toLowerCase()
      if (!q) return true
      if (cmd.name && cmd.name.toLowerCase().includes(q)) return true
      if (cmd.description && cmd.description.toLowerCase().includes(q)) return true
      if (Array.isArray(cmd.options)) {
        for (const opt of cmd.options) {
          if (opt.name && opt.name.toLowerCase().includes(q)) return true
          if (opt.description && opt.description.toLowerCase().includes(q)) return true
        }
      }
      return false
    },

    // Group commands by prefix (text before the first dash).
    // Groups with only 1 command fall into "Khác".
    // Returns: [{ name, items }, ...] then { name: 'Khác', items } if any
    get groupedCommands() {
      const filtered = this.commands.filter(c => this._matchesSearch(c))
      const byPrefix = new Map()
      filtered.forEach(c => {
        const prefix = (c.name.split('-')[0] || c.name).toLowerCase()
        if (!byPrefix.has(prefix)) byPrefix.set(prefix, [])
        byPrefix.get(prefix).push(c)
      })
      const groups = []
      const others = []
      for (const [prefix, items] of byPrefix.entries()) {
        if (items.length > 1) {
          items.sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name))
          groups.push({ name: prefix, items })
        } else {
          others.push(items[0])
        }
      }
      groups.sort((a, b) => a.name.localeCompare(b.name))
      if (others.length > 0) {
        others.sort((a, b) => a.name.localeCompare(b.name))
        groups.push({ name: 'Khác', items: others })
      }
      return groups
    },

    // Khi đang tìm kiếm thì luôn mở rộng để xem kết quả.
    isExpanded(groupName) {
      if (this.search.trim()) return true
      return !this.collapsed[groupName]
    },

    toggleGroup(groupName) {
      if (this.search.trim()) return // bỏ qua khi đang tìm kiếm
      this.collapsed[groupName] = !this.collapsed[groupName]
    },

    expandAll() {
      this.collapsed = {}
    },

    collapseAll() {
      const next = {}
      for (const g of this.groupedCommands) next[g.name] = true
      this.collapsed = next
    },

    optionTypeName(type) {
      const types = { 3: 'text', 4: 'integer', 5: 'boolean', 6: 'user', 7: 'channel',
        8: 'role', 9: 'mentionable', 10: 'number', 11: 'attachment' }
      return types[type] || 'option'
    },
  }))

  // ============================================================
  // Servers Section
  // ============================================================
  Alpine.data('serversSection', () => ({
    servers: [],
    loading: false,

    async init() {
      await this.load()
    },

    async load() {
      this.loading = true
      this.servers = await api('GET', '/servers') || []
      this.loading = false
    },
  }))

  // ============================================================
  // Links Section
  // ============================================================
  Alpine.data('linksSection', () => ({
    links: [],
    channels: [],
    total: 0,
    page: 1,
    limit: 20,
    search: '',
    channelFilter: '',
    loading: false,
    toast: null,
    _searchTimer: null,
    selected: [], // danh sách id link đang được chọn để xóa hàng loạt

    async init() {
      await this.load()
    },

    async load() {
      this.loading = true
      const params = new URLSearchParams({ search: this.search, channel_id: this.channelFilter, page: this.page, limit: this.limit })
      const data = await api('GET', `/links?${params}`)
      if (data) {
        this.links = data.links || []
        this.total = data.total || 0
        this.channels = data.channels || []
        this.page = data.page || 1
      }
      this.selected = [] // reset chọn khi đổi trang/lọc
      this.loading = false
    },

    onSearchInput() {
      clearTimeout(this._searchTimer)
      this._searchTimer = setTimeout(() => { this.page = 1; this.load() }, 350)
    },

    onFilterChange() {
      this.page = 1
      this.load()
    },

    onLimitChange() {
      this.page = 1
      this.load()
    },

    prevPage() {
      if (this.page > 1) { this.page--; this.load() }
    },

    nextPage() {
      if (this.page * this.limit < this.total) { this.page++; this.load() }
    },

    goPage(p) {
      if (p < 1 || p > this.totalPages || p === this.page) return
      this.page = p
      this.load()
    },

    get totalPages() {
      return Math.max(1, Math.ceil(this.total / this.limit))
    },

    // Mảng các số trang hiển thị, thêm '...' khi quá nhiều trang
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

    // Trạng thái checkbox "chọn tất cả"
    get allChecked() {
      return this.links.length > 0 && this.selected.length === this.links.length
    },

    toggleAll(e) {
      this.selected = e.target.checked ? this.links.map((l) => l.id) : []
    },

    toggleOne(id) {
      const i = this.selected.indexOf(id)
      if (i === -1) this.selected.push(id)
      else this.selected.splice(i, 1)
    },

    async deleteSelected() {
      if (this.selected.length === 0) return
      if (!confirm(`Xóa ${this.selected.length} link đã chọn?`)) return
      const res = await api('DELETE', '/links', { ids: this.selected })
      if (res?.success) {
        this.showToast(`Đã xóa ${res.deleted} link`, 'green')
        this.selected = []
        await this.load()
      }
    },

    getDomain(url) {
      try { return new URL(url).hostname.replace('www.', '') } catch (_) { return url }
    },

    getFaviconUrl(url) {
      try { const u = new URL(url); return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32` } catch (_) { return null }
    },

    truncateUrl(url, max = 70) {
      return url.length > max ? url.slice(0, max) + '…' : url
    },

    async copyUrl(url) {
      try {
        await navigator.clipboard.writeText(url)
        this.showToast('Đã copy link ✓', 'green')
      } catch (_) {
        this.showToast('Không thể copy', 'red')
      }
    },

    async deleteLink(link) {
      if (!confirm(`Xóa link này?\n${link.url}`)) return
      const res = await api('DELETE', `/links/${link.id}`)
      if (res?.success) {
        this.links = this.links.filter((l) => l.id !== link.id)
        this.total--
        this.showToast('Đã xóa link', 'green')
      }
    },

    showToast(msg, color = 'green') {
      this.toast = { msg, color }
      setTimeout(() => { this.toast = null }, 3000)
    },

    timeAgo,
  }))

  // ============================================================
  // Welcome Template Section (chao mung member moi)
  // ============================================================
  Alpine.data('welcomeTemplateSection', () => ({
    form: {
      enabled: true,
      message: 'Chào mừng {user} đã tham gia server! 🎉 Hãy giới thiệu bản thân và làm quen với mọi người nhé.',
    },
    replyChannelId: '',
    testChannelId: '',
    loading: false,
    saving: false,
    sending: false,
    toast: null,

    async init() {
      if (!checkAuth()) return
      await this.load()
    },

    async load() {
      this.loading = true
      const [tpl, settings] = await Promise.all([
        api('GET', '/welcome-template'),
        api('GET', '/settings'),
      ])
      if (tpl) this.form = { enabled: !!tpl.enabled, message: tpl.message || '' }
      this.replyChannelId = settings?.level_up_reply_channel_id || ''
      if (!this.testChannelId) this.testChannelId = this.replyChannelId
      this.loading = false
    },

    insertVar(v) {
      this.form.message = (this.form.message || '') + v
    },

    async save() {
      this.saving = true
      try {
        const res = await api('PUT', '/welcome-template', this.form)
        if (res?.success) this.showToast('Đã lưu ✓', 'green')
        else this.showToast(res?.error || 'Lỗi', 'red')
      } catch (err) {
        this.showToast(err.message, 'red')
      }
      this.saving = false
    },

    async sendTest() {
      const ch = (this.testChannelId || this.replyChannelId || '').trim()
      if (!ch) {
        this.showToast('Vui lòng nhập Channel ID hoặc cấu hình "Channel auto-reply khi lên cấp"', 'red')
        return
      }
      this.sending = true
      try {
        const res = await api('POST', '/welcome-template/test', {
          channel_id: ch,
          message: this.form.message,
        })
        if (res?.success) this.showToast('Đã gửi test ✓', 'green')
        else this.showToast(res?.error || 'Gửi thất bại', 'red')
      } catch (err) {
        this.showToast(err.message, 'red')
      }
      this.sending = false
    },

    get previewHtml() {
      const escaped = (this.form.message || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      return escaped
        .replace(/\{user\}/g, '<span style="color:#5865f2;background:#5865f21a;padding:0 2px;border-radius:3px">@TenThanhVien</span>')
        .replace(/\{username\}/g, '<span style="color:#5865f2">TenThanhVien</span>')
        .replace(/\{server\}/g, '<span style="color:#5865f2">TênServer</span>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>')
    },

    showToast(msg, color = 'green') {
      this.toast = { msg, color }
      setTimeout(() => { this.toast = null }, 3000)
    },
  }))

  // ============================================================
  // Tier Flair Config Section
  // ============================================================
  Alpine.data('flairConfigSection', () => ({
    tiers: [],
    flairRoles: [], // Danh sach role Discord cho mode='role'
    loading: false,
    sending: false,
    toast: null,
    testChannelId: localStorage.getItem('flair_test_channel_id') || '',
    testTier: 10,

    async init() {
      if (!checkAuth()) return
      await this.load()
    },

    async load() {
      this.loading = true
      const [res, roles] = await Promise.all([
        api('GET', '/flair-config'),
        api('GET', '/discord/roles'),
      ])
      this.flairRoles = roles || []
      this.tiers = (res?.tiers || []).map(t => ({
        ...t,
        input_mode: t.mode || 'emoji',
        input_badge: t.custom_badge || '',
        input_role_id: t.role_id || '',
        saving: false,
        uploading: false,
      }))
      this.loading = false
    },

    async saveTier(t) {
      t.saving = true
      try {
        let payload
        if (t.input_mode === 'role') {
          if (!t.input_role_id) {
            this.showToast('Cần chọn role', 'red')
            t.saving = false
            return
          }
          payload = { mode: 'role', role_id: t.input_role_id }
        } else {
          const badge = (t.input_badge || '').trim()
          if (!badge) {
            this.showToast('Cần nhập emoji', 'red')
            t.saving = false
            return
          }
          payload = { mode: 'emoji', badge }
        }
        const res = await api('PUT', `/flair-config/${t.min_level}`, payload)
        if (res?.success) {
          this.showToast(`Đã lưu ${t.name} ✓`, 'green')
          await this.load()
        } else {
          this.showToast(res?.error || 'Lưu thất bại', 'red')
        }
      } catch (err) {
        this.showToast(err.message, 'red')
      }
      t.saving = false
    },

    async uploadIcon(event, t) {
      const file = event.target.files[0]
      if (!file) return
      if (!t.input_role_id) {
        this.showToast('Cần chọn role trước rồi mới upload icon', 'red')
        event.target.value = ''
        return
      }
      t.uploading = true
      const fd = new FormData()
      fd.append('image', file)
      fd.append('min_level', String(t.min_level))
      fd.append('role_id', t.input_role_id)
      try {
        const res = await api('POST', '/flair-config/upload-icon', fd)
        if (res?.success) {
          this.showToast(`Đã upload + push icon role ✓`, 'green')
          await this.load()
        } else if (res?.saved) {
          // Config DA luu DB nhung Discord PATCH that bai (vd thieu Boost L2)
          const hint = res?.hint ? `\n💡 ${res.hint}` : ''
          this.showToast(`⚠️ Đã lưu config (mode=role). Discord chưa nhận icon: ${res?.error || ''}${hint}`, 'amber')
          await this.load()
        } else {
          const hint = res?.hint ? `\n💡 ${res.hint}` : ''
          this.showToast((res?.error || 'Upload thất bại') + hint, 'red')
        }
      } catch (err) {
        this.showToast(err.message, 'red')
      }
      t.uploading = false
      event.target.value = ''
    },

    async resetTier(t) {
      if (!confirm(`Reset tier ${t.name} về badge mặc định?`)) return
      try {
        const res = await api('DELETE', `/flair-config/${t.min_level}`)
        if (res?.success) {
          this.showToast(`Đã reset ${t.name} ✓`, 'green')
          await this.load()
        }
      } catch (err) {
        this.showToast(err.message, 'red')
      }
    },

    async resetAll() {
      if (!confirm('Reset TẤT CẢ tier về badge mặc định?')) return
      try {
        const res = await api('DELETE', '/flair-config/all')
        if (res?.success) {
          this.showToast('Đã reset tất cả ✓', 'green')
          await this.load()
        }
      } catch (err) {
        this.showToast(err.message, 'red')
      }
    },

    async sendTest() {
      if (!this.testChannelId.trim()) {
        this.showToast('Vui lòng nhập Channel ID', 'red')
        return
      }
      localStorage.setItem('flair_test_channel_id', this.testChannelId.trim())
      this.sending = true
      try {
        const res = await api('POST', '/flair-config/test', {
          channel_id: this.testChannelId.trim(),
          min_level: this.testTier,
        })
        if (res?.success) this.showToast(`Đã gửi test ✓ Mẫu: ${res.sample_nick}`, 'green')
        else this.showToast(res?.error || 'Gửi thất bại', 'red')
      } catch (err) {
        this.showToast(err.message, 'red')
      }
      this.sending = false
    },

    showToast(msg, color = 'green') {
      this.toast = { msg, color }
      setTimeout(() => { this.toast = null }, 3000)
    },
  }))
})
