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
  minMinutes: 30,
  search: '',
}

async function loadAll() {
  try {
    const [cfg, chs, mem, hist] = await Promise.all([
      api('GET', '/api/blesscastle/config'),
      api('GET', '/api/blesscastle/voice-channels'),
      api('GET', '/api/blesscastle/members'),
      api('GET', '/api/blesscastle/redemptions?limit=50'),
    ])
    state.config = cfg
    state.allVoiceChannels = chs
    state.members = mem.members
    state.weekKey = mem.weekKey
    state.minMinutes = mem.minMinutes
    renderConfig()
    renderChannelSelect()
    renderChannelChips()
    renderMembers()
    renderHistory(hist)
    document.getElementById('weekLabel').textContent = `Tuần ${state.weekKey}`
  } catch (e) {
    flashSave(`Lỗi tải dữ liệu: ${e.message}`, false)
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

  const inWindow = isInManualWindow()
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
    const canRedeem = m.stars >= 3
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
          <div class="${toggleClass}" data-tick-user="${m.userId}" ${inWindow ? '' : 'style="opacity:.4;cursor:not-allowed"'}></div>
        </td>
        <td class="text-right">
          <button class="btn-soft-primary" data-redeem-user="${m.userId}" ${canRedeem ? '' : 'disabled'}>Đã đổi quà</button>
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
  if (!isInManualWindow()) {
    flashSave('Chỉ có thể tick từ T2 đến 19h thứ 6', false)
    return
  }
  try {
    if (next) {
      await api('POST', '/api/blesscastle/attendance', { userId })
    } else {
      await api('DELETE', '/api/blesscastle/attendance', { userId })
    }
    flashSave('Đã cập nhật ✓')
    await refreshMembers()
  } catch (e) {
    flashSave(`Lỗi: ${e.message}`, false)
  }
}

async function refreshMembers() {
  const mem = await api('GET', '/api/blesscastle/members')
  state.members = mem.members
  state.weekKey = mem.weekKey
  state.minMinutes = mem.minMinutes
  renderMembers()
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
  const hist = await api('GET', '/api/blesscastle/redemptions?limit=50')
  renderHistory(hist)
}

function renderHistory(rows) {
  const tbody = document.getElementById('historyTbody')
  if (!rows || rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-slate-400 py-6">Chưa có lịch sử đổi quà</td></tr>'
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
      <td class="text-xs text-slate-500">${escapeHtml(r.adminId)}</td>
    </tr>
  `).join('')
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

// Boot
loadAll()
