// Gui tin nhan thong bao cho 1 event qua Discord REST API.
// Dung chung boi:
//   - dashboard route POST /api/events/:id/send-now (manual + auto-on-enable)
//   - bot scheduler tick (auto-on-start_at)
//
// Su dung shared/build-scheduled-payload de tan dung logic embed/image/mention da co.

const fs = require('fs')
const { buildPayload } = require('./build-scheduled-payload')

// Map event row -> shape ma buildPayload chap nhan
function eventToMsgShape(event) {
  // Neu co role ping, prepend <@&id> vao content (buildPayload extractMentions se phat hien va ping)
  const rolePrefix = event.announce_role_ping_id ? `<@&${event.announce_role_ping_id}> ` : ''
  const rawContent = event.announce_content || ''
  return {
    content: rolePrefix + rawContent,
    image_url: event.announce_image_url || null,
    use_embed: !!event.announce_use_embed,
    embed_title: event.announce_embed_title || null,
    embed_color: event.announce_embed_color || '#6366f1',
  }
}

// Tra ve { ok, status, error? }
async function sendEventAnnouncement(event, { botToken } = {}) {
  const token = botToken || process.env.BOT_TOKEN
  if (!token) return { ok: false, status: 500, error: 'BOT_TOKEN chua duoc cau hinh' }
  if (!event.announce_channel_id) return { ok: false, status: 400, error: 'Chua chon channel thong bao' }
  const hasContent = (event.announce_content && event.announce_content.trim()) || event.announce_image_url || event.announce_embed_title
  if (!hasContent) return { ok: false, status: 400, error: 'Phai co content, embed title hoac anh' }

  const { payload, files } = buildPayload(eventToMsgShape(event), { restAPI: true })
  const url = `https://discord.com/api/v10/channels/${event.announce_channel_id}/messages`

  try {
    let r
    if (files.length > 0) {
      const form = new FormData()
      form.append('payload_json', JSON.stringify(payload))
      files.forEach((f, i) => {
        const buf = fs.readFileSync(f.path)
        form.append(`files[${i}]`, new Blob([buf]), f.name)
      })
      r = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bot ${token}` },
        body: form,
      })
    } else {
      r = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bot ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }
    if (!r.ok) {
      const errText = await r.text()
      return { ok: false, status: r.status, error: `Discord ${r.status}: ${errText.slice(0, 200)}` }
    }
    return { ok: true, status: 200 }
  } catch (err) {
    return { ok: false, status: 500, error: err.message }
  }
}

module.exports = { sendEventAnnouncement }
