import { readFile, writeFile, mkdir, access } from 'fs/promises'
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

let cachedStats: VisitorStats | null = null
let isWriting = false
let pendingWrites: (() => Promise<void>)[] = []

const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL_URL

async function initStats(): Promise<VisitorStats> {
  try {
    await mkdir(STATS_DIR, { recursive: true })
    
    try {
      await access(STATS_FILE)
      const data = await readFile(STATS_FILE, 'utf-8')
      const parsed = JSON.parse(data)
      
      return {
        total: parsed.total || 0,
        today: parsed.today || 0,
        online: parsed.online || 0,
        todayRecords: parsed.todayRecords || {},
        lastResetTime: parsed.lastResetTime || Date.now(),
      }
    } catch {
      console.log('[Visitor] Stats file not found, creating new')
      return {
        total: 0,
        today: 0,
        online: 0,
        todayRecords: {},
        lastResetTime: Date.now(),
      }
    }
  } catch (e) {
    console.error('[Visitor] Failed to init stats:', e)
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

function calculateOnline(stats: VisitorStats): number {
  const now = Date.now()
  let onlineCount = 0

  for (const record of Object.values(stats.todayRecords)) {
    if (now - record.lastVisit <= ONLINE_TIMEOUT) {
      onlineCount++
    }
  }

  return onlineCount
}

async function writeStatsSafe(stats: VisitorStats): Promise<void> {
  if (isWriting) {
    return new Promise((resolve) => {
      pendingWrites.push(async () => {
        await writeFile(STATS_FILE, JSON.stringify(stats, null, 2))
        resolve()
      })
    })
  }

  isWriting = true
  try {
    await writeFile(STATS_FILE, JSON.stringify(stats, null, 2))
    
    while (pendingWrites.length > 0) {
      const write = pendingWrites.shift()
      if (write) await write()
    }
  } catch (e) {
    console.error('[Visitor] Failed to save visitor stats:', e)
    throw e
  } finally {
    isWriting = false
  }
}

export async function recordVisit(
  ip: string,
  visitorId?: string,
  userAgent?: string
): Promise<VisitorStats> {
  console.log(`[Visitor] Recording visit - IP: ${ip}, VisitorID: ${visitorId ? 'present' : 'absent'}, Vercel: ${isVercel}`)
  
  if (!cachedStats) {
    cachedStats = await initStats()
    console.log(`[Visitor] Initialized stats: total=${cachedStats.total}, today=${cachedStats.today}, online=${cachedStats.online}`)
  }

  if (isNewDay(cachedStats.lastResetTime)) {
    console.log('[Visitor] New day detected, resetting today stats')
    cachedStats = {
      total: cachedStats.total,
      today: 0,
      online: 0,
      todayRecords: {},
      lastResetTime: Date.now(),
    }
    await writeStatsSafe(cachedStats)
  }

  let stats = JSON.parse(JSON.stringify(cachedStats))
  const now = Date.now()

  let recordKey: string
  
  if (visitorId) {
    recordKey = `vid:${visitorId}`
  } else if (userAgent) {
    const crypto = await import('crypto')
    const hash = crypto.createHash('sha256').update(`${ip}:${userAgent}`).digest('hex').substring(0, 16)
    recordKey = `ua:${hash}`
  } else {
    recordKey = `ip:${ip}`
  }

  if (!stats.todayRecords[recordKey]) {
    stats.total++
    stats.todayRecords[recordKey] = { count: 1, lastVisit: now }
    console.log(`[Visitor] New visitor: ${recordKey}, total=${stats.total}`)
  } else {
    stats.todayRecords[recordKey].lastVisit = now
    console.log(`[Visitor] Existing visitor: ${recordKey}, updated lastVisit`)
  }

  stats.today = Object.keys(stats.todayRecords).length
  stats.online = calculateOnline(stats)

  cachedStats = JSON.parse(JSON.stringify(stats))
  
  try {
    await writeStatsSafe(stats)
    console.log(`[Visitor] Stats saved: total=${stats.total}, today=${stats.today}, online=${stats.online}`)
  } catch (e) {
    console.error('[Visitor] Failed to save visitor stats:', e)
  }

  return stats
}

export async function getStats(): Promise<VisitorStats> {
  console.log('[Visitor] Getting stats, Vercel:', isVercel)
  
  if (!cachedStats) {
    cachedStats = await initStats()
    console.log(`[Visitor] Initialized stats from cache: total=${cachedStats.total}, today=${cachedStats.today}`)
  }

  let stats = JSON.parse(JSON.stringify(cachedStats))

  if (isNewDay(stats.lastResetTime)) {
    console.log('[Visitor] New day in getStats, resetting')
    stats = {
      total: stats.total,
      today: 0,
      online: 0,
      todayRecords: {},
      lastResetTime: Date.now(),
    }
    cachedStats = JSON.parse(JSON.stringify(stats))
    
    try {
      await writeStatsSafe(stats)
    } catch (e) {
      console.error('[Visitor] Failed to save reset stats:', e)
    }
  }

  stats.today = Object.keys(stats.todayRecords).length
  stats.online = calculateOnline(stats)

  console.log(`[Visitor] Returning stats: total=${stats.total}, today=${stats.today}, online=${stats.online}`)
  return stats
}