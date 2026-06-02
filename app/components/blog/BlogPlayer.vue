<script setup lang="ts">
interface MusicItem {
	name: string
	artist: string
	url: string
	cover?: string
	lrc?: string
	theme?: string
}

interface MetingConfig {
	server: 'netease' | 'tencent' | 'kugou' | 'xiami' | 'baidu'
	type: 'song' | 'playlist' | 'album' | 'search' | 'artist'
	id: string
}

const props = defineProps<{
	audio?: MusicItem[]
	meting?: MetingConfig
}>()

const playerContainer = ref<HTMLElement>()
const lyricContainer = ref<HTMLElement>()
const isMinimized = ref(false)
const showLyric = ref(true)
let ap: any = null
let currentLyricIndex = 0
let lyricLines: { time: number; text: string }[] = []

function loadScript(src: string): Promise<void> {
	return new Promise((resolve, reject) => {
		if (document.querySelector(`script[src="${src}"]`)) {
			resolve()
			return
		}
		const script = document.createElement('script')
		script.src = src
		script.onload = () => resolve()
		script.onerror = reject
		document.head.appendChild(script)
	})
}

function loadStyle(href: string) {
	if (document.querySelector(`link[href="${href}"]`))
		return
	const link = document.createElement('link')
	link.rel = 'stylesheet'
	link.href = href
	document.head.appendChild(link)
}

async function fetchMetingSongs(config: MetingConfig): Promise<MusicItem[]> {
	const apiBase = 'https://api.injahow.cn/meting/'
	const url = `${apiBase}?server=${config.server}&type=${config.type}&id=${config.id}`
	const res = await fetch(url)
	if (!res.ok)
		throw new Error(`Meting API error: ${res.status}`)
	const data = await res.json()
	return data.map((item: any) => ({
		name: item.title || item.name,
		artist: item.author || item.artist,
		url: item.url,
		cover: item.pic,
		lrc: item.lrc,
		theme: '#b7daff',
	}))
}

function parseLyric(lrcText: string): { time: number; text: string }[] {
	if (!lrcText)
		return []

	const lines = lrcText.split('\n')
	const result: { time: number; text: string }[] = []
	const timeRegex = /\[(\d{2}):(\d{2})(\.(\d{2,3}))?]/g

	for (const line of lines) {
		let match
		const times: number[] = []

		while ((match = timeRegex.exec(line)) !== null) {
			const minutes = parseInt(match[1])
			const seconds = parseInt(match[2])
			const milliseconds = match[4] ? parseInt(match[4]) / ((match[4].length === 2 ? 100 : 1000)) : 0
			times.push(minutes * 60 + seconds + milliseconds)
		}

		const text = line.replace(/\[.*?]/g, '').replace(/<.*?>/g, '').trim()
		
		if (times.length > 0 && text) {
			for (const time of times) {
				result.push({ time, text })
			}
		}
	}

	return result.sort((a, b) => a.time - b.time)
}

function updateLyric(currentTime: number) {
	if (!lyricContainer.value || lyricLines.length === 0)
		return

	let newIndex = -1
	
	for (let i = 0; i < lyricLines.length; i++) {
		const currentLineTime = lyricLines[i].time
		const nextLineTime = i < lyricLines.length - 1 ? lyricLines[i + 1].time : Infinity
		
		if (currentTime >= currentLineTime && currentTime < nextLineTime) {
			newIndex = i
			break
		}
	}

	if (newIndex === -1 && lyricLines.length > 0) {
		newIndex = lyricLines.length - 1
	}

	if (newIndex !== currentLyricIndex && newIndex !== -1) {
		currentLyricIndex = newIndex
		renderLyric()
	}
}

function renderLyric() {
	if (!lyricContainer.value || lyricLines.length === 0)
		return

	const container = lyricContainer.value
	container.innerHTML = ''

	const currentLine = lyricLines[currentLyricIndex]
	if (!currentLine)
		return

	const p = document.createElement('p')
	p.textContent = currentLine.text
	p.dataset.index = currentLyricIndex.toString()
	p.classList.add('lyric-current')

	container.appendChild(p)
}

const MAX_RETRY = 5
const RETRY_DELAY = 3000
const REQUEST_TIMEOUT = 15000

function checkNetworkStatus(): boolean {
	if (typeof navigator !== 'undefined' && navigator.onLine !== undefined) {
		return navigator.onLine
	}
	return true
}

function timeoutPromise<T>(promise: Promise<T>, ms: number): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			reject(new Error(`请求超时 (${ms}ms)`))
		}, ms)
		promise.then(
			(result) => {
				clearTimeout(timer)
				resolve(result)
			},
			(error) => {
				clearTimeout(timer)
				reject(error)
			}
		)
	})
}

async function testUrlAccessibility(url: string): Promise<{ reachable: boolean; status?: number; error?: string }> {
	try {
		const response = await timeoutPromise(fetch(url, {
			method: 'HEAD',
			mode: 'no-cors',
			cache: 'no-cache',
		}), 5000)
		return { reachable: true, status: response.status }
	} catch (error: any) {
		return { reachable: false, error: error.message }
	}
}

function getAlternativeUrls(baseUrl: string): string[] {
	const alternatives: string[] = []
	
	if (baseUrl.startsWith('https://')) {
		alternatives.push(baseUrl.replace('https://', 'http://'))
	} else if (baseUrl.startsWith('http://')) {
		alternatives.push(baseUrl.replace('http://', 'https://'))
	}
	
	const urlObj = new URL(baseUrl)
	alternatives.push(`https://${urlObj.hostname}${urlObj.pathname}`)
	alternatives.push(`https://cdn.${urlObj.hostname}${urlObj.pathname}`)
	
	return alternatives.filter(u => u !== baseUrl)
}

async function loadLyricWithRetry(lrcUrl: string, retryCount: number = 0, triedUrls: string[] = []): Promise<{ success: boolean; data: string; error?: string }> {
	const encodedUrl = encodeURI(lrcUrl)
	const allTriedUrls = [...triedUrls, encodedUrl]
	
	console.debug(`[Lyric] Loading attempt ${retryCount + 1}/${MAX_RETRY}: ${encodedUrl}`)
	console.debug(`[Lyric] Network status: ${checkNetworkStatus() ? 'online' : 'offline'}`)
	
	if (!checkNetworkStatus()) {
		console.error('[Lyric] Network is offline')
		return { success: false, data: '', error: '网络已断开连接，请检查网络设置' }
	}
	
	console.debug('[Lyric] Performing URL accessibility test...')
	const accessibility = await testUrlAccessibility(encodedUrl)
	console.debug('[Lyric] URL accessibility test:', accessibility)
	
	try {
		console.debug('[Lyric] Sending CORS request...')
		const response = await timeoutPromise(fetch(encodedUrl, {
			method: 'GET',
			headers: {
				'Accept': 'text/plain, text/*',
				'Origin': window.location.origin,
			},
			mode: 'cors',
			cache: 'no-cache',
			credentials: 'omit',
		}), REQUEST_TIMEOUT)
		
		console.debug('[Lyric] Response status:', response.status, response.statusText)
		console.debug('[Lyric] Response headers:', Object.fromEntries(response.headers.entries()))
		
		if (!response.ok) {
			const errorMsg = `HTTP错误: ${response.status} ${response.statusText}`
			console.error('[Lyric]', errorMsg)
			
			if (response.status === 0) {
				console.error('[Lyric] CORS error detected - response status is 0')
				return { success: false, data: '', error: '跨域请求被阻止。请检查Cloudflare R2的CORS配置，确保已添加正确的Access-Control-Allow-Origin响应头' }
			}
			if (response.status === 404) {
				return { success: false, data: '', error: `歌词文件不存在 (${encodedUrl})` }
			}
			if (response.status === 403) {
				return { success: false, data: '', error: '访问被拒绝，请检查R2存储桶的权限配置' }
			}
			if (response.status === 401) {
				return { success: false, data: '', error: '未授权访问，请检查R2的访问密钥配置' }
			}
			if (response.status === 500 || response.status === 503 || response.status === 502) {
				if (retryCount < MAX_RETRY - 1) {
					const delay = RETRY_DELAY * Math.pow(2, retryCount)
					console.debug(`[Lyric] Server error, retrying in ${delay}ms...`)
					await new Promise(resolve => setTimeout(resolve, delay))
					return loadLyricWithRetry(lrcUrl, retryCount + 1, allTriedUrls)
				}
				return { success: false, data: '', error: `服务器错误 (${response.status})，已重试${MAX_RETRY}次仍失败` }
			}
			return { success: false, data: '', error: errorMsg }
		}
		
		const text = await response.text()
		console.debug('[Lyric] Successfully loaded, length:', text.length, 'chars')
		
		if (!text.trim()) {
			console.warn('[Lyric] Empty lyric content')
			return { success: false, data: '', error: '歌词内容为空' }
		}
		
		return { success: true, data: text, error: undefined }
		
	} catch (error: any) {
		console.error('[Lyric] Request error:', error.message || error)
		console.error('[Lyric] Error stack:', error.stack)
		
		if (error.message?.includes('timeout')) {
			if (retryCount < MAX_RETRY - 1) {
				const delay = RETRY_DELAY * Math.pow(2, retryCount)
				console.debug(`[Lyric] Timeout (${REQUEST_TIMEOUT}ms), retrying in ${delay}ms...`)
				await new Promise(resolve => setTimeout(resolve, delay))
				return loadLyricWithRetry(lrcUrl, retryCount + 1, allTriedUrls)
			}
			return { success: false, data: '', error: `请求超时 (${REQUEST_TIMEOUT}ms)，已重试${MAX_RETRY}次` }
		}
		
		if (error.message?.includes('CORS') || error.message?.includes('cross-origin')) {
			console.debug('[Lyric] CORS error detected, trying alternative URLs...')
			const alternatives = getAlternativeUrls(lrcUrl).filter(u => !allTriedUrls.includes(u))
			
			if (alternatives.length > 0) {
				console.debug('[Lyric] Trying alternative URL:', alternatives[0])
				return loadLyricWithRetry(alternatives[0], retryCount + 1, allTriedUrls)
			}
			return { success: false, data: '', error: '跨域请求被阻止。解决方案：1. 在Cloudflare R2中配置CORS规则 2. 使用后端代理 3. 将歌词文件放在项目public目录' }
		}
		
		if (error.message?.includes('network') || error.message?.includes('fetch')) {
			console.debug('[Lyric] Network error detected:', error.message)
			
			if (!checkNetworkStatus()) {
				return { success: false, data: '', error: '网络已断开，请检查网络连接' }
			}
			
			if (retryCount < MAX_RETRY - 1) {
				const delay = RETRY_DELAY * Math.pow(2, retryCount)
				console.debug(`[Lyric] Network error, retrying in ${delay}ms...`)
				await new Promise(resolve => setTimeout(resolve, delay))
				return loadLyricWithRetry(lrcUrl, retryCount + 1, allTriedUrls)
			}
			
			console.debug('[Lyric] All retries exhausted, trying alternative URLs...')
			const alternatives = getAlternativeUrls(lrcUrl).filter(u => !allTriedUrls.includes(u))
			
			if (alternatives.length > 0) {
				console.debug('[Lyric] Trying alternative URL:', alternatives[0])
				return loadLyricWithRetry(alternatives[0], 0, allTriedUrls)
			}
			
			return { success: false, data: '', error: `网络连接失败，已重试${MAX_RETRY}次。请检查：1. 网络连接是否正常 2. 防火墙是否阻止请求 3. 代理设置是否正确 4. 目标服务器是否可访问` }
		}
		
		console.error('[Lyric] Unexpected error:', error)
		return { success: false, data: '', error: `未知错误: ${error.message || error}` }
	}
}

async function loadLyric(lrcUrl: string): Promise<string> {
	console.debug('[Lyric] Starting lyric load from:', lrcUrl)
	
	const result = await loadLyricWithRetry(lrcUrl)
	
	if (result.success) {
		console.debug('[Lyric] Load successful')
		return result.data
	} else {
		console.error('[Lyric] Load failed:', result.error)
		throw new Error(result.error || '歌词加载失败')
	}
}

async function switchLyric(index: number) {
	const currentAudio = ap?.list?.audios[index]
	console.debug('[Lyric] Switching to song:', currentAudio?.name, 'index:', index)
	
	if (currentAudio?.lrc) {
		console.debug('[Lyric] LRC source:', currentAudio.lrc.substring(0, 50) + (currentAudio.lrc.length > 50 ? '...' : ''))
		
		if (currentAudio.lrc.startsWith('http://') || currentAudio.lrc.startsWith('https://') || currentAudio.lrc.startsWith('/')) {
					console.debug('[Lyric] Loading LRC from URL:', currentAudio.lrc)
					
					try {
						const fullUrl = currentAudio.lrc.startsWith('/') 
							? window.location.origin + currentAudio.lrc 
							: currentAudio.lrc
						
						console.debug('[Lyric] Full URL:', fullUrl)
						const result = await loadLyricWithRetry(fullUrl)
						
						if (!result.success) {
							console.error('[Lyric] URL lyric loading failed:', result.error)
							lyricLines = [{ time: 0, text: result.error || '歌词加载失败' }]
						} else {
							console.debug('[Lyric] Raw lyric content (first 100 chars):', result.data.substring(0, 100))
							lyricLines = parseLyric(result.data)
							console.debug('[Lyric] Parsed lines:', lyricLines.length)
							
							if (lyricLines.length === 0) {
								console.warn('[Lyric] Parsed result is empty, check LRC format')
								lyricLines = [{ time: 0, text: '歌词格式不正确' }]
							}
						}
					} catch (error: any) {
						console.error('[Lyric] Unexpected error:', error)
						lyricLines = [{ time: 0, text: '歌词加载异常: ' + (error.message || '未知错误') }]
					}
				} else {
					console.debug('[Lyric] Parsing inline LRC...')
					console.debug('[Lyric] Inline LRC content (first 100 chars):', currentAudio.lrc.substring(0, 100))
					lyricLines = parseLyric(currentAudio.lrc)
					console.debug('[Lyric] Parsed lines:', lyricLines.length)
					
					if (lyricLines.length === 0) {
						console.warn('[Lyric] Inline LRC parse result is empty')
						lyricLines = [{ time: 0, text: '歌词格式不正确' }]
					}
				}
	} else {
		console.debug('[Lyric] No LRC provided for this song')
		lyricLines = [{ time: 0, text: '暂无歌词' }]
	}
	
	currentLyricIndex = 0
	renderLyric()
}

let pendingRetryTimer: ReturnType<typeof setTimeout> | null = null

function handleNetworkReconnect() {
	console.debug('[Lyric] Network reconnected, attempting to reload lyric')
	
	if (pendingRetryTimer) {
		clearTimeout(pendingRetryTimer)
	}
	
	pendingRetryTimer = setTimeout(() => {
		if (ap?.list?.currentIndex !== undefined) {
			switchLyric(ap.list.currentIndex)
		}
	}, 1000)
}

function toggleLyricDisplay() {
	showLyric.value = !showLyric.value
}

function toggleMinimize() {
	isMinimized.value = !isMinimized.value
}

onMounted(async () => {
	const hasAudio = props.audio?.length
	const hasMeting = props.meting
	if (!hasAudio && !hasMeting)
		return

	loadStyle('/aplayer/APlayer.min.css')
	await loadScript('/aplayer/APlayer.min.js')

	let audioList: MusicItem[] = props.audio || []

	if (hasMeting) {
		try {
			const metingSongs = await fetchMetingSongs(hasMeting)
			audioList = [...audioList, ...metingSongs]
		}
		catch (e) {
			console.warn('MetingJS 加载失败，仅使用本地歌曲:', e)
		}
	}

	if (!audioList.length)
		return

	ap = new (window as any).APlayer({
		container: playerContainer.value,
		mini: false,
		autoplay: false,
		theme: '#b7daff',
		loop: 'all',
		order: 'list',
		preload: 'metadata',
		volume: 0.7,
		mutex: true,
		listFolded: true,
		listMaxHeight: '200px',
		audio: audioList,
	})

	console.debug('[Lyric] Initializing lyric for first song:', audioList[0]?.name)
	
	if (audioList[0]?.lrc) {
		console.debug('[Lyric] LRC source type:', audioList[0].lrc.startsWith('http') ? 'remote URL' : 'inline text')
		
		if (audioList[0].lrc.startsWith('http://') || audioList[0].lrc.startsWith('https://') || audioList[0].lrc.startsWith('/')) {
			console.debug('[Lyric] Loading LRC from URL:', audioList[0].lrc)
			
			try {
				const fullUrl = audioList[0].lrc.startsWith('/') 
					? window.location.origin + audioList[0].lrc 
					: audioList[0].lrc
				
				console.debug('[Lyric] Full URL:', fullUrl)
				const result = await loadLyricWithRetry(fullUrl)
				
				if (!result.success) {
					console.error('[Lyric] Initial lyric loading failed:', result.error)
					lyricLines = [{ time: 0, text: result.error || '歌词加载失败' }]
				} else {
					console.debug('[Lyric] Raw lyric content (first 100 chars):', result.data.substring(0, 100))
					lyricLines = parseLyric(result.data)
					console.debug('[Lyric] Initial parse result:', lyricLines.length, 'lines')
					
					if (lyricLines.length === 0) {
						console.warn('[Lyric] Initial parse returned empty result')
						lyricLines = [{ time: 0, text: '歌词格式不正确' }]
					}
				}
			} catch (error: any) {
				console.error('[Lyric] Unexpected error during initialization:', error)
				lyricLines = [{ time: 0, text: '歌词加载异常: ' + (error.message || '未知错误') }]
			}
		} else {
			console.debug('[Lyric] Parsing inline LRC')
			console.debug('[Lyric] Inline LRC content (first 100 chars):', audioList[0].lrc.substring(0, 100))
			lyricLines = parseLyric(audioList[0].lrc)
			
			if (lyricLines.length === 0) {
				console.warn('[Lyric] Inline LRC parse result is empty')
				lyricLines = [{ time: 0, text: '歌词格式不正确' }]
			}
		}
	} else {
		console.debug('[Lyric] No LRC provided for first song')
		lyricLines = [{ time: 0, text: '暂无歌词' }]
	}
	renderLyric()
	
	if (typeof window !== 'undefined') {
		window.addEventListener('online', handleNetworkReconnect)
		window.addEventListener('offline', () => {
			console.debug('[Lyric] Network disconnected')
		})
	}

	ap.on('timeupdate', () => {
		if (ap?.audio?.currentTime !== undefined) {
			updateLyric(ap.audio.currentTime)
		}
	})

	ap.on('play', () => {
		if (ap?.audio?.currentTime !== undefined) {
			updateLyric(ap.audio.currentTime)
		}
	})

	ap.on('pause', () => {
		if (ap?.audio?.currentTime !== undefined) {
			updateLyric(ap.audio.currentTime)
		}
	})

	ap.on('seeking', () => {
		if (ap?.audio?.currentTime !== undefined) {
			updateLyric(ap.audio.currentTime)
		}
	})

	ap.on('songchange', (index: number) => {
		switchLyric(index)
	})
})

onBeforeUnmount(() => {
	ap?.destroy()
	
	if (typeof window !== 'undefined') {
		window.removeEventListener('online', handleNetworkReconnect)
		window.removeEventListener('offline', () => {
			console.debug('[Lyric] Network disconnected')
		})
	}
	
	if (pendingRetryTimer) {
		clearTimeout(pendingRetryTimer)
	}
})
</script>

<template>
<ClientOnly>
	<div class="player-wrapper" :class="{ minimized: isMinimized }">
		<div class="aplayer-float">
			<div class="aplayer-toggle" @click="toggleMinimize">
				<Icon :name="isMinimized ? 'tabler:music' : 'tabler:chevron-down'" />
			</div>
			
			<div v-show="!isMinimized" class="player-content">
				<div v-show="showLyric" class="lyric-panel">
					<div class="lyric-header">
						<span class="lyric-title">歌词</span>
						<button class="lyric-toggle" title="关闭歌词" @click="toggleLyricDisplay">
							<Icon name="tabler:x" />
						</button>
					</div>
					<div ref="lyricContainer" class="lyric-content" />
				</div>
				
				<div ref="playerContainer" class="aplayer-container" />
			</div>
			
			<button 
				v-show="!showLyric && !isMinimized" 
				class="lyric-expand-btn" 
				@click="toggleLyricDisplay"
			>
				<Icon name="tabler:lyrics" />
				<span>显示歌词</span>
			</button>
		</div>
	</div>
</ClientOnly>
</template>

<style lang="scss" scoped>
.player-wrapper {
	display: flex;
	flex-direction: column;
	gap: 0;
	position: fixed;
	inset-inline-end: 1rem;
	bottom: 1rem;
	z-index: var(--z-index-popover, 1000);
	max-width: 700px;
	transition: all 0.3s ease;

	@media (max-width: 768px) {
		inset-inline-end: 0.5rem;
		bottom: 0.5rem;
		max-width: calc(100vw - 1rem);
		flex-direction: column;
		gap: 0.5rem;
	}

	&.minimized {
		.lyric-panel,
		.lyric-expand-btn {
			display: none !important;
		}
	}
}

.aplayer-float {
	display: flex;
	flex-direction: column;
	max-width: 380px;
	width: 100%;

	@media (max-width: 768px) {
		max-width: 100%;
	}
}

.aplayer-toggle {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 2.5rem;
	height: 2.5rem;
	margin-inline-start: auto;
	border-radius: 50%;
	background-color: var(--c-bg-1);
	box-shadow: var(--box-shadow-2);
	cursor: pointer;
	transition: all 0.2s;
	color: var(--c-text-2);
	font-size: 1.2em;

	&:hover {
		background-color: var(--c-bg-soft);
		color: var(--c-text);
		transform: scale(1.1);
	}
}

.minimized {
	.aplayer-toggle {
		background-color: var(--c-primary);
		color: #fff;

		&:hover {
			opacity: 0.9;
		}
	}
}

.aplayer-container {
	width: 400px;

	@media (max-width: 768px) {
		width: calc(100vw - 2rem);
	}

	@media (max-width: 1024px) {
		width: 350px;
	}

	:deep(.aplayer) {
		box-shadow: var(--box-shadow-2);
		border-radius: 0 0 1rem 1rem;
		border: 1px solid var(--c-border);
		border-top: none;
		overflow: hidden;
	}

	:deep(.aplayer-list) {
		background-color: var(--c-bg-1) !important;

		ol {
			li {
				color: var(--c-text) !important;
				border-top-color: var(--c-border) !important;
				font-size: 13px;
				line-height: 1.5;

				&:hover {
					background-color: var(--c-bg-soft) !important;
				}

				&.aplayer-list-light {
					background-color: var(--c-primary-muted, rgba(59, 130, 246, 0.1)) !important;
					color: var(--c-primary) !important;
					font-weight: 600;
					border-inline-start: 3px solid var(--c-primary);
				}

				.aplayer-list-index {
					color: var(--c-text-3) !important;
				}

				.aplayer-list-author {
					color: var(--c-text-3) !important;
					font-size: 12px;
				}
			}
		}
	}

	:deep(.aplayer-body) {
		background-color: var(--c-bg-1) !important;

		.aplayer-info {
			.aplayer-music {
				.aplayer-title {
					color: var(--c-text) !important;
					font-weight: 600;
				}

				.aplayer-author {
					color: var(--c-text-3) !important;
				}
			}

			.aplayer-controller {
				.aplayer-time {
					color: var(--c-text-3) !important;
				}

				.aplayer-icon {
					fill: var(--c-text-2) !important;

					&:hover {
						fill: var(--c-text) !important;
					}
				}
			}
		}
	}

	:deep(.aplayer-bar) {
		background-color: var(--c-border) !important;

		.aplayer-loaded {
			background-color: var(--c-text-3) !important;
		}

		.aplayer-played {
			background-color: var(--c-primary) !important;

			.aplayer-thumb {
				background-color: var(--c-primary) !important;
			}
		}
	}

	:deep(.aplayer-volume-bar) {
		background-color: var(--c-border) !important;

		.aplayer-volume {
			background-color: var(--c-primary) !important;
		}
	}
}

.lyric-panel {
	background: transparent;
	border-radius: 1rem 1rem 0 0;
	padding: 1rem;
	width: 400px;
	max-height: 240px;
	display: flex;
	flex-direction: column;
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

	@media (max-width: 768px) {
		width: calc(100vw - 2rem);
		max-height: 200px;
		padding: 0.75rem;
	}

	@media (max-width: 1024px) {
		width: 350px;
		max-height: 220px;
	}
}

.lyric-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 1rem;
	padding-bottom: 0.75rem;

	.lyric-title {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--c-text);
		letter-spacing: 0.05em;
		text-shadow: 
			1px 1px 2px rgba(0, 0, 0, 0.3),
			-1px -1px 2px rgba(0, 0, 0, 0.3);
	}

	.lyric-toggle {
		background: rgba(255, 255, 255, 0.1);
		backdrop-filter: blur(4px);
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: var(--c-text);
		cursor: pointer;
		padding: 0.375rem;
		border-radius: 0.375rem;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

		&:hover {
			background-color: rgba(255, 255, 255, 0.2);
			color: var(--c-primary);
			transform: rotate(180deg);
		}

		svg {
			width: 18px;
			height: 18px;
		}
	}
}

.lyric-content {
	flex: 1;
	overflow-y: auto;
	overflow-x: hidden;
	text-align: center;
	padding: 0.5rem 0;
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	max-height: 180px;

	@media (max-width: 768px) {
		max-height: 140px;
	}

	&::-webkit-scrollbar {
		width: 4px;
	}

	&::-webkit-scrollbar-track {
		background: transparent;
	}

	&::-webkit-scrollbar-thumb {
		border-radius: 2px;
		background-color: var(--c-text-3);
	}

	p {
		margin: 0;
		padding: 0.5rem 0.75rem;
		font-size: 0.95rem;
		line-height: 1.6;
		transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
		border-radius: 0.5rem;
		min-height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.lyric-current {
		color: var(--c-primary);
		font-weight: 700;
		font-size: 1.15rem;
		text-shadow: 
			0 0 10px var(--c-primary),
			0 0 20px var(--c-primary),
			0 0 30px var(--c-primary),
			0 0 40px var(--c-primary),
			1px 1px 0 rgba(255, 255, 255, 0.8),
			-1px -1px 0 rgba(255, 255, 255, 0.8),
			1px -1px 0 rgba(255, 255, 255, 0.8),
			-1px 1px 0 rgba(255, 255, 255, 0.8);
		-webkit-text-stroke: 0.5px rgba(255, 255, 255, 0.5);
		animation: lyricPulse 2s ease-in-out infinite;
		transform: scale(1.02);

		&::before {
			content: '♪ ';
			color: var(--c-primary);
			font-size: 0.9rem;
			margin-right: 0.25rem;
		}
	}
}

@keyframes lyricPulse {
	0%, 100% {
		opacity: 1;
		text-shadow: 0 0 20px var(--c-primary), 0 0 40px var(--c-primary);
	}
	50% {
		opacity: 0.9;
		text-shadow: 0 0 30px var(--c-primary), 0 0 60px var(--c-primary);
	}
}

@keyframes lyricGlow {
	0%, 100% {
		box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
	}
	50% {
		box-shadow: 0 0 40px rgba(59, 130, 246, 0.5);
	}
}

@keyframes noteBounce {
	0%, 100% {
		transform: translateY(0);
	}
	50% {
		transform: translateY(-4px);
	}
}

@keyframes lyricFadeIn {
	0% {
		opacity: 0;
		transform: translateY(10px) scale(0.95);
	}
	100% {
		opacity: 1;
		transform: translateY(0) scale(1);
	}
}

@keyframes lyricFadeOut {
	0% {
		opacity: 1;
		transform: translateY(0) scale(1);
	}
	100% {
		opacity: 0;
		transform: translateY(-10px) scale(0.95);
	}
}

.lyric-expand-btn {
	display: flex;
	align-items: center;
	gap: 0.375rem;
	padding: 0.625rem 1rem;
	background: linear-gradient(135deg, var(--c-bg-1) 0%, var(--c-bg-soft) 100%);
	box-shadow: var(--box-shadow-2);
	border: 1px solid var(--c-border);
	border-radius: 0.75rem;
	color: var(--c-text);
	cursor: pointer;
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	white-space: nowrap;
	backdrop-filter: blur(10px);

	&:hover {
		background-color: var(--c-bg);
		box-shadow: var(--box-shadow-3);
		transform: translateX(-4px);
	}

	@media (max-width: 768px) {
		align-self: flex-start;
		padding: 0.5rem 0.75rem;
	}

	svg {
		width: 16px;
		height: 16px;
	}

	span {
		font-size: 0.875rem;
		font-weight: 500;
	}
}
</style>
