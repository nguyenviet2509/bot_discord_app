const express = require('express')
const path = require('path')
const fs = require('fs')

const router = express.Router()

router.get('/', (req, res) => {
  const commandsPath = path.join(__dirname, '../../bot/src/commands')
  const commands = []

  try {
    const files = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))
    for (const file of files) {
      try {
        const cmd = require(path.join(commandsPath, file))
        if (!cmd.data) continue
        const data = cmd.data.toJSON ? cmd.data.toJSON() : cmd.data
        const options = (data.options || []).map((opt) => ({
          name: opt.name,
          description: opt.description,
          type: opt.type,
          required: opt.required || false,
        }))
        commands.push({
          name: data.name,
          description: data.description,
          options,
          defaultMemberPermissions: data.default_member_permissions || null,
        })
      } catch (_) {}
    }
  } catch (err) {
    return res.status(500).json({ error: 'Cannot read commands directory' })
  }

  res.json(commands)
})

module.exports = router
