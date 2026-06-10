import { getStats } from '../utils/visitors'

export default defineEventHandler(async (event) => {
  const result = await getStats()
  console.log(`[Visitor] GET stats - total: ${result.total}, today: ${result.today}, online: ${result.online}`)
  return result
})