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
  // Preview
  // ============================================================
  async function renderPreview() {
    const payload = {
      title: el('pTitle').value.trim(),
      guildName: 'Server',
      bannerUrl: el('pBanner').value.trim(),
      user1: { id: '1', name: el('pName1').value, reason: el('pReason1').value, avatarUrl: el('pAvatar').value || undefined },
      user2: { id: '2', name: el('pName2').value, reason: el('pReason2').value },
      user3: { id: '3', name: el('pName3').value, reason: el('pReason3').value },
    }
    try {
      const r = await api('/honor/preview', { method: 'POST', body: JSON.stringify(payload) })
      const data = await r.json()
      if (!r.ok) { el('previewBox').innerHTML = `<em class="text-danger">❌ ${data.error}</em>`; return }
      const embed = data.embeds[0]
      const thumb = embed.thumbnail?.url ? `<img class="thumb" src="${embed.thumbnail.url}" alt="" onerror="this.style.display='none'">` : ''
      const desc = (embed.description || '').replace(/\n/g, '<br>')
      const f1 = embed.fields[0], f2 = embed.fields[1]
      el('previewBox').innerHTML = `
        ${thumb}
        <div class="author">${escapeHtml(embed.author?.name || '')}</div>
        <div class="title">${escapeHtml(embed.title)}</div>
        <div class="desc">${escapeHtml(desc).replace(/&lt;br&gt;/g, '<br>')}</div>
        <div class="fields">
          <div>
            <div class="field-name">${escapeHtml(f1.name)}</div>
            <div class="field-val">${escapeHtml(f1.value).replace(/\n/g, '<br>')}</div>
          </div>
          <div>
            <div class="field-name">${escapeHtml(f2.name)}</div>
            <div class="field-val">${escapeHtml(f2.value).replace(/\n/g, '<br>')}</div>
          </div>
        </div>
        <img class="banner-img" src="${escapeHtml(embed.image.url)}" onerror="this.style.display='none'">
        <div class="footer">${escapeHtml(embed.footer?.text || '')}</div>
      `
    } catch (err) {
      el('previewBox').innerHTML = `<em class="text-danger">❌ ${err.message}</em>`
    }
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  }

  // ============================================================
  // History
  // ============================================================
  async function loadHistory() {
    const r = await api('/honor/history?limit=10')
    const records = await r.json()
    if (!records.length) {
      el('historyBox').innerHTML = '<em class="text-muted">Chưa có lần vinh danh nào.</em>'
      return
    }
    el('historyBox').innerHTML = records.map(r => {
      const date = new Date(r.created_at * 1000).toLocaleString('vi-VN')
      const link = r.message_id ? `https://discord.com/channels/${r.guild_id}/${r.channel_id}/${r.message_id}` : null
      return `
        <div class="history-row">
          <strong>📅 ${date}</strong> — <em>${escapeHtml(r.title)}</em><br>
          <small>🥇 <code>${r.user1_id}</code> · 🥈 <code>${r.user2_id}</code> · 🥉 <code>${r.user3_id}</code></small><br>
          <small>Bởi <code>${r.created_by}</code>${link ? ` · <a href="${link}" target="_blank">Xem trên Discord</a>` : ''}</small>
        </div>
      `
    }).join('')
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

  init()
})()
