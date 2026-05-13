require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const express = require('express')
const cors = require('cors')
const path = require('path')
const { initDb } = require('../shared/db')

initDb()

const app = express()
const PORT = process.env.DASHBOARD_PORT || 3001

if (!process.env.DASHBOARD_SECRET || process.env.DASHBOARD_SECRET.length < 16) {
  console.warn('[Dashboard] ⚠️  DASHBOARD_SECRET quá ngắn hoặc chưa được đặt (tối thiểu 16 ký tự)!')
}

app.use(cors({ origin: [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`] }))
app.use(express.json())

// Static: uploads và frontend
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))
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

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`[Dashboard] ✅ Running at http://localhost:${PORT}`)
})
