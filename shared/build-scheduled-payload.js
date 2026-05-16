// Build payload Discord (content + embed/image) tu scheduled_messages row.
// Dung chung cho bot worker va dashboard /send-now.
// Ho tro:
//  - image_url tuyet doi (http/https) → embed.image.url
//  - image_url tuong doi (/uploads/...) → dinh kem file qua attachment://
// Tra ve { payload, files } voi files = [{ path, name }] de caller xu ly:
//  - discord.js: channel.send({ ...payload, files })
//  - REST API: multipart/form-data (payload_json + files)

const path = require('path')
const fs = require('fs')

function resolveImage(imageUrl) {
  if (!imageUrl) return { url: null, filePath: null, filename: null }
  if (/^https?:\/\//i.test(imageUrl)) return { url: imageUrl, filePath: null, filename: null }
  // Local upload: /uploads/<name>
  const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..')
  const clean = imageUrl.replace(/^\/+/, '')
  const filePath = path.join(DATA_DIR, clean)
  if (!fs.existsSync(filePath)) {
    // Fallback: thu BASE_URL neu file local khong ton tai
    const base = process.env.BASE_URL || ''
    return { url: base ? `${base}${imageUrl}` : null, filePath: null, filename: null }
  }
  const filename = path.basename(filePath)
  return { url: `attachment://${filename}`, filePath, filename }
}

// Trich xuat cac mention tu noi dung text (user/role/everyone/here)
// Discord chi ping khi mention nam o truong "content" ngoai embed.
// Tra ve chuoi mention da ghep (cach nhau bang space), de prepend vao content.
function extractMentions(text) {
  if (!text) return ''
  const re = /<@!?\d+>|<@&\d+>|@everyone|@here/g
  const found = text.match(re)
  if (!found || found.length === 0) return ''
  // Bo trung lap, giu thu tu xuat hien
  const seen = new Set()
  const uniq = []
  for (const m of found) {
    if (!seen.has(m)) { seen.add(m); uniq.push(m) }
  }
  return uniq.join(' ')
}

function buildPayload(msg, { restAPI = false } = {}) {
  const useEmbed = !!msg.use_embed
  const { url: imgUrl, filePath, filename } = resolveImage(msg.image_url)
  const allowedKey = restAPI ? 'allowed_mentions' : 'allowedMentions'

  let payload
  if (useEmbed) {
    const color = parseInt((msg.embed_color || '#6366f1').replace('#', ''), 16)
    const embed = {
      ...(msg.embed_title ? { title: msg.embed_title } : {}),
      ...(msg.content ? { description: msg.content } : {}),
      color,
      ...(imgUrl ? { image: { url: imgUrl } } : {}),
    }
    // Mention trong embed.description khong ping → copy ra content ngoai embed
    const mentionPrefix = extractMentions(msg.content)
    payload = {
      content: mentionPrefix,
      embeds: [embed],
      [allowedKey]: { parse: ['everyone', 'roles', 'users'] },
    }
  } else {
    payload = {
      content: msg.content || '',
      [allowedKey]: { parse: ['everyone', 'roles', 'users'] },
    }
    if (imgUrl) payload.embeds = [{ image: { url: imgUrl } }]
  }

  const files = filePath ? [{ path: filePath, name: filename }] : []
  return { payload, files }
}

module.exports = { buildPayload, resolveImage }
