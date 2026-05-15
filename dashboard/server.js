require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')
const { initDb } = require('../shared/db')

initDb()

const app = express()
const PORT = process.env.PORT || process.env.DASHBOARD_PORT || 3001
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..')
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

if (!process.env.DASHBOARD_SECRET || process.env.DASHBOARD_SECRET.length < 16) {
  console.warn('[Dashboard] ⚠️  DASHBOARD_SECRET quá ngắn hoặc chưa được đặt (tối thiểu 16 ký tự)!')
}

const corsOrigins = [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`]
if (process.env.BASE_URL) corsOrigins.push(process.env.BASE_URL)
app.use(cors({ origin: corsOrigins }))
app.use(express.json())

// Static: uploads và frontend
app.use('/uploads', express.static(UPLOADS_DIR))
app.use(express.static(path.join(__dirname, 'public')))

// API routes
const auth = require('./middleware/auth')
app.use('/api/auth', require('./routes/auth'))
app.use('/api/rewards', auth, require('./routes/rewards'))
app.use('/api/members', auth, require('./routes/members'))
app.use('/api/settings', auth, require('./routes/settings'))
app.use('/api/discord/roles', auth, require('./routes/discord-roles'))
app.use('/api/commands', auth, require('./routes/commands'))
app.use('/api/servers', auth, require('./routes/servers'))
app.use('/api/links', auth, require('./routes/links'))
app.use('/api/level-up-template', auth, require('./routes/level-up-template'))
app.use('/api/welcome-template', auth, require('./routes/welcome-template'))
app.use('/api/moderation', auth, require('./routes/moderation'))
app.use('/api/analytics', auth, require('./routes/analytics'))
app.use('/api/scheduled-messages', auth, require('./routes/scheduled-messages'))
app.use('/api/flair-config', auth, require('./routes/flair-config'))

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Dashboard] ✅ Running on port ${PORT}`)
})
