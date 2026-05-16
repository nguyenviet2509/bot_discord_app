// ─── Discord Role Icon Helper ─────────────────────────────────────────────────
// Push 1 file anh local len lam icon cua Discord role qua API.
// Yeu cau: server da co Server Boost Level 2 (>=7 boosts). Neu khong, Discord
// tra 403/400.

const fs = require('fs')
const path = require('path')
const mimeMap = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' }

// Doc file -> encode base64 data URI -> PATCH Discord role.
// Return { ok, status, error?, hint? }.
async function pushRoleIcon({ guildId, roleId, filePath, botToken }) {
  if (!guildId || !roleId || !filePath || !botToken) {
    return { ok: false, status: 400, error: 'Thieu guildId/roleId/filePath/botToken' }
  }
  if (!fs.existsSync(filePath)) {
    return { ok: false, status: 404, error: `File khong ton tai: ${filePath}` }
  }
  const ext = path.extname(filePath).toLowerCase()
  const mime = mimeMap[ext]
  if (!mime) return { ok: false, status: 400, error: `Khong ho tro ext ${ext}` }

  const buf = fs.readFileSync(filePath)
  // Discord limit 256KB cho role icon
  if (buf.length > 256 * 1024) {
    return { ok: false, status: 400, error: `Anh > 256KB (${(buf.length / 1024).toFixed(0)}KB). Discord yeu cau <=256KB.` }
  }
  const dataUri = `data:${mime};base64,${buf.toString('base64')}`

  const url = `https://discord.com/api/v10/guilds/${guildId}/roles/${roleId}`
  const r = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bot ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ icon: dataUri }),
  })
  if (r.ok) return { ok: true, status: 200 }
  const errText = await r.text()
  return {
    ok: false,
    status: r.status,
    error: `Discord API ${r.status}: ${errText.slice(0, 300)}`,
    hint: (r.status === 403 || r.status === 400)
      ? 'Co the server chua dat Boost Level 2 (can >=7 boost de upload role icon).'
      : undefined,
  }
}

module.exports = { pushRoleIcon }
