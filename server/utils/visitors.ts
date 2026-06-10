import { Redis } from '@upstash/redis'

export interface VisitorStats {
  total: number
  today: number
  online: number
  todayRecords: Record<string, { count: number; lastVisit: number }>
  lastResetTime: number
}

const ONLINE_TIMEOUT = 300000

const defaultStats: VisitorStats = {
  total: 0,
  today: 0,
  online: 0,
  todayRecords: {},
  lastResetTime: Date.now(),
}

let redis: ReturnType<typeof Redis.fromEnv> | null = null

try {
  redis = new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  })
} catch (error) {
  console.warn('[Visitor] Redis initialization failed:', error)
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

export async function recordVisit(ip: string, visitorId?: string): Promise<VisitorStats> {
  if (!redis) {
    console.warn('[Visitor] Redis not available')
    return defaultStats
  }

  let stats = defaultStats

  try {
    const stored = await redis.get<VisitorStats>('visitor-stats')
    if (stored) {
      stats = stored
    }
  } catch (error) {
    console.warn('[Visitor] Failed to get stats:', error)
  }

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
  const recordKey = visitorId ? `vid:${visitorId}` : `ip:${ip}`

  // 每次访问都增加总访问量（PV）
  stats.total++

  // 如果是新访客，增加今日访问量（UV）
  if (!stats.todayRecords[recordKey]) {
    stats.today++
    stats.todayRecords[recordKey] = { count: 1, lastVisit: now }
  } else {
    stats.todayRecords[recordKey].lastVisit = now
  }

  // 在线人数：5分钟内活跃的访客
  stats.online = calculateOnline(stats)

  try {
    await redis.set('visitor-stats', stats)
  } catch (error) {
    console.warn('[Visitor] Failed to save stats:', error)
  }

  return stats
}

export async function getStats(): Promise<VisitorStats> {
  if (!redis) {
    console.warn('[Visitor] Redis not available')
    return defaultStats
  }

  let stats = defaultStats

  try {
    const stored = await redis.get<VisitorStats>('visitor-stats')
    if (stored) {
      stats = stored
    }
  } catch (error) {
    console.warn('[Visitor] Failed to get stats:', error)
    return defaultStats
  }

  if (isNewDay(stats.lastResetTime)) {
    stats = {
      total: stats.total,
      today: 0,
      online: 0,
      todayRecords: {},
      lastResetTime: Date.now(),
    }
    try {
      await redis.set('visitor-stats', stats)
    } catch (error) {
      console.warn('[Visitor] Failed to save reset stats:', error)
    }
  }

  stats.online = calculateOnline(stats)

  return stats
}