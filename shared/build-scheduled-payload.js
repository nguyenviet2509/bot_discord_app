// Build payload Discord (content + embed/image) tu scheduled_messages row.
// Dung chung cho bot worker va dashboard /send-now.
// Co camelCase (Discord.js) va snake_case (REST API) variant.

function imageFullUrl(imageUrl) {
  if (!imageUrl) return null
  if (imageUrl.startsWith('http')) return imageUrl
  const base = process.env.BASE_URL || ''
  return base ? `${base}${imageUrl}` : null
}

function buildPayload(msg, { restAPI = false } = {}) {
  const useEmbed = !!msg.use_embed
  const img = imageFullUrl(msg.image_url)
  const allowedKey = restAPI ? 'allowed_mentions' : 'allowedMentions'

  if (useEmbed) {
    // Mode embed: title + description + color + image inline
    const color = parseInt((msg.embed_color || '#6366f1').replace('#', ''), 16)
    const embed = {
      ...(msg.embed_title ? { title: msg.embed_title } : {}),
      ...(msg.content ? { description: msg.content } : {}),
      color,
      ...(img ? { image: { url: img } } : {}),
    }
    return {
      content: '',
      embeds: [embed],
      [allowedKey]: { parse: ['everyone', 'roles', 'users'] },
    }
  }

  // Mode plain content (co the kem anh duoi dang embed-only-image)
  const payload = {
    content: msg.content || '',
    [allowedKey]: { parse: ['everyone', 'roles', 'users'] },
  }
  if (img) payload.embeds = [{ image: { url: img } }]
  return payload
}

module.exports = { buildPayload }
