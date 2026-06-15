// Worldcup match notification: tick 60s + catch-up on boot.
// - Idempotent qua bang worldcup_notification_log
// - Postpone-safe: query realtime, neu admin doi kick_off_at thi auto re-schedule
// - Catch-up khi bot vua start (window ±2 phut) de tranh miss khi restart trung phut

const { EmbedBuilder } = require('discord.js')
const wc = require('../../../shared/db-worldcup')

// Mau theo vong dau (RGB int)
const ROUND_COLORS = {
  group: 0x3b82f6,   // blue
  r16: 0xef4444,     // red
  qf: 0xef4444,
  sf: 0xef4444,
  '3rd': 0xef4444,
  final: 0xfacc15,   // gold
}

const ROUND_LABELS = {
  group: 'Vòng bảng',
  r16: 'Vòng 1/8',
  qf: 'Tứ kết',
  sf: 'Bán kết',
  '3rd': 'Tranh hạng 3',
  final: 'Chung kết',
}

// Format gio local theo timezone IANA (vd Asia/Saigon)
function formatLocalTime(unixMs, timezone) {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit',
      timeZone: timezone, hour12: false,
    }).format(new Date(unixMs))
  } catch (_) {
    return new Date(unixMs).toISOString()
  }
}

function formatRemaining(kickOffMs, nowMs) {
  const diffMin = Math.round((kickOffMs - nowMs) / 60_000)
  if (diffMin <= 0) return 'sắp bắt đầu'
  if (diffMin < 60) return `còn ~${diffMin} phút`
  const h = Math.floor(diffMin / 60), m = diffMin % 60
  return m === 0 ? `còn ~${h} giờ` : `còn ~${h}h${m}p`
}

function roundLabel(match) {
  const base = ROUND_LABELS[match.round] || match.round
  if (match.round === 'group' && match.group_name) return `${base} ${match.group_name}`
  return base
}

// Build payload {content, embeds} cho Discord
function buildMatchPayload(match, config, nowMs = Date.now()) {
  const color = ROUND_COLORS[match.round] || 0x6366f1
  const localTime = formatLocalTime(match.kick_off_at, config.timezone)
  const remaining = formatRemaining(match.kick_off_at, nowMs)

  const embed = new EmbedBuilder()
    .setTitle('🏆 Trận đấu Worldcup sắp diễn ra')
    .setDescription(`**${match.team1_name}**  vs  **${match.team2_name}**`)
    .setColor(color)
    .addFields(
      { name: '⏰ Giờ thi đấu', value: `${localTime} (${config.timezone})\n${remaining}`, inline: true },
      { name: '📋 Vòng đấu', value: roundLabel(match), inline: true },
    )
    .setFooter({ text: 'Worldcup notifications' })
    .setTimestamp(match.kick_off_at)

  const content = config.role_ping_id ? `<@&${config.role_ping_id}>` : ''
  return { content, embeds: [embed] }
}

// Mot lan tick: kiem tra match nao trong cua so notify cho moi guild config.
async function tick(client, { isCatchUp = false } = {}) {
  const configs = wc.listEnabledConfigs()
  if (configs.length === 0) return

  const now = Date.now()
  const maxLead = Math.max(...configs.map(c => c.notify_before_minutes))
  // Cua so: thuong [now, now + (maxLead+2)m]; catch-up [now-2m, now + maxLead m]
  const fromMs = isCatchUp ? now - 2 * 60_000 : now
  const toMs = isCatchUp ? now + maxLead * 60_000 : now + (maxLead + 2) * 60_000

  const matches = wc.findUpcomingMatches({ fromMs, toMs })
  if (matches.length === 0) return

  for (const cfg of configs) {
    const N = cfg.notify_before_minutes
    for (const m of matches) {
      const diffMin = (m.kick_off_at - now) / 60_000
      // Normal tick: gui khi rat gan moc N phut. Catch-up: gui neu da qua moc nhung chua gui (con trong khoang [0, N])
      const inWindow = isCatchUp
        ? diffMin >= -1 && diffMin <= N
        : diffMin >= N - 1 && diffMin <= N + 1
      if (!inWindow) continue
      if (wc.hasSentNotification(m.id, cfg.guild_id)) continue

      try {
        const channel = await client.channels.fetch(cfg.channel_id).catch(() => null)
        if (!channel || !channel.isTextBased?.()) {
          console.warn(`[Worldcup] Channel ${cfg.channel_id} unreachable for guild ${cfg.guild_id}`)
          continue
        }
        const payload = buildMatchPayload(m, cfg, now)
        await channel.send(payload)
        wc.markNotificationSent(m.id, cfg.guild_id, Date.now())
        console.log(`[Worldcup] Sent notification: match=${m.id} guild=${cfg.guild_id} (${m.team1_name} vs ${m.team2_name})`)
      } catch (err) {
        console.error(`[Worldcup] Send fail match=${m.id} guild=${cfg.guild_id}:`, err.message)
      }
    }
  }
}

// Khoi dong worker: catch-up sau 5s + tick moi 60s.
function start(client) {
  setTimeout(() => {
    tick(client, { isCatchUp: true }).catch(err => console.error('[Worldcup] catch-up error:', err.message))
  }, 5000)
  setInterval(() => {
    tick(client).catch(err => console.error('[Worldcup] tick error:', err.message))
  }, 60_000)
  console.log('[Worldcup] Notifier worker started (tick 60s + catch-up)')
}

module.exports = { start, tick, buildMatchPayload, formatLocalTime, formatRemaining, roundLabel, ROUND_COLORS, ROUND_LABELS }
