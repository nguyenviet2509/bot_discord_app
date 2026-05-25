// Slash command /roll-start: tao session ROLL multi-player.
// Send-before-insert pattern: post message truoc, insert DB voi message_id ngay.

const { SlashCommandBuilder, PermissionsBitField } = require('discord.js')
const store = require('../services/roll-session-store')
const timeoutMgr = require('../services/roll-timeout')
const renderer = require('../services/roll-renderer')
const lifecycle = require('../services/roll-lifecycle')

const MAX_PLAYERS_LIMIT = 100
const MIN_MINUTES = 1
const MAX_MINUTES = 60
const DEFAULT_MINUTES = 5

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roll-start')
    .setDescription('Tạo session ROLL — random điểm 1-100 không trùng, top 1 thắng')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addIntegerOption(o => o.setName('so-nguoi-toi-da')
      .setDescription(`Số người tối đa (2-${MAX_PLAYERS_LIMIT}, mặc định ${MAX_PLAYERS_LIMIT})`)
      .setMinValue(2).setMaxValue(MAX_PLAYERS_LIMIT))
    .addIntegerOption(o => o.setName('thoi-han-phut')
      .setDescription(`Thời hạn đăng ký theo phút (${MIN_MINUTES}-${MAX_MINUTES}, mặc định ${DEFAULT_MINUTES})`)
      .setMinValue(MIN_MINUTES).setMaxValue(MAX_MINUTES)),

  async execute(interaction) {
    const guild = interaction.guild
    if (!guild) return interaction.reply({ content: 'Lệnh chỉ dùng trong server.', ephemeral: true })

    // Double-check permission (defaultMemberPermissions chi la goi y UI, admin co the override)
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.reply({ content: '🚫 Chỉ admin (ManageGuild) mới được tạo session.', ephemeral: true })
    }

    // 1 guild = 1 session active (partial unique index ON roll_session WHERE state IN open/rolling)
    const active = store.getActiveSessionByGuild(guild.id)
    if (active) {
      return interaction.reply({
        content: `⚠️ Guild đã có session #${active.id} đang ${active.state}. Hủy session đó trước.`,
        ephemeral: true,
      })
    }

    const maxPlayers = interaction.options.getInteger('so-nguoi-toi-da') ?? MAX_PLAYERS_LIMIT
    const minutes = interaction.options.getInteger('thoi-han-phut') ?? DEFAULT_MINUTES
    const expiresAt = Math.floor(Date.now() / 1000) + minutes * 60

    // 1. Reply ephemeral defer truoc -> tranh "interaction failed" timeout 3s
    await interaction.deferReply({ ephemeral: true })

    // 2. Post placeholder message (lay message_id truoc khi insert DB)
    let msg
    try {
      msg = await interaction.channel.send({ content: '🎲 Đang tạo session ROLL...' })
    } catch (err) {
      return interaction.editReply({ content: '❌ Bot không gửi được message trong channel này (thiếu quyền?).' })
    }

    // 3. Insert DB voi message_id ngay tu dau. Catch UNIQUE constraint -> guild da co session active.
    let session
    try {
      session = store.createSession({
        guildId: guild.id,
        channelId: interaction.channelId,
        messageId: msg.id,
        hostId: interaction.user.id,
        maxPlayers,
        expiresAt,
      })
    } catch (err) {
      await msg.delete().catch(() => {})
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return interaction.editReply({ content: '⚠️ Guild đã có session active (race), thử lại sau.' })
      }
      console.error('[roll:create]', err)
      return interaction.editReply({ content: '❌ Lỗi tạo session.' })
    }

    // 4. Edit placeholder thanh embed thuc
    await msg.edit({
      content: '',
      embeds: [renderer.buildPendingEmbed({ session, participants: [] })],
      components: [renderer.buildPendingButtons(session.id, false)],
      allowedMentions: { parse: [] },
    }).catch(err => console.error('[roll:edit-initial]', err))

    // 5. Set timer expire
    timeoutMgr.set(session.id, minutes * 60 * 1000, () => lifecycle.onExpire(interaction.client, session.id))

    return interaction.editReply({ content: `✅ Đã tạo ROLL Session #${session.id}. Hết hạn <t:${expiresAt}:R>.` })
  },
}
