// In-memory cache cho image URL pending khi member /post hoac /post-edit
// Discord modal khong support file input -> cache image tu slash command,
// modal submit se lay ra
// Key: `${userId}:${kind}` (kind = 'create' | 'edit:<postId>')
// TTL: 10 phut (modal het han o 15 phut, cho buffer)

const TTL_MS = 10 * 60 * 1000
const store = new Map() // key -> { url, expires }

function setPending(key, url) {
  store.set(key, { url, expires: Date.now() + TTL_MS })
}

function takePending(key) {
  const entry = store.get(key)
  if (!entry) return null
  store.delete(key)
  if (entry.expires < Date.now()) return null
  return entry.url
}

// Cleanup dinh ky entries het han
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of store) if (v.expires < now) store.delete(k)
}, 60_000).unref?.()

module.exports = { setPending, takePending }
