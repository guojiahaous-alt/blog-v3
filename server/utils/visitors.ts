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

let cachedStats: VisitorStats | null = null
let isWriting = false
let pendingWrites: (() => Promise<void>)[] = []

async function initStats(): Promise<VisitorStats> {
  try {
    await mkdir(STATS_DIR, { recursive: true })
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
    console.error('Failed to save visitor stats:', e)
    throw e
  } finally {
    isWriting = false
  }
}

export async function recordVisit(ip: string): Promise<VisitorStats> {
  if (!cachedStats) {
    cachedStats = await initStats()
  }

  if (isNewDay(cachedStats.lastResetTime)) {
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

  if (!stats.todayRecords[ip]) {
    stats.today++
    stats.total++
    stats.todayRecords[ip] = { count: 1, lastVisit: now }
  } else {
    stats.todayRecords[ip].lastVisit = now
  }

  stats.online = calculateOnline(stats)

  cachedStats = JSON.parse(JSON.stringify(stats))
  
  try {
    await writeStatsSafe(stats)
  } catch (e) {
    console.error('Failed to save visitor stats:', e)
  }

  return stats
}

export async function getStats(): Promise<VisitorStats> {
  if (!cachedStats) {
    cachedStats = await initStats()
  }

  let stats = JSON.parse(JSON.stringify(cachedStats))

  if (isNewDay(stats.lastResetTime)) {
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
      console.error('Failed to save visitor stats:', e)
    }
  }

  stats.online = calculateOnline(stats)

  return stats
}