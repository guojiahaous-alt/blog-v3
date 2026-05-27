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
const isMinimized = ref(false)
let ap: any = null

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

	// eslint-disable-next-line no-undef
	ap = new APlayer({
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
})

onBeforeUnmount(() => {
	ap?.destroy()
})

function toggleMinimize() {
	isMinimized.value = !isMinimized.value
	// 收缩时不暂停播放，音乐继续在后台播放
}
</script>

<template>
<ClientOnly>
	<div class="aplayer-float" :class="{ minimized: isMinimized }">
		<div class="aplayer-toggle" @click="toggleMinimize">
			<Icon :name="isMinimized ? 'tabler:music' : 'tabler:chevron-down'" />
		</div>
		<div v-show="!isMinimized" ref="playerContainer" class="aplayer-container" />
	</div>
</ClientOnly>
</template>

<style lang="scss" scoped>
.aplayer-float {
	position: fixed;
	inset-inline-end: 1rem;
	bottom: 1rem;
	z-index: var(--z-index-popover, 1000);
	max-width: 380px;

	@media (max-width: $breakpoint-mobile) {
		inset-inline-end: 0.5rem;
		bottom: 0.5rem;
		max-width: calc(100vw - 1rem);
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

	// 播放列表对比度与可读性优化
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

	// 播放器主体文字对比度
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

	// 进度条颜色适配
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

	// 音量条适配
	:deep(.aplayer-volume-bar) {
		background-color: var(--c-border) !important;

		.aplayer-volume {
			background-color: var(--c-primary) !important;
		}
	}
}
</style>
