// Frontend logic cho trang Auto-Mod Lite.
// Goi REST API /api/automod/* (auth cookie/header da co qua middleware).

const API = '/api/automod'
const RULES = [
  { key: 'anti-spam', label: 'Anti-spam (flood)', desc: 'Quá nhiều tin trong thời gian ngắn' },
  { key: 'anti-invite', label: 'Anti-invite', desc: 'Phát hiện link mời server khác' },
  { key: 'bad-word', label: 'Bad-word filter', desc: 'Chặn từ ngữ trong blacklist' },
  { key: 'anti-mass-mention', label: 'Anti mass-mention', desc: 'Mention quá nhiều user/role' },
  { key: 'anti-repeat', label: 'Anti-repeat', desc: 'Spam cùng nội dung nhiều lần' },
]
const ACTIONS = [
  { value: 'warn', label: 'Cảnh báo + Xoá tin' },
  { value: 'mute-5m', label: 'Mute 5 phút' },
  { value: 'mute-1h', label: 'Mute 1 giờ' },
  { value: 'mute-1d', label: 'Mute 1 ngày' },
  { value: 'kick', label: 'Kick' },
]

let _channels = []
let _roles = []
let _config = {}
let _whitelist = { channels: [], roles: [] }
let _logsPage = 1

// ============ Helpers ============
function getToken() {
  // Iframe trong index.html dung cung origin -> localStorage.token van truy cap duoc.
  return localStorage.getItem('token')
}

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
  const r = await fetch(API + path, opts)
  if (r.status === 401) {
    localStorage.removeItem('token')
    // Iframe -> chuyen parent window ve login
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

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function flashSave(text, ok = true) {
  const el = document.getElementById('saveStatus')
  el.textContent = text
  el.className = 'small ' + (ok ? 'text-success' : 'text-danger')
  setTimeout(() => { el.textContent = '' }, 2500)
}

// ============ Tabs ============
document.querySelectorAll('#tabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#tabs button').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'))
    document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden')
    if (btn.dataset.tab === 'logs') loadLogs(1)
    if (btn.dataset.tab === 'stats') loadStats()
  })
})

// Reload button - reload toan bo data
document.getElementById('reloadBtn').addEventListener('click', () => init())

// ============ Rules tab ============
function renderRules() {
  const c = document.getElementById('rulesList')
  c.innerHTML = RULES.map(r => {
    const cfg = _config[r.key] || { enabled: false, params: {} }
    return `
      <div class="rule-row border border-slate-200 rounded-xl p-5 bg-slate-50" data-rule="${r.key}">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
          <div class="flex items-start md:items-center gap-3 min-w-0 flex-1">
            <label class="toggle-switch flex-shrink-0">
              <input class="rule-toggle" type="checkbox" ${cfg.enabled ? 'checked' : ''} />
              <span class="toggle-slider"></span>
            </label>
            <div class="min-w-0">
              <div class="font-semibold text-slate-800">${escapeHtml(r.label)}</div>
              <div class="text-xs text-slate-500 mt-0.5">${escapeHtml(r.desc)}</div>
            </div>
          </div>
          <button class="btn-primary save-rule self-start md:self-auto" style="padding:6px 14px;font-size:13px">Lưu</button>
        </div>
        <div class="rule-params flex flex-wrap gap-2 items-center text-xs md:text-sm text-slate-700">${renderParams(r.key, cfg.params)}</div>
      </div>`
  }).join('')

  c.querySelectorAll('.save-rule').forEach(btn => btn.addEventListener('click', e => saveRule(e.target.closest('.rule-row'))))
}

function renderParams(rule, params) {
  const sty = 'width:90px'
  switch (rule) {
    case 'anti-spam':
      return `
        <span>Tối đa</span>
        <input type="number" class="input-field p-input" data-k="maxMessages" value="${params.maxMessages || 5}" style="${sty}"/>
        <span>tin /</span>
        <input type="number" class="input-field p-input" data-k="windowSec" value="${params.windowSec || 5}" style="${sty}"/>
        <span>giây</span>`
    case 'anti-mass-mention':
      return `
        <span>Tối đa</span>
        <input type="number" class="input-field p-input" data-k="maxMentions" value="${params.maxMentions || 5}" style="${sty}"/>
        <span>mention / tin</span>`
    case 'anti-repeat':
      return `
        <span>Lặp</span>
        <input type="number" class="input-field p-input" data-k="maxRepeats" value="${params.maxRepeats || 3}" style="${sty}"/>
        <span>lần</span>`
    case 'bad-word':
      return `
        <div class="w-full">
          <textarea class="input-field p-input" data-k="words" rows="2"
            placeholder="Mỗi từ cách nhau bằng dấu phẩy hoặc xuống dòng">${escapeHtml((params.words || []).join(', '))}</textarea>
        </div>`
    default:
      return `<span class="text-slate-400 text-xs italic">Không có tham số</span>`
  }
}

async function saveRule(row) {
  const rule = row.dataset.rule
  const enabled = row.querySelector('.rule-toggle').checked
  const params = {}
  row.querySelectorAll('.p-input').forEach(inp => {
    if (inp.dataset.k === 'words') {
      params.words = inp.value.split(/[\n,]/).map(s => s.trim()).filter(Boolean)
    } else {
      params[inp.dataset.k] = Number(inp.value)
    }
  })
  try {
    await api('PUT', '/config/' + rule, { enabled, params })
    flashSave('✓ Đã lưu ' + rule)
  } catch (e) {
    flashSave('✗ ' + e.message, false)
  }
}

// ============ Whitelist tab ============
function renderWhitelist() {
  const chList = document.getElementById('wlChannels')
  chList.innerHTML = _whitelist.channels.length
    ? _whitelist.channels.map(id => {
        const ch = _channels.find(c => c.id === id)
        return `<span class="chip">#${escapeHtml(ch ? ch.name : id)} <span class="x" onclick="rmWl('channel','${id}')">✕</span></span>`
      }).join('')
    : '<span class="text-sm text-slate-400 italic">Chưa có channel nào</span>'

  const rList = document.getElementById('wlRoles')
  rList.innerHTML = _whitelist.roles.length
    ? _whitelist.roles.map(id => {
        const r = _roles.find(x => x.id === id)
        return `<span class="chip">@${escapeHtml(r ? r.name : id)} <span class="x" onclick="rmWl('role','${id}')">✕</span></span>`
      }).join('')
    : '<span class="text-sm text-slate-400 italic">Chưa có role nào</span>'
}

async function addWl(type) {
  const sel = type === 'channel' ? 'channelPick' : 'rolePick'
  const id = document.getElementById(sel).value
  if (!id) return
  try {
    await api('POST', '/whitelist', { type, id })
    _whitelist = await api('GET', '/whitelist')
    renderWhitelist()
    flashSave('✓ Đã thêm')
  } catch (e) { flashSave('✗ ' + e.message, false) }
}

async function rmWl(type, id) {
  try {
    await api('DELETE', `/whitelist/${type}/${id}`)
    _whitelist = await api('GET', '/whitelist')
    renderWhitelist()
    flashSave('✓ Đã xoá')
  } catch (e) { flashSave('✗ ' + e.message, false) }
}

// ============ Ladder tab ============
let _ladder = { steps: [], expirySec: 86400 }
function renderLadder() {
  const c = document.getElementById('ladderRows')
  const labels = ['Vi phạm lần 1', 'Vi phạm lần 2', 'Vi phạm lần 3', 'Vi phạm lần 4 trở đi']
  c.innerHTML = labels.map((lbl, i) => {
    const cur = _ladder.steps[i] || _ladder.steps[_ladder.steps.length - 1] || 'warn'
    return `
      <div class="flex items-center gap-3">
        <div class="w-44 text-sm font-semibold text-slate-700">${lbl}</div>
        <select class="input-field ladder-step" data-i="${i}" style="max-width:280px">
          ${ACTIONS.map(a => `<option value="${a.value}" ${a.value === cur ? 'selected' : ''}>${escapeHtml(a.label)}</option>`).join('')}
        </select>
      </div>`
  }).join('')
  document.getElementById('ladderExpiry').value = Math.floor((_ladder.expirySec || 86400) / 3600)
}

async function saveLadder() {
  const steps = Array.from(document.querySelectorAll('.ladder-step')).map(s => s.value)
  const expirySec = Number(document.getElementById('ladderExpiry').value) * 3600
  try {
    await api('PUT', '/ladder', { steps, expirySec })
    flashSave('✓ Đã lưu ladder')
  } catch (e) { flashSave('✗ ' + e.message, false) }
}

// ============ Logs tab ============
function resetFilter() {
  document.getElementById('filterUser').value = ''
  document.getElementById('filterRule').value = ''
  document.getElementById('filterAction').value = ''
  loadLogs(1)
}

async function loadLogs(page) {
  _logsPage = page
  const params = new URLSearchParams()
  const u = document.getElementById('filterUser').value.trim()
  const r = document.getElementById('filterRule').value
  const a = document.getElementById('filterAction').value
  if (u) params.set('user', u)
  if (r) params.set('rule', r)
  if (a) params.set('action', a)
  params.set('page', page)
  params.set('pageSize', 20)

  try {
    const data = await api('GET', '/logs?' + params.toString())
    renderLogs(data)
  } catch (e) {
    document.getElementById('logsBody').innerHTML = `<tr><td colspan="7" class="text-danger">Lỗi: ${escapeHtml(e.message)}</td></tr>`
  }
}

function renderLogs({ rows, total, page, pageSize }) {
  const tbody = document.getElementById('logsBody')
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-slate-400 py-8">Chưa có log vi phạm</td></tr>'
  } else {
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td class="text-slate-500">${new Date(r.created_at * 1000).toLocaleString('vi-VN')}</td>
        <td><code class="text-xs bg-slate-100 px-2 py-0.5 rounded">${escapeHtml(r.user_id)}</code></td>
        <td><span class="badge-rule">${escapeHtml(r.rule)}</span></td>
        <td><span class="badge-action ${r.action}">${escapeHtml(r.action)}</span></td>
        <td class="text-slate-600">${escapeHtml((r.message_excerpt || '').slice(0, 60))}${r.message_excerpt && r.message_excerpt.length > 60 ? '…' : ''}</td>
        <td class="text-slate-500"><code class="text-xs">${escapeHtml(r.channel_id || '')}</code></td>
        <td><button class="btn-danger-soft" onclick="clearWarns('${r.user_id}')">Reset warn</button></td>
      </tr>`).join('')
  }
  const maxPage = Math.max(1, Math.ceil(total / pageSize))
  document.getElementById('pageInfo').textContent = `Trang ${page}/${maxPage}`
  document.getElementById('logsTotal').textContent = `Tổng ${total} log`
  document.getElementById('prevPage').disabled = page <= 1
  document.getElementById('nextPage').disabled = page >= maxPage
}

document.getElementById('prevPage').addEventListener('click', () => loadLogs(_logsPage - 1))
document.getElementById('nextPage').addEventListener('click', () => loadLogs(_logsPage + 1))

async function clearWarns(userId) {
  if (!confirm(`Xoá toàn bộ warn cho user ${userId}?`)) return
  try {
    await api('DELETE', '/warns/' + userId)
    flashSave('✓ Đã reset warn cho ' + userId)
  } catch (e) { flashSave('✗ ' + e.message, false) }
}

// ============ Stats tab ============
async function loadStats() {
  try {
    const data = await api('GET', '/stats?days=7')
    const maxByRule = Math.max(1, ...data.byRule.map(r => r.total))
    document.getElementById('statsByRule').innerHTML = data.byRule.length
      ? data.byRule.map(r => `
          <div>
            <div class="flex items-center justify-between mb-1">
              <span class="text-sm font-semibold text-slate-700">${escapeHtml(r.rule)}</span>
              <span class="text-sm text-slate-500">${r.total} vi phạm</span>
            </div>
            <div class="stat-bar" style="width:${Math.max(8, (r.total / maxByRule) * 100)}%"></div>
          </div>`).join('')
      : '<div class="text-sm text-slate-400 italic">Chưa có vi phạm trong 7 ngày</div>'

    document.getElementById('statsTop').innerHTML = data.topOffenders.length
      ? '<ol class="space-y-2">' + data.topOffenders.map((o, i) => `
          <li class="flex items-center justify-between border-b border-slate-100 pb-2">
            <div class="flex items-center gap-3">
              <span class="text-slate-400 font-mono text-sm">#${i + 1}</span>
              <code class="text-sm bg-slate-100 px-2 py-0.5 rounded">${escapeHtml(o.user_id)}</code>
            </div>
            <span class="text-sm text-slate-600 font-semibold">${o.total} vi phạm</span>
          </li>`).join('') + '</ol>'
      : '<div class="text-sm text-slate-400 italic">Chưa có user vi phạm</div>'
  } catch (e) {
    document.getElementById('statsByRule').innerHTML = `<div class="text-danger">Lỗi: ${escapeHtml(e.message)}</div>`
  }
}

// ============ Init ============
async function init() {
  try {
    const [channels, roles, config, whitelist, ladder] = await Promise.all([
      api('GET', '/channels'),
      api('GET', '/roles'),
      api('GET', '/config'),
      api('GET', '/whitelist'),
      api('GET', '/ladder'),
    ])
    _channels = channels
    _roles = roles
    _config = config
    _whitelist = whitelist
    _ladder = ladder

    // Populate channel/role pickers
    document.getElementById('channelPick').innerHTML = '<option value="">— Chọn channel —</option>' +
      channels.map(c => `<option value="${c.id}">#${escapeHtml(c.name)}</option>`).join('')
    document.getElementById('rolePick').innerHTML = '<option value="">— Chọn role —</option>' +
      roles.map(r => `<option value="${r.id}">@${escapeHtml(r.name)}</option>`).join('')

    // Populate filter rule select
    document.getElementById('filterRule').innerHTML += RULES.map(r => `<option value="${r.key}">${r.label}</option>`).join('')
    document.getElementById('filterAction').innerHTML += ACTIONS.map(a => `<option value="${a.value}">${a.label}</option>`).join('')

    renderRules()
    renderWhitelist()
    renderLadder()
  } catch (e) {
    document.body.insertAdjacentHTML('afterbegin',
      `<div class="alert alert-danger m-3">Lỗi load: ${escapeHtml(e.message)}</div>`)
  }
}

window.addWl = addWl
window.rmWl = rmWl
window.saveLadder = saveLadder
window.loadLogs = loadLogs
window.resetFilter = resetFilter
window.clearWarns = clearWarns

init()
