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
    // 确保数据结构完整
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

function cleanupOnline(stats: VisitorStats): { stats: VisitorStats; removedCount: number } {
  const now = Date.now()
  let onlineCount = 0
  let removedCount = 0

  for (const [ip, record] of Object.entries(stats.todayRecords)) {
    if (now - record.lastVisit > ONLINE_TIMEOUT) {
      delete stats.todayRecords[ip]
      removedCount++
    } else {
      onlineCount++
    }
  }

  return { stats: { ...stats, online: onlineCount }, removedCount }
}

async function writeStatsSafe(stats: VisitorStats): Promise<void> {
  // 如果正在写入，将操作加入队列
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
    
    // 处理排队的写入操作
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
  // 初始化缓存
  if (!cachedStats) {
    cachedStats = await initStats()
  }

  // 检查是否是新的一天，如果是则重置数据
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

  // 获取当前统计数据（基于缓存）
  let stats = JSON.parse(JSON.stringify(cachedStats))
  const now = Date.now()

  // 清理超时的在线用户
  const cleanupResult = cleanupOnline(stats)
  stats = cleanupResult.stats

  // 记录新的访问
  if (!stats.todayRecords[ip]) {
    // 新IP访问：增加 total 和 today
    stats.today++
    stats.total++
    stats.todayRecords[ip] = { count: 1, lastVisit: now }
  } else {
    // 已存在的IP：只更新时间戳
    stats.todayRecords[ip].lastVisit = now
  }

  // 更新缓存和文件
  cachedStats = JSON.parse(JSON.stringify(stats))
  
  try {
    await writeStatsSafe(stats)
  } catch (e) {
    console.error('Failed to save visitor stats:', e)
  }

  return stats
}

export async function getStats(): Promise<VisitorStats> {
  // 初始化缓存
  if (!cachedStats) {
    cachedStats = await initStats()
  }

  // 创建统计数据副本
  let stats = JSON.parse(JSON.stringify(cachedStats))

  // 检查是否是新的一天
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

  // 清理超时的在线用户（不影响 today 和 todayRecords）
  const cleanupResult = cleanupOnline(stats)
  stats = cleanupResult.stats

  return stats
}
