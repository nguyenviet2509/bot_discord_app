const express = require('express')
const db = require('../../shared/db')

const router = express.Router()
const GUILD_ID = () => process.env.GUILD_ID

const BUTTON_STYLE_MAP = { primary: 1, secondary: 2, success: 3, danger: 4 }

// Build Discord message payload (embed + components) tu group
function buildMessagePayload(group) {
  const embed = {
    title: group.title,
    description: group.description || '',
    color: parseInt((group.color || '#6366f1').replace('#', ''), 16),
  }
  // Buttons: max 5/row, 5 rows
  const rows = []
  let currentRow = { type: 1, components: [] }
  for (const item of group.items) {
    if (currentRow.components.length >= 5) {
      rows.push(currentRow)
      currentRow = { type: 1, components: [] }
    }
    const button = {
      type: 2,
      style: BUTTON_STYLE_MAP[item.style] || 1,
      label: item.label,
      custom_id: `rr:${group.id}:${item.role_id}`,
    }
    if (item.emoji) {
      // Custom emoji format <:name:id> or unicode
      const m = item.emoji.match(/<a?:(\w+):(\d+)>/)
      if (m) button.emoji = { name: m[1], id: m[2], animated: item.emoji.startsWith('<a:') }
      else button.emoji = { name: item.emoji }
    }
    currentRow.components.push(button)
  }
  if (currentRow.components.length) rows.push(currentRow)
  return { embeds: [embed], components: rows }
}

async function discordRequest(path, method = 'GET', body) {
  const r = await fetch(`https://discord.com/api/v10${path}`, {
    method,
    headers: {
      'Authorization': `Bot ${process.env.BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!r.ok && r.status !== 404) {
    const errText = await r.text()
    throw new Error(`Discord API ${r.status}: ${errText.slice(0, 300)}`)
  }
  if (r.status === 404) return null
  return r.status === 204 ? null : r.json()
}

router.get('/', (req, res) => {
  res.json(db.getReactionRoleGroups(GUILD_ID()))
})

router.post('/', async (req, res) => {
  const { channel_id, title, description, color, exclusive, items } = req.body
  if (!channel_id || !title) return res.status(400).json({ error: 'channel_id và title bắt buộc' })
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Cần ít nhất 1 item' })
  if (items.length > 25) return res.status(400).json({ error: 'Tối đa 25 buttons' })

  const result = db.createReactionRoleGroup({
    guild_id: GUILD_ID(), channel_id, title, description, color, exclusive: !!exclusive,
  })
  const groupId = result.lastInsertRowid
  db.replaceReactionRoleItems(groupId, items)

  // Post message lên Discord
  try {
    const group = db.getReactionRoleGroupById(groupId, GUILD_ID())
    const payload = buildMessagePayload(group)
    const msg = await discordRequest(`/channels/${channel_id}/messages`, 'POST', payload)
    if (msg?.id) db.updateReactionRoleGroup(groupId, { message_id: msg.id })
    res.json({ success: true, id: groupId, message_id: msg?.id })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, id: groupId })
  }
})

router.put('/:id', async (req, res) => {
  const groupId = Number(req.params.id)
  const existing = db.getReactionRoleGroupById(groupId, GUILD_ID())
  if (!existing) return res.status(404).json({ error: 'Không tìm thấy group' })

  const { channel_id, title, description, color, exclusive, items } = req.body
  if (items && items.length > 25) return res.status(400).json({ error: 'Tối đa 25 buttons' })

  db.updateReactionRoleGroup(groupId, { channel_id, title, description, color, exclusive })
  if (Array.isArray(items)) db.replaceReactionRoleItems(groupId, items)

  const updated = db.getReactionRoleGroupById(groupId, GUILD_ID())
  // Edit message Discord (neu da co message_id)
  try {
    if (updated.message_id) {
      const payload = buildMessagePayload(updated)
      const ok = await discordRequest(`/channels/${updated.channel_id}/messages/${updated.message_id}`, 'PATCH', payload)
      if (!ok) {
        // Message mat → post lai
        const msg = await discordRequest(`/channels/${updated.channel_id}/messages`, 'POST', payload)
        if (msg?.id) db.updateReactionRoleGroup(groupId, { message_id: msg.id })
      }
    } else {
      const payload = buildMessagePayload(updated)
      const msg = await discordRequest(`/channels/${updated.channel_id}/messages`, 'POST', payload)
      if (msg?.id) db.updateReactionRoleGroup(groupId, { message_id: msg.id })
    }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.delete('/:id', async (req, res) => {
  const groupId = Number(req.params.id)
  const existing = db.getReactionRoleGroupById(groupId, GUILD_ID())
  if (!existing) return res.status(404).json({ error: 'Không tìm thấy group' })

  // Try delete Discord message
  try {
    if (existing.message_id) {
      await discordRequest(`/channels/${existing.channel_id}/messages/${existing.message_id}`, 'DELETE')
    }
  } catch (err) {
    console.warn('[reaction-roles] Could not delete Discord message:', err.message)
  }
  db.deleteReactionRoleGroup(groupId, GUILD_ID())
  res.json({ success: true })
})

module.exports = router
