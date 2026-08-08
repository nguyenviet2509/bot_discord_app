// Helper gui message qua Discord REST API (dung tu ca dashboard va bot process).
// KHONG can bot client - chi can BOT_TOKEN + channel_id.

const https = require('https')

function sendDiscordMessage(channelId, payload, botToken = process.env.BOT_TOKEN) {
  return new Promise((resolve) => {
    if (!channelId || !botToken) {
      return resolve({ ok: false, error: 'missing channelId or botToken' })
    }
    const data = JSON.stringify(payload)
    const req = https.request({
      hostname: 'discord.com',
      path: `/api/v10/channels/${channelId}/messages`,
      method: 'POST',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let buf = ''
      res.on('data', (c) => { buf += c })
      res.on('end', () => {
        const ok = res.statusCode >= 200 && res.statusCode < 300
        resolve({ ok, status: res.statusCode, body: buf })
      })
    })
    req.on('error', (e) => resolve({ ok: false, error: e.message }))
    req.write(data)
    req.end()
  })
}

module.exports = { sendDiscordMessage }
