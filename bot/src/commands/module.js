// /module list|enable|disable - admin quan ly bat/tat sub-module cho guild hien tai.
// Quyen: chi user co Administrator permission moi dung duoc.

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js')
const { isModuleEnabled, setModuleEnabled } = require('../../../shared/db-mini-game')

function resolveEnabled(manifest, dbState) {
  return dbState === null ? !!manifest.defaultEnabled : dbState
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('module')
    .setDescription('Quản lý sub-module (bot nhỏ) cho server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s.setName('list').setDescription('Xem danh sách module và trạng thái'))
    .addSubcommand(s => s
      .setName('enable').setDescription('Bật module')
      .addStringOption(o => o.setName('key').setDescription('Module key').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s
      .setName('disable').setDescription('Tắt module')
      .addStringOption(o => o.setName('key').setDescription('Module key').setRequired(true).setAutocomplete(true))),

  async autocomplete(interaction) {
    const modules = interaction.client._modules
    if (!modules) return interaction.respond([])
    const focused = (interaction.options.getFocused() || '').toLowerCase()
    const choices = [...modules.values()]
      .filter(m => !focused || m.key.includes(focused) || m.name.toLowerCase().includes(focused))
      .slice(0, 25)
      .map(m => ({ name: `${m.name} (${m.key})`, value: m.key }))
    await interaction.respond(choices).catch(() => {})
  },

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: 'Lệnh chỉ dùng trong server.', ephemeral: true })
    const sub = interaction.options.getSubcommand()
    const modules = interaction.client._modules || new Map()
    const guildId = interaction.guild.id

    if (sub === 'list') {
      if (modules.size === 0) return interaction.reply({ content: '📭 Chưa có module nào được cài.', ephemeral: true })
      const lines = [...modules.values()].map(m => {
        const dbState = isModuleEnabled(guildId, m.key)
        const enabled = resolveEnabled(m, dbState)
        const tag = enabled ? '🟢 BẬT' : '⚫ TẮT'
        const def = m.defaultEnabled ? 'mặc định: bật' : 'mặc định: tắt'
        return `${tag}  **${m.name}** \`${m.key}\`\n    ${m.description}\n    _${def} • commands: ${(m.commands || []).map(c => '/' + c).join(', ') || '(none)'}_`
      })
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x6366f1).setTitle('🧩 Modules trong server').setDescription(lines.join('\n\n'))],
        ephemeral: true,
      })
    }

    const key = interaction.options.getString('key')
    const manifest = modules.get(key)
    if (!manifest) return interaction.reply({ content: `❌ Không tìm thấy module \`${key}\`.`, ephemeral: true })

    if (sub === 'enable') {
      setModuleEnabled(guildId, key, true)
      return interaction.reply({ content: `✅ Đã **bật** module **${manifest.name}** (\`${key}\`). Các slash command thuộc module dùng được ngay.`, ephemeral: true })
    }
    if (sub === 'disable') {
      setModuleEnabled(guildId, key, false)
      return interaction.reply({ content: `⏸ Đã **tắt** module **${manifest.name}** (\`${key}\`). Slash command bị chặn cho đến khi bật lại.`, ephemeral: true })
    }
  },
}
