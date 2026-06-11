// /license slash command — admin-only license management for WindowHelper.
// Subcommands: issue, revoke, reset-machine, info, list
// Requires Administrator permission (setDefaultMemberPermissions).

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js')
const db = require('../../../shared/db-licenses')
const notifier = require('../../../shared/license-notifier')

// ---- Helper ----

function tokenMask(token) {
  if (!token) return '???'
  return `${token.slice(0, 4)}****${token.slice(-4)}`
}

function expStr(expires_at) {
  if (!expires_at) return 'Vĩnh viễn'
  return new Date(expires_at * 1000).toLocaleDateString('vi-VN')
}

function statusLabel(row) {
  if (row.revoked) return '🔴 Revoked'
  const now = Math.floor(Date.now() / 1000)
  if (row.expires_at && row.expires_at < now) return '🟡 Expired'
  return '🟢 Active'
}

// Resolve target string → license row, or { ambiguous: true, count: N }, or null.
// Target may be a token mask like "abcd****ef12" or a Discord @mention string.
function resolveTarget(target) {
  // Check if Discord user mention: <@123456> or raw snowflake
  const mentionMatch = target.match(/^<@!?(\d+)>$/) || target.match(/^(\d{17,20})$/)
  if (mentionMatch) {
    return db.findActiveByDiscordUser(mentionMatch[1])
  }
  // Token mask: first 4 chars are the prefix
  const prefix = target.replace(/\*+.*$/, '').slice(0, 4)
  if (prefix.length >= 4) {
    const matches = db.findByTokenPrefix(prefix)
    if (matches.length === 0) return null
    if (matches.length > 1) return { ambiguous: true, count: matches.length }
    return matches[0]
  }
  return null
}

// ---- Subcommand handlers ----

async function handleIssue(interaction) {
  await interaction.deferReply({ ephemeral: true })

  const user = interaction.options.getUser('user')
  const machineId = interaction.options.getString('machine_id').trim().toLowerCase()
  const label = interaction.options.getString('label')
  const days = interaction.options.getInteger('expires_days')
  const note = interaction.options.getString('note')

  if (!/^[a-f0-9]{64}$/.test(machineId)) {
    return interaction.editReply('❌ Machine ID phải là 64 ký tự hex (a-f, 0-9). Copy đúng HWID từ cửa sổ activation của app.')
  }

  const expires_at = days ? Math.floor(Date.now() / 1000) + days * 86400 : null
  const machine_id_short = machineId.slice(0, 8)

  let licenseId, token
  try {
    const result = db.createToken({
      user_label: label,
      expires_at,
      note,
      machine_id: machineId,
      machine_id_short,
      discord_user_id: user.id,
      issued_by_discord_id: interaction.user.id,
    })
    licenseId = result.id
    token = result.token
  } catch (err) {
    console.error('[license:issue] createToken failed:', err.message)
    return interaction.editReply(`❌ Lỗi tạo token: ${err.message}`)
  }

  db.recordEvent(licenseId, 'issue', null, null, JSON.stringify({ by: interaction.user.id }))

  const dmResult = await notifier.sendTokenDM(interaction.client, user.id, {
    token, machine_id_short, expires_at, label,
  })

  const mask = tokenMask(token)
  if (dmResult.ok) {
    await interaction.editReply(
      `✅ Đã cấp license cho <@${user.id}>.\nToken mask: \`${mask}\`\nDM đã gửi thành công.`
    )
  } else {
    await interaction.editReply(
      `⚠️ Token đã tạo nhưng DM thất bại (user khóa DM?).\n` +
      `Token plaintext (chỉ hiển thị 1 lần):\n\`\`\`${token}\`\`\`\nHãy gửi thủ công cho user.`
    )
  }

  await notifier.logAuditEvent(interaction.client, process.env.LICENSE_AUDIT_CHANNEL_ID, {
    type: 'issue',
    user_id: user.id,
    by: interaction.user.id,
    token_mask: mask,
    machine_short: machine_id_short,
    label,
    expires_at,
    dm_ok: dmResult.ok,
  })
}

async function handleRevoke(interaction) {
  await interaction.deferReply({ ephemeral: true })

  const target = interaction.options.getString('target').trim()
  const reason = interaction.options.getString('reason') || null

  const row = resolveTarget(target)
  if (!row) {
    return interaction.editReply('❌ Không tìm thấy token.')
  }
  if (row.ambiguous) {
    return interaction.editReply(`❌ Token prefix khớp với nhiều license (${row.count} matches). Dùng chuỗi dài hơn hoặc @user mention.`)
  }
  if (row.revoked) {
    return interaction.editReply(`⚠️ License \`${tokenMask(row.token)}\` đã bị revoke trước đó.`)
  }

  db.revoke(row.id)
  db.recordEvent(row.id, 'revoke', null, null, JSON.stringify({ by: interaction.user.id, reason }))

  let dmNote = ''
  if (row.discord_user_id) {
    const dmResult = await notifier.sendRevokedDM(interaction.client, row.discord_user_id, reason)
    dmNote = dmResult.ok ? ' DM thông báo đã gửi.' : ' (DM thất bại — user cần tự liên hệ)'
  }

  await interaction.editReply(
    `✅ Đã revoke license \`${tokenMask(row.token)}\` (label: ${row.user_label || '—'}).${dmNote}`
  )

  await notifier.logAuditEvent(interaction.client, process.env.LICENSE_AUDIT_CHANNEL_ID, {
    type: 'revoke',
    user_id: row.discord_user_id,
    by: interaction.user.id,
    token_mask: tokenMask(row.token),
    machine_short: row.machine_id_short,
    label: row.user_label,
    reason,
  })
}

async function handleResetMachine(interaction) {
  await interaction.deferReply({ ephemeral: true })

  const target = interaction.options.getString('target').trim()

  const row = resolveTarget(target)
  if (!row) {
    return interaction.editReply('❌ Không tìm thấy token.')
  }
  if (row.ambiguous) {
    return interaction.editReply(`❌ Token prefix khớp với nhiều license (${row.count} matches). Dùng chuỗi dài hơn hoặc @user mention.`)
  }
  if (row.revoked) {
    return interaction.editReply(`❌ License \`${tokenMask(row.token)}\` đã bị revoke, không thể reset.`)
  }

  const oldMachineShort = row.machine_id_short || '(chưa bind)'
  db.resetMachine(row.id)
  db.recordEvent(row.id, 'reset', null, null, JSON.stringify({ by: interaction.user.id, old_machine: oldMachineShort }))

  let dmNote = ''
  if (row.discord_user_id) {
    const dmResult = await notifier.sendResetDM(interaction.client, row.discord_user_id)
    dmNote = dmResult.ok ? ' DM thông báo đã gửi.' : ' (DM thất bại)'
  }

  await interaction.editReply(
    `✅ Đã reset machine binding cho \`${tokenMask(row.token)}\`.\nMáy cũ: \`${oldMachineShort}\`.${dmNote}`
  )

  await notifier.logAuditEvent(interaction.client, process.env.LICENSE_AUDIT_CHANNEL_ID, {
    type: 'reset',
    user_id: row.discord_user_id,
    by: interaction.user.id,
    token_mask: tokenMask(row.token),
    machine_short: oldMachineShort,
    label: row.user_label,
  })
}

async function handleInfo(interaction) {
  await interaction.deferReply({ ephemeral: true })

  const user = interaction.options.getUser('user')
  const rows = db.listByDiscordUser(user.id)

  if (!rows || rows.length === 0) {
    return interaction.editReply(`ℹ️ <@${user.id}> không có license nào.`)
  }

  const embeds = rows.slice(0, 5).map(row => {
    const lastSeen = row.last_seen
      ? `<t:${row.last_seen}:R>`
      : 'Chưa dùng'
    return new EmbedBuilder()
      .setColor(row.revoked ? 0xef4444 : 0x6366f1)
      .setTitle(`License: ${row.user_label || tokenMask(row.token)}`)
      .addFields(
        { name: 'Token',    value: `\`${tokenMask(row.token)}\``, inline: true },
        { name: 'Status',   value: statusLabel(row),               inline: true },
        { name: 'Machine',  value: row.machine_id_short ? `\`${row.machine_id_short}\`` : '—', inline: true },
        { name: 'Hết hạn',  value: expStr(row.expires_at),         inline: true },
        { name: 'Last seen',value: lastSeen,                        inline: true },
        { name: 'Version',  value: row.app_version || '—',          inline: true },
      )
  })

  await interaction.editReply({ content: `**License của <@${user.id}>** (${rows.length} total)`, embeds })
}

async function handleList(interaction) {
  await interaction.deferReply({ ephemeral: true })

  const filterUser = interaction.options.getUser('user')
  let rows

  if (filterUser) {
    rows = db.listByDiscordUser(filterUser.id)
  } else {
    rows = db.list()
  }

  if (!rows || rows.length === 0) {
    return interaction.editReply('ℹ️ Không có license nào.')
  }

  // Paginate: cap at 25 entries, build text table
  const display = rows.slice(0, 25)
  const lines = display.map((r, i) => {
    const mask = tokenMask(r.token)
    const status = statusLabel(r)
    const label = r.user_label || '—'
    const uid = r.discord_user_id ? `<@${r.discord_user_id}>` : '—'
    return `**${i + 1}.** \`${mask}\` | ${status} | ${label} | ${uid}`
  })

  const header = filterUser
    ? `**Licenses của <@${filterUser.id}>** (${rows.length} total)`
    : `**Tất cả licenses** (${rows.length} total${rows.length > 25 ? ', hiển thị 25 đầu' : ''})`

  await interaction.editReply(`${header}\n\n${lines.join('\n')}`)
}

// ---- Slash command definition ----

module.exports = {
  data: new SlashCommandBuilder()
    .setName('license')
    .setDescription('WindowHelper license management')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    .addSubcommand(sub => sub
      .setName('issue')
      .setDescription('Cấp token mới, bind sẵn machine ID')
      .addUserOption(o => o.setName('user').setDescription('Discord user nhận token').setRequired(true))
      .addStringOption(o => o.setName('machine_id').setDescription('64 hex HWID từ app activation dialog').setRequired(true))
      .addStringOption(o => o.setName('label').setDescription('Tên license, vd: PT-acc-1').setRequired(true))
      .addIntegerOption(o => o.setName('expires_days').setDescription('Số ngày hết hạn (bỏ trống = vĩnh viễn)').setMinValue(1))
      .addStringOption(o => o.setName('note').setDescription('Ghi chú nội bộ'))
    )

    .addSubcommand(sub => sub
      .setName('revoke')
      .setDescription('Thu hồi license')
      .addStringOption(o => o.setName('target').setDescription('Token mask (abcd****ef12) hoặc @user mention / user ID').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Lý do thu hồi'))
    )

    .addSubcommand(sub => sub
      .setName('reset-machine')
      .setDescription('Xoá machine binding (user đổi PC)')
      .addStringOption(o => o.setName('target').setDescription('Token mask hoặc @user mention / user ID').setRequired(true))
    )

    .addSubcommand(sub => sub
      .setName('info')
      .setDescription('Xem thông tin license của một user')
      .addUserOption(o => o.setName('user').setDescription('Discord user cần xem').setRequired(true))
    )

    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('Liệt kê licenses (tất cả hoặc lọc theo user)')
      .addUserOption(o => o.setName('user').setDescription('Lọc theo user (bỏ trống = tất cả)'))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand()
    if (sub === 'issue')         return handleIssue(interaction)
    if (sub === 'revoke')        return handleRevoke(interaction)
    if (sub === 'reset-machine') return handleResetMachine(interaction)
    if (sub === 'info')          return handleInfo(interaction)
    if (sub === 'list')          return handleList(interaction)
    await interaction.reply({ content: '❌ Subcommand không hợp lệ.', ephemeral: true })
  },
}
