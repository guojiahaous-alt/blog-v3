<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { UtilDate } from '#components'

const appConfig = useAppConfig()
const runtimeConfig = useRuntimeConfig()

const { data: stats } = useFetch('/api/stats')

const yearlyTip = computed(() => Object
	.entries(stats.value?.annual || {})
	.reverse()
	.map(([year, item]) => `${year}年：${item.posts}篇，${formatNumber(item.words)}字`)
	.join('\n') || '数据获取失败',
)

const isClient = typeof window !== 'undefined'

const getVisitorId = (): string => {
  const storageKey = 'blog_visitor_id'
  
  if (typeof localStorage === 'undefined') {
    return 'ssr-' + Math.random().toString(36).substring(2, 15)
  }
  
  let visitorId = localStorage.getItem(storageKey)
  
  if (!visitorId) {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 10)
    const screenInfo = isClient ? `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}` : 'unknown'
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const hash = btoa(`${timestamp}${random}${screenInfo}${timezone}`).substring(0, 24)
    visitorId = `${timestamp}-${hash}`
    localStorage.setItem(storageKey, visitorId)
  }
  
  return visitorId
}

const visitorStats = ref({
	total: 0,
	today: 0,
	online: 0,
})

let refreshInterval: ReturnType<typeof setInterval> | null = null

const fetchVisitorStats = async () => {
	try {
		const response = await fetch('/api/visitors')
		const data = await response.json()
		visitorStats.value = {
			total: data.total,
			today: data.today,
			online: data.online,
		}
	} catch (e) {
		console.error('Failed to fetch visitor stats:', e)
	}
}

const recordVisit = async () => {
	if (!isClient) return
	
	try {
		const visitorId = getVisitorId()
		console.log('Recording visit (BlogStats):', visitorId)
		const response = await fetch('/api/visitors', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Visitor-ID': visitorId,
			},
			body: JSON.stringify({ visitorId }),
		})
		const data = await response.json()
		console.log('Visit recorded (BlogStats):', data)
		await fetchVisitorStats()
	} catch (e) {
		console.error('Failed to record visit:', e)
	}
}

const formatVisitorNumber = (num: number): string => {
	if (num >= 10000) {
		return (num / 10000).toFixed(1) + 'w'
	}
	return num.toLocaleString()
}

onMounted(() => {
	recordVisit()
	refreshInterval = setInterval(fetchVisitorStats, 10000)
})

onUnmounted(() => {
	if (refreshInterval) {
		clearInterval(refreshInterval)
	}
})

const blogStats = [{
	label: '运营时长',
	value: timeElapse(appConfig.timeEstablished),
	tip: `博客于${appConfig.timeEstablished}上线`,
}, {
	label: '上次更新',
	value: () => h(UtilDate, {
		date: runtimeConfig.public.buildTime,
		relative: true,
		tipPrefix: '构建于',
	}),
}, {
	label: '总字数',
	value: computed(() => formatNumber(stats.value?.total?.words) || '--'),
	tip: yearlyTip,
}]
</script>

<template>
<BlogWidget card title="博客统计">
	<ZDlGroup :items="blogStats" size="small" />
	<div class="visitor-stats" style="margin-top: 1rem; border-top: 1px solid var(--c-border); padding-top: 1rem;">
		<div class="stats-container" style="display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: flex-start;">
			<div class="stat-item" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; background: var(--c-bg); border-radius: 0.5rem;">
				<Icon name="tabler:users" style="color: var(--c-primary); width: 1.25rem; height: 1.25rem;" />
				<div style="display: flex; flex-direction: column;">
					<span style="font-size: 1rem; font-weight: 700; color: var(--c-text);">{{ formatVisitorNumber(visitorStats.total) }}</span>
					<span style="font-size: 0.7rem; color: var(--c-text-2);">总访问量</span>
				</div>
			</div>
			<div class="stat-item" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; background: var(--c-bg); border-radius: 0.5rem;">
				<Icon name="tabler:calendar" style="color: var(--c-primary); width: 1.25rem; height: 1.25rem;" />
				<div style="display: flex; flex-direction: column;">
					<span style="font-size: 1rem; font-weight: 700; color: var(--c-text);">{{ formatVisitorNumber(visitorStats.today) }}</span>
					<span style="font-size: 0.7rem; color: var(--c-text-2);">今日访问</span>
				</div>
			</div>
			<div class="stat-item" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; background: var(--c-bg); border-radius: 0.5rem;">
				<Icon name="tabler:circle-dot" style="color: #10b981; width: 1.25rem; height: 1.25rem;" />
				<div style="display: flex; flex-direction: column;">
					<span style="font-size: 1rem; font-weight: 700; color: #10b981;">{{ visitorStats.online }}</span>
					<span style="font-size: 0.7rem; color: var(--c-text-2);">当前在线</span>
				</div>
			</div>
		</div>
	</div>
</BlogWidget>
</template>