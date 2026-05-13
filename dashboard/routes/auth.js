const express = require('express')
const jwt = require('jsonwebtoken')

const router = express.Router()

router.post('/login', (req, res) => {
  const { username, password } = req.body

  if (
    username !== process.env.DASHBOARD_USERNAME ||
    password !== process.env.DASHBOARD_PASSWORD
  ) {
    return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' })
  }

  const token = jwt.sign({ username }, process.env.DASHBOARD_SECRET, { expiresIn: '7d' })
  res.json({ token })
})

module.exports = router
