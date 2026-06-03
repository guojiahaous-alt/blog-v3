import { recordVisit, getStats } from '../utils/visitors'

export default defineEventHandler(async (event) => {
  const ip = getClientIP(event) || 'unknown'
  
  if (event.node.req.method === 'POST') {
    return await recordVisit(ip)
  }
  
  return await getStats()
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