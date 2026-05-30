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

	let newIndex = 0
	for (let i = 0; i < lyricLines.length; i++) {
		if (currentTime >= lyricLines[i].time) {
			newIndex = i
		} else {
			break
		}
	}

	if (newIndex !== currentLyricIndex) {
		currentLyricIndex = newIndex
		renderLyric()
	}
}

function renderLyric() {
	if (!lyricContainer.value)
		return

	const container = lyricContainer.value
	container.innerHTML = ''

	lyricLines.forEach((line, index) => {
		const p = document.createElement('p')
		p.textContent = line.text

		if (index === currentLyricIndex) {
			p.classList.add('lyric-current')
		} else if (Math.abs(index - currentLyricIndex) <= 2) {
			p.classList.add('lyric-near')
		} else {
			p.classList.add('lyric-far')
		}

		container.appendChild(p)
	})

	const currentElement = container.querySelector('.lyric-current')
	if (currentElement) {
		currentElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
	}
}

function switchLyric(index: number) {
	const currentAudio = ap?.list?.audios[index]
	if (currentAudio?.lrc) {
		lyricLines = parseLyric(currentAudio.lrc)
	} else {
		lyricLines = [{ time: 0, text: '暂无歌词' }]
	}
	currentLyricIndex = 0
	renderLyric()
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

	if (audioList[0]?.lrc) {
		lyricLines = parseLyric(audioList[0].lrc)
		renderLyric()
	} else {
		lyricLines = [{ time: 0, text: '暂无歌词' }]
		renderLyric()
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
})
</script>

<template>
<ClientOnly>
	<div class="player-wrapper" :class="{ minimized: isMinimized }">
		<div class="aplayer-float">
			<div class="aplayer-toggle" @click="toggleMinimize">
				<Icon :name="isMinimized ? 'tabler:music' : 'tabler:chevron-down'" />
			</div>
			<div v-show="!isMinimized" ref="playerContainer" class="aplayer-container" />
		</div>
		
		<div v-show="showLyric && !isMinimized" class="lyric-panel">
			<div class="lyric-header">
				<span class="lyric-title">歌词</span>
				<button class="lyric-toggle" title="关闭歌词" @click="toggleLyricDisplay">
					<Icon name="tabler:chevron-right" />
				</button>
			</div>
			<div ref="lyricContainer" class="lyric-content" />
		</div>
		
		<button 
			v-show="!showLyric && !isMinimized" 
			class="lyric-expand-btn" 
			@click="toggleLyricDisplay"
		>
			<Icon name="tabler:chevron-left" />
			<span>歌词</span>
		</button>
	</div>
</ClientOnly>
</template>

<style lang="scss" scoped>
.player-wrapper {
	display: flex;
	flex-direction: row;
	gap: 1rem;
	position: fixed;
	inset-inline-end: 1rem;
	bottom: 1rem;
	z-index: var(--z-index-popover, 1000);
	max-width: 700px;
	transition: all 0.3s ease;

	@media (max-width: $breakpoint-mobile) {
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

	@media (max-width: $breakpoint-mobile) {
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
	:deep(.aplayer) {
		box-shadow: var(--box-shadow-2);
		border-radius: 0.5rem;
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
	background-color: var(--c-bg-1);
	box-shadow: var(--box-shadow-2);
	border-radius: 0.5rem;
	padding: 1rem;
	max-width: 280px;
	width: 100%;
	max-height: 350px;
	display: flex;
	flex-direction: column;
	transition: all 0.3s ease;

	@media (max-width: $breakpoint-mobile) {
		max-width: 100%;
		max-height: 200px;
	}
}

.lyric-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 0.75rem;
	padding-bottom: 0.5rem;
	border-bottom: 1px solid var(--c-border);

	.lyric-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--c-text);
	}

	.lyric-toggle {
		background: none;
		border: none;
		color: var(--c-text-2);
		cursor: pointer;
		padding: 0.25rem;
		border-radius: 0.25rem;
		transition: all 0.2s;

		&:hover {
			background-color: var(--c-bg-soft);
			color: var(--c-text);
		}
	}
}

.lyric-content {
	flex: 1;
	overflow-y: auto;
	overflow-x: hidden;
	text-align: center;
	padding: 0.5rem 0;

	&::-webkit-scrollbar {
		width: 4px;
	}

	&::-webkit-scrollbar-thumb {
		border-radius: 2px;
		background-color: var(--c-text-3);
	}

	p {
		margin: 0;
		padding: 0.5rem 0;
		font-size: 0.875rem;
		line-height: 1.6;
		transition: all 0.3s ease;
	}

	.lyric-current {
		color: var(--c-primary);
		font-weight: 600;
		font-size: 1rem;
		transform: scale(1.05);
	}

	.lyric-near {
		color: var(--c-text-2);
		opacity: 0.8;
	}

	.lyric-far {
		color: var(--c-text-3);
		opacity: 0.4;
	}
}

.lyric-expand-btn {
	display: flex;
	align-items: center;
	gap: 0.25rem;
	padding: 0.5rem 0.75rem;
	background-color: var(--c-bg-1);
	box-shadow: var(--box-shadow-2);
	border: none;
	border-radius: 0.5rem;
	color: var(--c-text);
	cursor: pointer;
	transition: all 0.2s;
	white-space: nowrap;

	&:hover {
		background-color: var(--c-bg-soft);
	}

	@media (max-width: $breakpoint-mobile) {
		align-self: flex-start;
	}
}
</style>
