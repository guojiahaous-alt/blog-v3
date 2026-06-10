import { recordVisit } from '../utils/visitors'

export default defineEventHandler(async (event) => {
  const headers = event.node.req.headers
  const ip = getClientIP(event) || 'unknown'
  
  const body = await readBody(event).catch(() => ({}))
  const visitorId = body.visitorId || headers['x-visitor-id'] as string
  const userAgent = headers['user-agent'] as string
  
  console.log(`[Visitor] Recording visit - IP: ${ip}, VisitorID: ${visitorId ? 'present' : 'absent'}, UserAgent: ${userAgent ? 'present' : 'absent'}`)
  
  const result = await recordVisit(ip, visitorId, userAgent)
  console.log(`[Visitor] Recorded successfully - total: ${result.total}, today: ${result.today}, online: ${result.online}`)
  
  return result
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