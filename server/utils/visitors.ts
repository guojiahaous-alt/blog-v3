import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

export interface VisitorStats {
  total: number
  today: number
  online: number
  todayRecords: Record<string, { count: number; lastVisit: number }>
  lastResetTime: number
}

const STATS_DIR = join(process.cwd(), 'data')
const STATS_FILE = join(STATS_DIR, 'visitors.json')
const ONLINE_TIMEOUT = 300000
const RATE_LIMIT_DURATION = 60000
const RATE_LIMIT_MAX = 10

let cachedStats: VisitorStats | null = null
let rateLimitCache = new Map<string, { count: number; timestamp: number }>()

async function initStats(): Promise<VisitorStats> {
  try {
    await mkdir(STATS_DIR, { recursive: true })
    const data = await readFile(STATS_FILE, 'utf-8')
    return JSON.parse(data)
  } catch {
    return {
      total: 0,
      today: 0,
      online: 0,
      todayRecords: {},
      lastResetTime: Date.now(),
    }
  }
}

function isNewDay(lastReset: number): boolean {
  const lastDate = new Date(lastReset)
  const now = new Date()
  return (
    lastDate.getDate() !== now.getDate() ||
    lastDate.getMonth() !== now.getMonth() ||
    lastDate.getFullYear() !== now.getFullYear()
  )
}

function cleanupOnline(stats: VisitorStats): VisitorStats {
  const now = Date.now()
  let onlineCount = 0

  for (const [ip, record] of Object.entries(stats.todayRecords)) {
    if (now - record.lastVisit > ONLINE_TIMEOUT) {
      delete stats.todayRecords[ip]
    } else {
      onlineCount++
    }
  }

  return { ...stats, online: onlineCount }
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const existing = rateLimitCache.get(ip)

  if (!existing) {
    rateLimitCache.set(ip, { count: 1, timestamp: now })
    return true
  }

  if (now - existing.timestamp > RATE_LIMIT_DURATION) {
    rateLimitCache.set(ip, { count: 1, timestamp: now })
    return true
  }

  if (existing.count >= RATE_LIMIT_MAX) {
    return false
  }

  rateLimitCache.set(ip, { count: existing.count + 1, timestamp: now })
  return true
}

export async function recordVisit(ip: string): Promise<VisitorStats> {
  if (!checkRateLimit(ip)) {
    return getStats()
  }

  if (!cachedStats) {
    cachedStats = await initStats()
  }

  let stats = { ...cachedStats }

  if (isNewDay(stats.lastResetTime)) {
    stats = {
      total: stats.total,
      today: 0,
      online: 0,
      todayRecords: {},
      lastResetTime: Date.now(),
    }
  }

  const now = Date.now()

  if (!stats.todayRecords[ip]) {
    stats.today++
    stats.total++
    stats.todayRecords[ip] = { count: 1, lastVisit: now }
  } else {
    stats.todayRecords[ip].count++
    stats.todayRecords[ip].lastVisit = now
  }

  stats = cleanupOnline(stats)

  cachedStats = stats

  try {
    await writeFile(STATS_FILE, JSON.stringify(stats, null, 2))
  } catch (e) {
    console.error('Failed to save visitor stats:', e)
  }

  return stats
}

export async function getStats(): Promise<VisitorStats> {
  if (!cachedStats) {
    cachedStats = await initStats()
  }

  let stats = cleanupOnline({ ...cachedStats })

  if (isNewDay(stats.lastResetTime)) {
    stats = {
      total: stats.total,
      today: 0,
      online: 0,
      todayRecords: {},
      lastResetTime: Date.now(),
    }
    cachedStats = stats
    
    try {
      await writeFile(STATS_FILE, JSON.stringify(stats, null, 2))
    } catch (e) {
      console.error('Failed to save visitor stats:', e)
    }
  }

  return stats
}
