// Alpine component cho tab Worldcup.
// API helper voi JWT, 401 -> redirect /login.html via window.top

function getToken() { return localStorage.getItem('token') }

async function api(method, path, body) {
  const token = getToken()
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const r = await fetch(path, opts)
  if (r.status === 401) {
    localStorage.removeItem('token')
    try { window.top.location.href = '/login.html' } catch (_) { window.location.href = '/login.html' }
    throw new Error('Unauthorized')
  }
  if (!r.ok) {
    let msg = `HTTP ${r.status}`
    try { msg = (await r.json()).error || msg } catch (_) {}
    throw new Error(msg)
  }
  return r.json()
}

const ROUND_LABELS = {
  group: 'Vòng bảng',
  r32: 'Vòng 1/16',
  r16: 'Vòng 1/8',
  qf: 'Tứ kết',
  sf: 'Bán kết',
  '3rd': 'Tranh hạng 3',
  final: 'Chung kết',
}

const ROUND_TABS = [
  { key: 'group', label: 'Vòng bảng' },
  { key: 'r32', label: 'Vòng 1/16' },
  { key: 'r16', label: 'Vòng 1/8' },
  { key: 'qf', label: 'Tứ kết' },
  { key: 'sf', label: 'Bán kết' },
  { key: '3rd', label: 'Tranh hạng 3' },
  { key: 'final', label: 'Chung kết' },
]

function worldcupTab() {
  return {
    // state
    teams: [],
    matches: [],
    channels: [],
    roles: [],
    config: { enabled: false, channel_id: '', notify_before_minutes: 30, role_ping_id: '', timezone: 'Asia/Saigon' },
    newMatch: { team1Id: '', team2Id: '', kickOffLocal: '', round: 'group', groupName: '' },
    editingTeam: null,
    editingMatch: null,
    filterRound: 'group',
    filterDate: '',
    roundTabs: ROUND_TABS,
    allMatchesCount: {},
    page: 1,
    pageSize: 10,
    saveStatus: '',
    saveStatusClass: '',

    // Filter: theo vong dau + theo ngay (timezone trong config)
    get filteredMatches() {
      let list = this.matches
      if (this.filterRound) list = list.filter(m => m.round === this.filterRound)
      if (this.filterDate) {
        const tz = this.config.timezone || 'Asia/Saigon'
        const fmt = new Intl.DateTimeFormat('en-CA', {
          year: 'numeric', month: '2-digit', day: '2-digit', timeZone: tz,
        })
        list = list.filter(m => fmt.format(new Date(m.kick_off_at)) === this.filterDate)
      }
      return list
    },
    countByRound(round) {
      return this.matches.filter(m => m.round === round).length
    },
    get activeRoundLabel() {
      return ROUND_LABELS[this.filterRound] || this.filterRound
    },
    seedTooltip(round) {
      if (round === 'group') return 'Import 72 trận vòng bảng WC 2026 (parse từ lịch phát sóng VTV)'
      if (round === 'r32') return 'Import 16 trận Vòng 1/16 WC 2026 (parse từ lịch phát sóng VTV)'
      if (round === 'r16') return 'Import 6 trận Vòng 1/8 WC 2026 (parse từ lịch phát sóng VTV — thiếu 2 trận 89/90)'
      return 'Chưa có dữ liệu lịch ' + (ROUND_LABELS[round] || round) + ' — cần ảnh lịch để cập nhật'
    },
    get totalPages() {
      return Math.max(1, Math.ceil(this.filteredMatches.length / this.pageSize))
    },
    get pagedMatches() {
      const start = (this.page - 1) * this.pageSize
      return this.filteredMatches.slice(start, start + this.pageSize)
    },

    async init() {
      await this.loadAll()
    },

    async loadAll() {
      try {
        const [teams, matches, channels, roles, config] = await Promise.all([
          api('GET', '/api/worldcup/teams'),
          api('GET', '/api/worldcup/matches'),
          api('GET', '/api/discord/channels').catch(() => []),
          api('GET', '/api/discord/roles').catch(() => []),
          api('GET', '/api/worldcup/config'),
        ])
        this.teams = teams
        this.matches = matches
        this.channels = (channels || []).filter(c => c.type === 'text')
        this.roles = roles || []
        this.config = {
          enabled: !!config.enabled,
          channel_id: config.channel_id || '',
          notify_before_minutes: config.notify_before_minutes || 30,
          role_ping_id: config.role_ping_id || '',
          timezone: config.timezone || 'Asia/Saigon',
        }
      } catch (err) {
        this.flash(err.message, false)
      }
    },

    async loadMatches() {
      try {
        // Load tat ca matches, filter client-side (cho count per round + tab switching nhanh)
        this.matches = await api('GET', '/api/worldcup/matches')
        if (this.page > this.totalPages) this.page = this.totalPages
      } catch (err) { this.flash(err.message, false) }
    },

    // Seed cho round hien tai. Group + r32 da co data; cac round khac stub.
    async seedRound(round) {
      if (round === 'group') return this.seedWC2026()
      if (round === 'r32') return this.seedRoundFromImage('r32', 'Vòng 1/16', 16)
      if (round === 'r16') return this.seedRoundFromImage('r16', 'Vòng 1/8', 6)
      this.flash('Chưa có dữ liệu lịch ' + (ROUND_LABELS[round] || round) + ' — gửi ảnh để cập nhật', false)
    },

    async seedRoundFromImage(round, label, total) {
      if (!confirm(`Nhập lịch ${label} WC 2026 (${total} trận, parse từ lịch phát sóng VTV).\n\nTrận đã tồn tại cùng giờ + cùng cặp đội sẽ tự skip.\n\nTiếp tục?`)) return
      try {
        const result = await api('POST', '/api/worldcup/seed-wc2026', { round })
        let msg = `Đã import ${result.inserted}/${result.total} trận (skip ${result.skipped} trùng)`
        if (result.missingCodes?.length) msg += `, thiếu code: ${result.missingCodes.join(',')}`
        this.flash(msg, true)
        await this.loadMatches()
      } catch (err) { this.flash(err.message, false) }
    },

    // ===== Config =====
    async saveConfig() {
      try {
        await api('PUT', '/api/worldcup/config', {
          enabled: this.config.enabled,
          channel_id: this.config.channel_id || null,
          notify_before_minutes: this.config.notify_before_minutes,
          role_ping_id: this.config.role_ping_id || null,
          timezone: this.config.timezone,
        })
        this.flash('Đã lưu cấu hình', true)
      } catch (err) { this.flash(err.message, false) }
    },

    async testSend() {
      if (!this.config.channel_id) { this.flash('Chọn channel trước', false); return }
      // Lưu config trước rồi test send (đảm bảo dùng config mới nhất)
      try {
        await this.saveConfig()
        await api('POST', '/api/worldcup/test-send')
        this.flash('Đã gửi tin test', true)
      } catch (err) { this.flash(err.message, false) }
    },

    async seedWC2026() {
      if (!confirm('Nhập lịch vòng bảng WC 2026 (72 trận, parse từ lịch phát sóng VTV — best-effort).\n\nTrận đã tồn tại cùng giờ + cùng cặp đội sẽ tự skip.\n\nTiếp tục?')) return
      try {
        const result = await api('POST', '/api/worldcup/seed-wc2026')
        let msg = `Đã import ${result.inserted}/${result.total} trận (skip ${result.skipped} trùng)`
        if (result.missingCodes?.length) msg += `, thiếu code: ${result.missingCodes.join(',')}`
        this.flash(msg, true)
        await this.loadMatches()
      } catch (err) { this.flash(err.message, false) }
    },

    async wipeAll() {
      const answer = prompt(
        'CẢNH BÁO: Hành động này sẽ xoá toàn bộ trận đấu, log thông báo và cấu hình thông báo Worldcup.\n' +
        '48 đội seed sẵn sẽ được giữ lại.\n\n' +
        'Gõ "XOA" (không dấu, in hoa) để xác nhận:'
      )
      if (answer !== 'XOA') {
        if (answer != null) this.flash('Đã huỷ — xác nhận không khớp', false)
        return
      }
      try {
        const result = await api('POST', '/api/worldcup/wipe-all', { confirm: 'XOA' })
        this.flash(`Đã xoá ${result.deleted.matches} trận, ${result.deleted.logs} log, ${result.deleted.configs} config`, true)
        await this.loadAll()
      } catch (err) { this.flash(err.message, false) }
    },

    async testSendMatch(m) {
      if (!this.config.channel_id) { this.flash('Cấu hình channel trước', false); return }
      if (!confirm(`Gửi thử thông báo trận ${m.team1_name} vs ${m.team2_name}?`)) return
      try {
        await api('POST', '/api/worldcup/test-send', { matchId: m.id })
        this.flash(`Đã gửi: ${m.team1_name} vs ${m.team2_name}`, true)
      } catch (err) { this.flash(err.message, false) }
    },

    // ===== Teams =====
    openCreateTeam() { this.editingTeam = { code: '', name: '' } },
    openEditTeam(t) { this.editingTeam = { ...t } },

    async saveTeam() {
      const t = this.editingTeam
      if (!t.code || !t.name) { this.flash('code và name bắt buộc', false); return }
      try {
        if (t.id) {
          await api('PATCH', `/api/worldcup/teams/${t.id}`, { code: t.code, name: t.name })
          this.flash('Đã cập nhật đội', true)
        } else {
          await api('POST', '/api/worldcup/teams', { code: t.code, name: t.name })
          this.flash('Đã thêm đội', true)
        }
        this.editingTeam = null
        await this.loadAll()
      } catch (err) { this.flash(err.message, false) }
    },

    async deleteTeam(t) {
      if (!confirm(`Xoá đội ${t.name}?`)) return
      try {
        await api('DELETE', `/api/worldcup/teams/${t.id}`)
        this.editingTeam = null
        this.flash('Đã xoá đội', true)
        await this.loadAll()
      } catch (err) { this.flash(err.message, false) }
    },

    // ===== Matches =====
    async createMatch() {
      const m = this.newMatch
      if (!m.team1Id || !m.team2Id) { this.flash('Chọn 2 đội', false); return }
      if (m.team1Id === m.team2Id) { this.flash('2 đội phải khác nhau', false); return }
      if (!m.kickOffLocal) { this.flash('Nhập giờ kick-off', false); return }
      const kickOffAt = new Date(m.kickOffLocal).getTime()
      if (isNaN(kickOffAt)) { this.flash('Giờ kick-off không hợp lệ', false); return }
      if (m.round === 'group' && !/^[A-Ha-h]$/.test(m.groupName || '')) { this.flash('Bảng phải là A-H', false); return }
      try {
        await api('POST', '/api/worldcup/matches', {
          team1Id: m.team1Id, team2Id: m.team2Id, kickOffAt, round: m.round,
          groupName: m.round === 'group' ? m.groupName : null,
        })
        this.flash('Đã tạo trận đấu', true)
        this.newMatch = { team1Id: '', team2Id: '', kickOffLocal: '', round: 'group', groupName: '' }
        await this.loadMatches()
      } catch (err) { this.flash(err.message, false) }
    },

    openEditMatch(m) {
      // Convert UTC ms -> datetime-local string YYYY-MM-DDTHH:mm
      const d = new Date(m.kick_off_at)
      const pad = (n) => String(n).padStart(2, '0')
      const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
      this.editingMatch = { ...m, _kickOffLocal: local }
    },

    async saveMatch() {
      const m = this.editingMatch
      const kickOffAt = new Date(m._kickOffLocal).getTime()
      if (isNaN(kickOffAt)) { this.flash('Giờ kick-off không hợp lệ', false); return }
      try {
        await api('PATCH', `/api/worldcup/matches/${m.id}`, {
          team1Id: m.team1_id, team2Id: m.team2_id, kickOffAt,
          round: m.round, groupName: m.round === 'group' ? m.group_name : null,
          status: m.status,
        })
        this.flash('Đã cập nhật trận đấu', true)
        this.editingMatch = null
        await this.loadMatches()
      } catch (err) { this.flash(err.message, false) }
    },

    async deleteMatch(m) {
      if (!confirm(`Xoá trận ${m.team1_name} vs ${m.team2_name}?`)) return
      try {
        await api('DELETE', `/api/worldcup/matches/${m.id}`)
        this.flash('Đã xoá trận đấu', true)
        await this.loadMatches()
      } catch (err) { this.flash(err.message, false) }
    },

    // ===== Helpers =====
    roundLabel(m) {
      const base = ROUND_LABELS[m.round] || m.round
      return m.round === 'group' && m.group_name ? `${base} ${m.group_name}` : base
    },

    // Format theo timezone da chon trong config (24h)
    formatLocalDateTime(unixMs) {
      const tz = this.config.timezone || 'Asia/Saigon'
      return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit',
        hour12: false, timeZone: tz,
      }).format(new Date(unixMs)).replace(',', '')
    },

    formatUtcDateTime(unixMs) {
      return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit',
        hour12: false, timeZone: 'UTC',
      }).format(new Date(unixMs)).replace(',', '')
    },

    flash(msg, ok) {
      this.saveStatus = msg
      this.saveStatusClass = ok ? 'text-emerald-600' : 'text-red-600'
      setTimeout(() => { this.saveStatus = '' }, 3000)
    },
  }
}

window.worldcupTab = worldcupTab
