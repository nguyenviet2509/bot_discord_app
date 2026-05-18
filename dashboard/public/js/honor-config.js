// Trang cau hinh Vinh Danh: role allowlist, channel mac dinh, preview embed, history
(() => {
  const token = localStorage.getItem('token')
  if (!token) { window.location.href = '/login.html'; return }

  const api = async (path, opts = {}) => {
    const r = await fetch(`/api${path}`, {
      ...opts,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
      },
    })
    if (r.status === 401) { localStorage.removeItem('token'); window.location.href = '/login.html'; throw new Error('unauthorized') }
    return r
  }

  const el = (id) => document.getElementById(id)

  // ============================================================
  // State
  // ============================================================
  const state = {
    roles: [],
    channels: [],
    selectedRoleIds: new Set(),
    defaultChannelId: null,
  }

  // ============================================================
  // Role chips
  // ============================================================
  function renderRoleChips() {
    const box = el('roleChips')
    if (!state.roles.length) {
      box.innerHTML = '<em class="text-muted">Đang tải roles...</em>'
      return
    }
    box.innerHTML = state.roles.map(r => {
      const active = state.selectedRoleIds.has(r.id) ? 'active' : ''
      return `<span class="role-chip ${active}" data-id="${r.id}">${r.name}</span>`
    }).join('')
    box.querySelectorAll('.role-chip').forEach(chip => {
      chip.onclick = () => {
        const id = chip.dataset.id
        if (state.selectedRoleIds.has(id)) state.selectedRoleIds.delete(id)
        else state.selectedRoleIds.add(id)
        chip.classList.toggle('active')
      }
    })
  }

  // ============================================================
  // Channel select
  // ============================================================
  function renderChannelSelect() {
    const sel = el('channelSelect')
    const opts = ['<option value="">— Không chọn —</option>']
      .concat(state.channels.map(c =>
        `<option value="${c.id}" ${c.id === state.defaultChannelId ? 'selected' : ''}>#${c.name}</option>`,
      ))
    sel.innerHTML = opts.join('')

    // Channel select cho phan "Gui test" — pre-fill = default channel neu co
    const tSel = el('testChannel')
    if (tSel) {
      const tOpts = ['<option value="">— Chọn channel để gửi test —</option>']
        .concat(state.channels.map(c =>
          `<option value="${c.id}" ${c.id === state.defaultChannelId ? 'selected' : ''}>#${c.name}</option>`,
        ))
      tSel.innerHTML = tOpts.join('')
    }
  }

  // ============================================================
  // Save settings
  // ============================================================
  async function saveSettings() {
    const body = {
      allowed_role_ids: [...state.selectedRoleIds],
      default_channel_id: el('channelSelect').value || null,
    }
    const r = await api('/honor/settings', { method: 'PUT', body: JSON.stringify(body) })
    if (r.ok) {
      el('saveStatus').textContent = '✅ Đã lưu'
      setTimeout(() => { el('saveStatus').textContent = '' }, 2000)
    } else {
      el('saveStatus').textContent = '❌ Lỗi khi lưu'
    }
  }

  // ============================================================
  // Preview — support ca top3 va team
  // ============================================================
  function buildTop3Payload() {
    return {
      type: 'top3',
      title: el('pTitle').value.trim(),
      guildName: 'Server',
      bannerUrl: el('pBanner').value.trim(),
      user1: { id: '1', name: el('pName1').value, reason: el('pReason1').value, avatarUrl: el('pAvatar').value || undefined },
      user2: { id: '2', name: el('pName2').value, reason: el('pReason2').value },
      user3: { id: '3', name: el('pName3').value, reason: el('pReason3').value },
    }
  }

  function buildTeamPayload() {
    const ids = el('tMembers').value.split('\n').map(s => s.trim()).filter(Boolean)
    return {
      type: 'team',
      title: el('tTitle').value.trim(),
      guildName: 'Server',
      teamName: el('tTeamName').value.trim(),
      reason: el('tReason').value.trim(),
      bannerUrl: el('tBanner').value.trim(),
      members: ids.map(id => ({ id })),
    }
  }

  function renderEmbedBox(embed) {
    const thumb = embed.thumbnail?.url ? `<img class="thumb" src="${embed.thumbnail.url}" alt="" onerror="this.style.display='none'">` : ''
    const fieldsHtml = (embed.fields || []).map((f, i) => `
      <div>
        <div class="field-name">${escapeHtml(f.name)}</div>
        <div class="field-val">${escapeHtml(f.value).replace(/\n/g, '<br>')}</div>
      </div>
    `).join('')
    return `
      ${thumb}
      <div class="author">${escapeHtml(embed.author?.name || '')}</div>
      <div class="title">${escapeHtml(embed.title)}</div>
      <div class="desc">${escapeHtml(embed.description || '').replace(/\n/g, '<br>')}</div>
      <div class="fields">${fieldsHtml}</div>
      ${embed.image?.url ? `<img class="banner-img" src="${escapeHtml(embed.image.url)}" onerror="this.style.display='none'">` : ''}
      <div class="footer">${escapeHtml(embed.footer?.text || '')}</div>
    `
  }

  async function renderPreview() {
    const type = el('pType').value
    const payload = type === 'team' ? buildTeamPayload() : buildTop3Payload()
    try {
      const r = await api('/honor/preview', { method: 'POST', body: JSON.stringify(payload) })
      const data = await r.json()
      if (!r.ok) { el('previewBox').innerHTML = `<em class="text-danger">❌ ${data.error}</em>`; return }
      el('previewBox').innerHTML = renderEmbedBox(data.embeds[0])
    } catch (err) {
      el('previewBox').innerHTML = `<em class="text-danger">❌ ${err.message}</em>`
    }
  }

  function switchPreviewForm() {
    const type = el('pType').value
    el('formTop3').style.display = type === 'top3' ? '' : 'none'
    el('formTeam').style.display = type === 'team' ? '' : 'none'
  }

  // ============================================================
  // Send test — gui that den 1 channel (khong luu DB)
  // ============================================================
  async function sendTest() {
    const channelId = el('testChannel').value
    if (!channelId) {
      el('sendStatus').innerHTML = '<span class="text-danger">❌ Chọn channel test trước</span>'
      return
    }
    const type = el('pType').value
    const payload = type === 'team' ? buildTeamPayload() : buildTop3Payload()
    payload.channel_id = channelId

    el('sendStatus').innerHTML = '<span class="text-muted">⏳ Đang gửi...</span>'
    try {
      const r = await api('/honor/send-test', { method: 'POST', body: JSON.stringify(payload) })
      const data = await r.json()
      if (!r.ok) {
        el('sendStatus').innerHTML = `<span class="text-danger">❌ ${escapeHtml(data.error || 'Lỗi không xác định')}</span>`
        return
      }
      const link = `https://discord.com/channels/@me/${data.channel_id}/${data.message_id}`
      el('sendStatus').innerHTML = `<span class="text-success">✅ Đã gửi! <a href="${link}" target="_blank">Xem</a></span>`
    } catch (err) {
      el('sendStatus').innerHTML = `<span class="text-danger">❌ ${escapeHtml(err.message)}</span>`
    }
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  }

  // ============================================================
  // History — 2 tab: top3 va team
  // ============================================================
  let currentHistoryTab = 'top3'

  async function loadHistory() {
    const endpoint = currentHistoryTab === 'team' ? '/honor/team-history?limit=10' : '/honor/history?limit=10'
    const r = await api(endpoint)
    const records = await r.json()
    if (!records.length) {
      el('historyBox').innerHTML = `<em class="text-muted">Chưa có lần vinh danh ${currentHistoryTab === 'team' ? 'team' : 'cá nhân'} nào.</em>`
      return
    }
    el('historyBox').innerHTML = records.map(r => {
      const date = new Date(r.created_at * 1000).toLocaleString('vi-VN')
      const link = r.message_id ? `https://discord.com/channels/${r.guild_id}/${r.channel_id}/${r.message_id}` : null
      let body
      if (currentHistoryTab === 'team') {
        const ids = Array.isArray(r.member_ids) ? r.member_ids : []
        body = `<small>🎖️ <strong>${escapeHtml(r.team_name)}</strong> · ${ids.length} thành viên</small><br>
                <small>${ids.map(id => `<code>${id}</code>`).join(' · ')}</small>`
      } else {
        body = `<small>🥇 <code>${r.user1_id}</code> · 🥈 <code>${r.user2_id}</code> · 🥉 <code>${r.user3_id}</code></small>`
      }
      return `
        <div class="history-row">
          <strong>📅 ${date}</strong> — <em>${escapeHtml(r.title)}</em><br>
          ${body}<br>
          <small>Bởi <code>${r.created_by}</code>${link ? ` · <a href="${link}" target="_blank">Xem trên Discord</a>` : ''}</small>
        </div>
      `
    }).join('')
  }

  function bindHistoryTabs() {
    document.querySelectorAll('#historyTabs a').forEach(a => {
      a.onclick = (e) => {
        e.preventDefault()
        document.querySelectorAll('#historyTabs a').forEach(x => x.classList.remove('active'))
        a.classList.add('active')
        currentHistoryTab = a.dataset.tab
        loadHistory()
      }
    })
  }

  // ============================================================
  // Init
  // ============================================================
  async function init() {
    try {
      const [rRoles, rChannels, rSettings] = await Promise.all([
        api('/discord/roles'),
        api('/honor/channels'),
        api('/honor/settings'),
      ])
      state.roles = await rRoles.json()
      state.channels = await rChannels.json()
      const settings = await rSettings.json()
      state.selectedRoleIds = new Set(settings.allowed_role_ids || [])
      state.defaultChannelId = settings.default_channel_id || null

      renderRoleChips()
      renderChannelSelect()
      await loadHistory()
      await renderPreview()
    } catch (err) {
      console.error(err)
    }
  }

  el('saveBtn').onclick = saveSettings
  el('previewBtn').onclick = renderPreview
  el('sendTestBtn').onclick = sendTest
  el('pType').onchange = switchPreviewForm
  bindHistoryTabs()

  init()
})()
