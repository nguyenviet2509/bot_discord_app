// BlessCastle dashboard tab logic.

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

function flashSave(text, ok = true) {
  const el = document.getElementById('saveStatus')
  el.textContent = text
  el.className = 'text-sm ' + (ok ? 'text-emerald-600' : 'text-red-600')
  setTimeout(() => { el.textContent = '' }, 2500)
}

function fmtDate(unix) {
  if (!unix) return '—'
  const d = new Date(unix * 1000)
  return d.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Client-side check: T2 -> T6 truoc 19h Saigon
function isInManualWindow() {
  const now = new Date()
  const s = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + 7 * 3600000)
  const dow = s.getDay() || 7
  const hour = s.getHours()
  if (dow < 1 || dow > 5) return false
  if (dow === 5 && hour >= 19) return false
  return true
}

const state = {
  config: null,
  allVoiceChannels: [],
  members: [],
  filtered: [],
  weekKey: '',
  currentWeek: '',
  isCurrentWeek: true,
  minMinutes: 30,
  search: '',
  weeks: [],
  selectedWeek: '',
  history: { page: 1, pageSize: 20, total: 0, rows: [] },
}

async function loadAll() {
  try {
    const [cfg, chs, weeks] = await Promise.all([
      api('GET', '/api/blesscastle/config'),
      api('GET', '/api/blesscastle/voice-channels'),
      api('GET', '/api/blesscastle/weeks?limit=20'),
    ])
    state.config = cfg
    state.allVoiceChannels = chs
    state.weeks = weeks
    if (!state.selectedWeek) state.selectedWeek = weeks[0]?.weekKey || ''
    renderConfig()
    renderChannelSelect()
    renderChannelChips()
    renderWeekSelect()
    await Promise.all([
      loadMembersForWeek(state.selectedWeek),
      reloadHistory(),
    ])
  } catch (e) {
    flashSave(`Lỗi tải dữ liệu: ${e.message}`, false)
  }
}

async function loadMembersForWeek(weekKey) {
  try {
    const q = weekKey ? `?weekKey=${encodeURIComponent(weekKey)}` : ''
    const mem = await api('GET', `/api/blesscastle/members${q}`)
    state.members = mem.members
    state.weekKey = mem.weekKey
    state.currentWeek = mem.currentWeek
    state.isCurrentWeek = mem.isCurrentWeek
    state.minMinutes = mem.minMinutes
    renderMembers()
    document.getElementById('weekBadge').textContent = state.isCurrentWeek ? 'Tuần hiện tại' : 'Tuần đã qua (chỉ xem)'
    document.getElementById('weekBadge').className = state.isCurrentWeek
      ? 'text-xs text-emerald-600 font-medium'
      : 'text-xs text-slate-500 italic'
  } catch (e) {
    flashSave(`Lỗi tải thành viên: ${e.message}`, false)
  }
}

function renderWeekSelect() {
  const sel = document.getElementById('weekSelect')
  sel.innerHTML = state.weeks.map(w => {
    const isCurrent = w.weekKey === state.currentWeek || (!state.currentWeek && state.weeks[0]?.weekKey === w.weekKey)
    const suffix = w.total > 0 ? ` (${w.total} người, ${w.manualCount} tick)` : ''
    return `<option value="${w.weekKey}"${w.weekKey === state.selectedWeek ? ' selected' : ''}>Tuần ${w.weekKey}${isCurrent ? ' — hiện tại' : ''}${suffix}</option>`
  }).join('')
  sel.onchange = () => {
    state.selectedWeek = sel.value
    loadMembersForWeek(state.selectedWeek)
  }
}

// ============ Config ============

function renderConfig() {
  const c = state.config
  document.getElementById('minMinutes').value = c.minMinutes
  document.getElementById('startHour').value = c.sessionStartHour
  document.getElementById('endHour').value = c.sessionEndHour
  const t = document.getElementById('enabledToggle')
  t.classList.toggle('on', !!c.enabled)
}

function renderChannelChips() {
  const wrap = document.getElementById('channelChips')
  const selected = state.config.voiceChannelIds || []
  if (selected.length === 0) {
    wrap.innerHTML = '<span class="text-xs text-slate-400 italic">Chưa chọn channel nào</span>'
    return
  }
  wrap.innerHTML = selected.map(id => {
    const ch = state.allVoiceChannels.find(c => c.id === id)
    const name = ch ? ch.name : id
    return `<span class="chip">🔊 ${escapeHtml(name)}<span class="x" data-id="${id}">×</span></span>`
  }).join('')
  wrap.querySelectorAll('.x').forEach(el => {
    el.onclick = () => {
      state.config.voiceChannelIds = state.config.voiceChannelIds.filter(x => x !== el.dataset.id)
      renderChannelChips()
      renderChannelSelect()
    }
  })
}

function renderChannelSelect() {
  const sel = document.getElementById('channelSelect')
  const selected = new Set(state.config.voiceChannelIds || [])
  const available = state.allVoiceChannels.filter(c => !selected.has(c.id))
  sel.innerHTML = '<option value="">-- Thêm voice channel --</option>' +
    available.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')
  sel.onchange = () => {
    if (!sel.value) return
    state.config.voiceChannelIds = [...(state.config.voiceChannelIds || []), sel.value]
    sel.value = ''
    renderChannelChips()
    renderChannelSelect()
  }
}

document.getElementById('enabledToggle').addEventListener('click', () => {
  state.config.enabled = !state.config.enabled
  renderConfig()
})

document.getElementById('saveConfigBtn').addEventListener('click', async () => {
  const btn = document.getElementById('saveConfigBtn')
  btn.disabled = true
  try {
    const payload = {
      voiceChannelIds: state.config.voiceChannelIds || [],
      minMinutes: parseInt(document.getElementById('minMinutes').value) || 30,
      sessionStartHour: parseInt(document.getElementById('startHour').value),
      sessionEndHour: parseInt(document.getElementById('endHour').value),
      enabled: !!state.config.enabled,
    }
    const cfg = await api('PUT', '/api/blesscastle/config', payload)
    state.config = cfg
    state.minMinutes = cfg.minMinutes
    renderConfig()
    renderMembers() // re-render vi threshold thay doi
    flashSave('Đã lưu ✓')
  } catch (e) {
    flashSave(`Lỗi: ${e.message}`, false)
  } finally {
    btn.disabled = false
  }
})

// ============ Members ============

function renderMembers() {
  const q = state.search.toLowerCase().trim()
  const filtered = q
    ? state.members.filter(m => m.username.toLowerCase().includes(q) || m.userId.includes(q))
    : state.members
  state.filtered = filtered

  const tbody = document.getElementById('membersTbody')
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-slate-400 py-8">Không có thành viên</td></tr>'
    return
  }

  // Cho phep tick bat cu luc nao trong tuan hien tai (Mon-Sun ISO week).
  // Sau finalize, tick van hoat dong va tu auto-award +1 sao neu user chua duoc award.
  const canTick = state.isCurrentWeek
  const inWindow = canTick
  const canRedeemGlobal = state.isCurrentWeek
  const minSec = state.minMinutes * 60

  tbody.innerHTML = filtered.map(m => {
    const w = m.thisWeek
    const pct = Math.min(100, Math.round((w.voiceSeconds / minSec) * 100))
    const progressText = w.attendedManual
      ? '<span class="badge-ok">✓ Điểm danh thủ công</span>'
      : w.achieved
        ? `<span class="badge-ok">✓ ${w.voiceMinutes}/${state.minMinutes}p</span>`
        : `<div class="text-xs text-slate-500 mb-1">${w.voiceMinutes}/${state.minMinutes} phút</div><div class="progress"><div class="bar" style="width:${pct}%"></div></div>`
    const toggleClass = w.attendedManual ? 'toggle on' : 'toggle'
    const tickDisabled = !canTick || !inWindow
    const canRedeem = canRedeemGlobal && m.stars >= 3
    return `
      <tr>
        <td>
          <div class="flex items-center gap-3">
            <img src="${escapeHtml(m.avatar)}" alt="" class="w-8 h-8 rounded-full" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'" />
            <div>
              <div class="font-medium text-slate-800">${escapeHtml(m.username)}</div>
              <div class="text-xs text-slate-400">${m.userId}</div>
            </div>
          </div>
        </td>
        <td><span class="badge-star">⭐ ${m.stars}</span></td>
        <td style="min-width: 180px">${progressText}</td>
        <td>
          <div class="${toggleClass}" ${canTick ? `data-tick-user="${m.userId}"` : ''} ${tickDisabled ? 'style="opacity:.4;cursor:not-allowed"' : ''}></div>
        </td>
        <td class="text-right">
          <button class="btn-soft-primary" ${canRedeemGlobal ? `data-redeem-user="${m.userId}"` : ''} ${canRedeem ? '' : 'disabled'}>Đã đổi quà</button>
        </td>
      </tr>
    `
  }).join('')

  tbody.querySelectorAll('[data-tick-user]').forEach(el => {
    el.onclick = () => toggleManual(el.dataset.tickUser, !el.classList.contains('on'))
  })
  tbody.querySelectorAll('[data-redeem-user]').forEach(el => {
    el.onclick = () => redeem(el.dataset.redeemUser)
  })
}

async function toggleManual(userId, next) {
  try {
    let r
    if (next) {
      r = await api('POST', '/api/blesscastle/attendance', { userId })
    } else {
      r = await api('DELETE', '/api/blesscastle/attendance', { userId })
    }
    flashSave(r?.awarded ? 'Đã tick + cộng 1⭐ ✓' : 'Đã cập nhật ✓')
    await refreshMembers()
  } catch (e) {
    flashSave(`Lỗi: ${e.message}`, false)
  }
}

async function refreshMembers() {
  await loadMembersForWeek(state.selectedWeek || state.currentWeek)
}

async function redeem(userId) {
  const m = state.members.find(x => x.userId === userId)
  if (!m) return
  if (!confirm(`Xác nhận đổi quà cho "${m.username}" (${m.stars}⭐)? Sao sẽ reset về 0.`)) return
  try {
    await api('POST', '/api/blesscastle/redeem', { userId })
    flashSave('Đã đổi quà ✓')
    await Promise.all([refreshMembers(), reloadHistory()])
  } catch (e) {
    flashSave(`Lỗi: ${e.message}`, false)
  }
}

// ============ History ============

async function reloadHistory() {
  try {
    const h = state.history
    const res = await api('GET', `/api/blesscastle/redemptions?page=${h.page}&pageSize=${h.pageSize}`)
    state.history.rows = res.data
    state.history.total = res.total
    // Neu page hien tai vuot qua total (sau khi delete/reset) -> lui page
    const maxPage = Math.max(1, Math.ceil(res.total / h.pageSize))
    if (h.page > maxPage) {
      state.history.page = maxPage
      return reloadHistory()
    }
    renderHistory()
  } catch (e) {
    flashSave(`Lỗi tải lịch sử: ${e.message}`, false)
  }
}

function renderHistory() {
  const { rows, total, page, pageSize } = state.history
  const tbody = document.getElementById('historyTbody')
  const totalEl = document.getElementById('historyTotal')
  const pager = document.getElementById('historyPager')
  const pageInfo = document.getElementById('historyPageInfo')
  const prevBtn = document.getElementById('historyPrev')
  const nextBtn = document.getElementById('historyNext')

  totalEl.textContent = total > 0 ? `Tổng ${total} lần đổi quà` : ''

  if (!rows || rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-slate-400 py-6">Chưa có lịch sử đổi quà</td></tr>'
    pager.style.display = 'none'
    return
  }

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>
        <div class="flex items-center gap-3">
          <img src="${escapeHtml(r.avatar)}" alt="" class="w-7 h-7 rounded-full" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'" />
          <div>
            <div class="font-medium text-slate-800">${escapeHtml(r.username)}</div>
            <div class="text-xs text-slate-400">${r.userId}</div>
          </div>
        </div>
      </td>
      <td>${fmtDate(r.redeemedAt)}</td>
      <td><span class="badge-star">⭐ ${r.starsAtRedemption}</span></td>
      <td class="text-xs text-slate-500">${escapeHtml(r.adminName || r.adminId)}</td>
    </tr>
  `).join('')

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  pager.style.display = total > pageSize ? 'flex' : 'none'
  pageInfo.textContent = `Trang ${page}/${totalPages}`
  prevBtn.disabled = page <= 1
  nextBtn.disabled = page >= totalPages
}

// ============ Helpers ============

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

document.getElementById('searchInput').addEventListener('input', (e) => {
  state.search = e.target.value
  renderMembers()
})

document.getElementById('refreshBtn').addEventListener('click', () => loadAll())

document.getElementById('historyPrev').addEventListener('click', () => {
  if (state.history.page > 1) { state.history.page--; reloadHistory() }
})
document.getElementById('historyNext').addEventListener('click', () => {
  const maxPage = Math.max(1, Math.ceil(state.history.total / state.history.pageSize))
  if (state.history.page < maxPage) { state.history.page++; reloadHistory() }
})
document.getElementById('historyPageSize').addEventListener('change', (e) => {
  state.history.pageSize = parseInt(e.target.value) || 20
  state.history.page = 1
  reloadHistory()
})

document.getElementById('finalizeBtn').addEventListener('click', async () => {
  if (!confirm('Chốt tuần hiện tại?\n\nMember đủ điều kiện (voice ≥ min phút HOẶC đã tick thủ công) sẽ được +1 sao.\n\nTiếp tục?')) return
  try {
    const r = await api('POST', '/api/blesscastle/finalize')
    flashSave(`Đã chốt tuần ${r.weekKey}: +1⭐ cho ${r.count} member ✓`)
    await Promise.all([refreshMembers(), reloadHistory()])
  } catch (e) {
    flashSave(`Lỗi: ${e.message}`, false)
  }
})

document.getElementById('resetBtn').addEventListener('click', async () => {
  const c1 = confirm('⚠️ Reset sẽ XÓA toàn bộ dữ liệu BlessCastle:\n- Sao tích lũy của tất cả member\n- Toàn bộ dữ liệu điểm danh các tuần\n- Lịch sử đổi quà\n\n(Cấu hình voice channel / khung giờ được GIỮ LẠI)\n\nTiếp tục?')
  if (!c1) return
  const c2 = prompt('Gõ RESET (in hoa) để xác nhận:')
  if (c2 !== 'RESET') { flashSave('Đã hủy', false); return }
  try {
    await api('POST', '/api/blesscastle/reset', { confirm: 'RESET' })
    flashSave('Đã reset ✓')
    state.selectedWeek = ''
    await loadAll()
  } catch (e) {
    flashSave(`Lỗi: ${e.message}`, false)
  }
})

// Boot
loadAll()
