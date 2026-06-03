import { recordVisit } from '../utils/visitors'

export default defineEventHandler(async (event) => {
  const ip = getClientIP(event) || 'unknown'
  const stats = await recordVisit(ip)
  
  return {
    success: true,
    data: {
      total: stats.total,
      today: stats.today,
      online: stats.online,
    },
  }
})

function getClientIP(event: any): string | undefined {
  const headers = event.node.req.headers
  return (
    headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    headers['x-real-ip'] ||
    headers['cf-connecting-ip'] ||
    event.node.req.connection?.remoteAddress ||
    event.node.req.socket?.remoteAddress
  )
}