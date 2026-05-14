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

    async init() {
      await this.load()
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
      if (!confirm(`Reset XP cua ${name}?`)) return
      await api('DELETE', `/members/${member.id}/xp`)
      member.xp = 0
      member.level = 0
      this.showToast('Da reset XP', 'green')
    },

    async deleteMember(member) {
      const name = member.nickname || member.global_name || member.username || member.id
      if (!confirm(`Xoa han record cua ${name} (${member.id})?\nHanh dong nay khong the hoan tac.`)) return
      const res = await api('DELETE', `/members/${member.id}`)
      if (res && res.success) {
        this.members = this.members.filter((m) => m.id !== member.id)
        this.showToast('Da xoa record', 'green')
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
      const opts = levels.map(lv => ({ value: String(lv), label: `Level ${lv} (co reward)` }))
      // Them 1 level "thuong" khong reward de preview
      const firstNoReward = [1, 5, 15, 25].find(lv => !levels.includes(lv)) || 1
      opts.unshift({ value: String(firstNoReward), label: `Level ${firstNoReward} (khong reward)` })
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
    form: { xp_min: 15, xp_max: 25, cooldown_seconds: 60, level_up_channel_id: '' },
    loading: false,
    saving: false,
    toast: null,

    async init() {
      this.loading = true
      const data = await api('GET', '/settings')
      if (data) this.form = { ...data }
      this.loading = false
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

    async init() {
      await this.load()
    },

    async load() {
      this.loading = true
      this.commands = await api('GET', '/commands') || []
      this.loading = false
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
    limit: 50,
    search: '',
    channelFilter: '',
    loading: false,
    toast: null,
    _searchTimer: null,

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

    prevPage() {
      if (this.page > 1) { this.page--; this.load() }
    },

    nextPage() {
      if (this.page * this.limit < this.total) { this.page++; this.load() }
    },

    get totalPages() {
      return Math.max(1, Math.ceil(this.total / this.limit))
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
      if (!confirm(`Xoá link này?\n${link.url}`)) return
      const res = await api('DELETE', `/links/${link.id}`)
      if (res?.success) {
        this.links = this.links.filter((l) => l.id !== link.id)
        this.total--
        this.showToast('Đã xoá link', 'green')
      }
    },

    showToast(msg, color = 'green') {
      this.toast = { msg, color }
      setTimeout(() => { this.toast = null }, 3000)
    },

    timeAgo,
  }))
})
