// Service vinh danh: lưu pending data tạm, build embed, gửi, react, persist DB
const dbHonor = require('../../../shared/db-honor')
const { buildHonorEmbed } = require('../../../shared/build-honor-embed')

// ============================================================
// Pending cache — luu options tu slash command de modal submit lay lai
// Key: `${userId}:${guildId}` | TTL: 10 phut
// ============================================================
const PENDING_TTL_MS = 10 * 60 * 1000
const pendingStore = new Map()

function setPending(key, data) {
  pendingStore.set(key, { data, expires: Date.now() + PENDING_TTL_MS })
}

function takePending(key) {
  const entry = pendingStore.get(key)
  if (!entry) return null
  pendingStore.delete(key)
  if (entry.expires < Date.now()) return null
  return entry.data
}

setInterval(() => {
  const now = Date.now()
  for (const [k, v] of pendingStore) if (v.expires < now) pendingStore.delete(k)
}, 60_000).unref?.()

// ============================================================
// Permission check
// ============================================================
function hasHonorPermission(member, settings) {
  if (!member) return false
  if (member.permissions?.has?.('Administrator')) return true
  const allowed = settings?.allowed_role_ids || []
  if (!allowed.length) {
    // Khong cau hinh role → fallback yeu cau ManageGuild
    return member.permissions?.has?.('ManageGuild') || false
  }
  return member.roles.cache.some(r => allowed.includes(r.id))
}

// ============================================================
// Publish — build payload, gui, react, persist
// ============================================================
async function publishHonor({ channel, payload, dbRecord }) {
  const { content, embeds } = payload
  const message = await channel.send({ content, embeds })

  // Lưu DB ngay sau khi gửi
  const id = dbHonor.insertHonorRecord(dbRecord)
  dbHonor.updateHonorMessageId(id, message.id)

  // Auto-react (best-effort, khong fail neu thieu quyen)
  try { await message.react('🎉') } catch (_) {}
  try { await message.react('👏') } catch (_) {}

  return { messageId: message.id, recordId: id }
}

module.exports = {
  setPending,
  takePending,
  hasHonorPermission,
  publishHonor,
  buildHonorEmbed,
}
