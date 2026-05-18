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
    channels: [],
    defaultChannelId: null,
    user1Avatar: null,
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
    // Lay banner URL — uu tien banner cua top3 form, fallback team form
    const bannerUrl = el('pBanner').value.trim() || el('tBanner').value.trim() || null
    const body = {
      default_channel_id: el('channelSelect').value || null,
      gold_emoji: el('goldEmoji').value.trim() || null,
      silver_emoji: el('silverEmoji').value.trim() || null,
      bronze_emoji: el('bronzeEmoji').value.trim() || null,
      last_banner_url: bannerUrl,
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
    // Avatar Quan quan lay tu state.user1Avatar (auto-fetch khi nhap user ID)
    return {
      type: 'top3',
      title: el('pTitle').value.trim(),
      guildName: 'Server',
      bannerUrl: el('pBanner').value.trim(),
      user1: {
        id: el('pId1').value.trim() || '1',
        name: el('pName1').value, reason: el('pReason1').value,
        avatarUrl: state.user1Avatar || undefined,
      },
      user2: { id: el('pId2').value.trim() || '2', name: el('pName2').value, reason: el('pReason2').value },
      user3: { id: el('pId3').value.trim() || '3', name: el('pName3').value, reason: el('pReason3').value },
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

  // ============================================================
  // Auto-fetch user info (avatar + name) khi nhap User ID
  // ============================================================
  async function fetchUserInfo(slot) {
    const id = el(`pId${slot}`).value.trim()
    if (!/^\d{17,20}$/.test(id)) {
      if (slot === 1) state.user1Avatar = null
      return
    }
    try {
      const r = await api(`/honor/user-avatar?id=${id}`)
      const data = await r.json()
      if (r.ok) {
        // Luon ghi de ten (user yeu cau)
        el(`pName${slot}`).value = data.global_name || data.username
        if (slot === 1) state.user1Avatar = data.avatar_url
      }
    } catch (_) { /* ignore */ }
  }

  // ============================================================
  // Banner upload
  // ============================================================
  async function uploadBanner(prefix) {
    const fileInput = el(`${prefix}BannerFile`)
    const file = fileInput.files?.[0]
    if (!file) {
      el(`${prefix}BannerStatus`).innerHTML = '<span class="text-danger">❌ Chọn file trước</span>'
      return
    }
    el(`${prefix}BannerStatus`).innerHTML = '<span class="text-muted">⏳ Đang upload...</span>'
    const form = new FormData()
    form.append('file', file)
    try {
      const r = await fetch('/api/honor/banner-upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const data = await r.json()
      if (!r.ok) {
        el(`${prefix}BannerStatus`).innerHTML = `<span class="text-danger">❌ ${escapeHtml(data.error || 'Lỗi')}</span>`
        return
      }
      el(`${prefix}Banner`).value = data.url
      el(`${prefix}BannerStatus`).innerHTML = '<span class="text-success">✅ Đã upload</span>'
      el(`${prefix}BannerPreview`).innerHTML = `<img src="${escapeHtml(data.url)}" style="max-width:360px;max-height:120px;border-radius:6px;border:1px solid #ddd">`
    } catch (err) {
      el(`${prefix}BannerStatus`).innerHTML = `<span class="text-danger">❌ ${escapeHtml(err.message)}</span>`
    }
  }

  // Render markdown subset cua Discord (cho preview): #, ##, >, **bold**, *italic*
  function renderMd(text) {
    if (!text) return ''
    const lines = String(text).split('\n').map(line => {
      const safe = escapeHtml(line)
      if (/^### /.test(line)) return `<h3>${escapeHtml(line.slice(4))}</h3>`
      if (/^## /.test(line)) return `<h2>${escapeHtml(line.slice(3))}</h2>`
      if (/^# /.test(line)) return `<h1>${escapeHtml(line.slice(2))}</h1>`
      if (/^&gt; /.test(safe) || /^> /.test(line)) return `<blockquote>${inlineMd(line.replace(/^> /, ''))}</blockquote>`
      return inlineMd(line) + '<br>'
    })
    return lines.join('')
  }
  function inlineMd(s) {
    return escapeHtml(s)
      .replace(/\\\*/g, '&#42;')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/&#42;/g, '*')
  }

  function renderEmbedBox(embed) {
    const thumb = embed.thumbnail?.url ? `<img class="thumb" src="${embed.thumbnail.url}" alt="" onerror="this.style.display='none'">` : ''
    const fieldsHtml = (embed.fields || []).map((f) => `
      <div>
        <div class="field-name">${escapeHtml(f.name)}</div>
        <div class="field-val">${escapeHtml(f.value).replace(/\n/g, '<br>')}</div>
      </div>
    `).join('')
    return `
      ${thumb}
      <div class="author">${escapeHtml(embed.author?.name || '')}</div>
      <div class="title">${escapeHtml(embed.title)}</div>
      <div class="desc">${renderMd(embed.description || '')}</div>
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
  // Emoji upload — bot tu post anh len Discord Application Emoji
  // ============================================================
  // Parse Discord custom emoji `<:name:id>` (hoac animated `<a:name:id>`) -> CDN URL preview
  function emojiCodeToImgUrl(code) {
    if (!code) return null
    const m = code.match(/^<(a)?:([^:]+):(\d+)>$/)
    if (!m) return null
    const ext = m[1] ? 'gif' : 'png'
    return `https://cdn.discordapp.com/emojis/${m[3]}.${ext}?size=64`
  }

  function renderEmojiPreview(slot, code) {
    const box = el(`${slot}EmojiPreview`)
    if (!box) return
    const url = emojiCodeToImgUrl(code)
    if (url) {
      box.innerHTML = `<img src="${url}" alt="${slot}" style="width:96px;height:96px;border-radius:8px;border:1px solid #ddd;object-fit:contain;background:#f8f9fa;padding:4px">`
    } else if (code) {
      box.innerHTML = `<span style="font-size:64px;line-height:1">${escapeHtml(code)}</span>`
    } else {
      box.innerHTML = '<span class="text-muted small">— Chưa cấu hình —</span>'
    }
  }

  async function uploadEmoji(slot) {
    const fileInput = el(`${slot}EmojiFile`)
    const file = fileInput.files?.[0]
    if (!file) {
      el('emojiUploadStatus').innerHTML = `<span class="text-danger">❌ Chọn file cho slot ${slot} trước</span>`
      return
    }
    if (file.size > 256 * 1024) {
      el('emojiUploadStatus').innerHTML = `<span class="text-danger">❌ File > 256KB (kích thước hiện tại: ${Math.round(file.size / 1024)}KB)</span>`
      return
    }
    const form = new FormData()
    form.append('slot', slot)
    form.append('file', file)
    el('emojiUploadStatus').innerHTML = `<span class="text-muted">⏳ Đang upload ${slot}...</span>`
    try {
      const r = await fetch('/api/honor/emoji-upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const data = await r.json()
      if (!r.ok) {
        el('emojiUploadStatus').innerHTML = `<span class="text-danger">❌ ${escapeHtml(data.error || 'Lỗi')}</span>`
        return
      }
      el(`${slot}Emoji`).value = data.emoji_code
      renderEmojiPreview(slot, data.emoji_code)
      el('emojiUploadStatus').innerHTML = `<span class="text-success">✅ Đã upload ${slot}: <code>${escapeHtml(data.emoji_code)}</code></span>`
      fileInput.value = ''
    } catch (err) {
      el('emojiUploadStatus').innerHTML = `<span class="text-danger">❌ ${escapeHtml(err.message)}</span>`
    }
  }

  async function removeEmoji(slot) {
    if (!confirm(`Xoá emoji ${slot}?`)) return
    el('emojiUploadStatus').innerHTML = `<span class="text-muted">⏳ Đang xoá ${slot}...</span>`
    try {
      const r = await api(`/honor/emoji/${slot}`, { method: 'DELETE' })
      const data = await r.json()
      if (!r.ok) {
        el('emojiUploadStatus').innerHTML = `<span class="text-danger">❌ ${escapeHtml(data.error || 'Lỗi')}</span>`
        return
      }
      el(`${slot}Emoji`).value = ''
      renderEmojiPreview(slot, null)
      el('emojiUploadStatus').innerHTML = `<span class="text-success">✅ Đã xoá ${slot}</span>`
    } catch (err) {
      el('emojiUploadStatus').innerHTML = `<span class="text-danger">❌ ${escapeHtml(err.message)}</span>`
    }
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
      const [rChannels, rSettings] = await Promise.all([
        api('/honor/channels'),
        api('/honor/settings'),
      ])
      state.channels = await rChannels.json()
      const settings = await rSettings.json()
      state.defaultChannelId = settings.default_channel_id || null

      // Pre-fill 3 emoji input (hidden) + render preview
      el('goldEmoji').value = settings.gold_emoji || ''
      el('silverEmoji').value = settings.silver_emoji || ''
      el('bronzeEmoji').value = settings.bronze_emoji || ''
      renderEmojiPreview('gold', settings.gold_emoji)
      renderEmojiPreview('silver', settings.silver_emoji)
      renderEmojiPreview('bronze', settings.bronze_emoji)

      // Pre-fill banner URL da luu lan truoc (cho top3 va team dung chung)
      if (settings.last_banner_url) {
        el('pBanner').value = settings.last_banner_url
        el('tBanner').value = settings.last_banner_url
        const previewImg = `<img src="${settings.last_banner_url}" style="max-width:360px;max-height:120px;border-radius:6px;border:1px solid #ddd" onerror="this.style.display='none'">`
        el('pBannerPreview').innerHTML = previewImg
        el('tBannerPreview').innerHTML = previewImg
      }

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
  el('pId1').addEventListener('blur', () => fetchUserInfo(1))
  el('pId2').addEventListener('blur', () => fetchUserInfo(2))
  el('pId3').addEventListener('blur', () => fetchUserInfo(3))
  el('pBannerUpload').onclick = () => uploadBanner('p')
  el('tBannerUpload').onclick = () => uploadBanner('t')
  document.querySelectorAll('.upload-emoji-btn').forEach(btn => {
    btn.onclick = () => uploadEmoji(btn.dataset.slot)
  })
  document.querySelectorAll('.remove-emoji-btn').forEach(btn => {
    btn.onclick = () => removeEmoji(btn.dataset.slot)
  })
  bindHistoryTabs()

  init()
})()
