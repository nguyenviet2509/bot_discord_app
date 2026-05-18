// In-memory state cho rules can theo doi qua thoi gian (flood, repeat).
// State mat khi restart bot - chap nhan duoc cho MVP (vi pham ngan han).

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000 // 5 phut
const MAX_KEY_AGE_MS = 10 * 60 * 1000    // Xoa key khong active 10 phut

// FloodTracker: dem so tin nhan trong cua so thoi gian.
// Key dang `${guildId}:${userId}`.
class FloodTracker {
  constructor() {
    this.buckets = new Map() // key -> { timestamps: [], lastTouch }
  }

  // Push timestamp moi, lay so tin trong windowMs gan day.
  push(key, ts, windowMs) {
    const cutoff = ts - windowMs
    let entry = this.buckets.get(key)
    if (!entry) {
      entry = { timestamps: [], lastTouch: ts }
      this.buckets.set(key, entry)
    }
    entry.timestamps = entry.timestamps.filter(t => t > cutoff)
    entry.timestamps.push(ts)
    entry.lastTouch = ts
    return entry.timestamps.length
  }

  cleanup(now) {
    for (const [key, entry] of this.buckets) {
      if (now - entry.lastTouch > MAX_KEY_AGE_MS) {
        this.buckets.delete(key)
      }
    }
  }
}

// RepeatTracker: dem so lan gui CUNG noi dung lien tiep.
class RepeatTracker {
  constructor() {
    this.lastMessages = new Map() // key -> { content, count, lastTouch }
  }

  // Tra ve so lan lap (>=1).
  push(key, content, ts) {
    let entry = this.lastMessages.get(key)
    if (!entry || entry.content !== content) {
      entry = { content, count: 1, lastTouch: ts }
    } else {
      entry.count += 1
      entry.lastTouch = ts
    }
    this.lastMessages.set(key, entry)
    return entry.count
  }

  cleanup(now) {
    for (const [key, entry] of this.lastMessages) {
      if (now - entry.lastTouch > MAX_KEY_AGE_MS) {
        this.lastMessages.delete(key)
      }
    }
  }
}

const flood = new FloodTracker()
const repeat = new RepeatTracker()

// Cleanup interval - chay dinh ky de tranh leak.
setInterval(() => {
  const now = Date.now()
  flood.cleanup(now)
  repeat.cleanup(now)
}, CLEANUP_INTERVAL_MS).unref()

module.exports = { flood, repeat }
