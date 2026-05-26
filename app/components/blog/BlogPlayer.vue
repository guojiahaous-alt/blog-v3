<script setup lang="ts">
interface MusicItem {
	name: string
	artist: string
	url: string
	cover?: string
	lrc?: string
	theme?: string
}

const props = defineProps<{
	audio?: MusicItem[]
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

onMounted(async () => {
	if (!props.audio?.length)
		return

	loadStyle('/aplayer/APlayer.min.css')
	await loadScript('/aplayer/APlayer.min.js')

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
		audio: props.audio,
	})
})

onBeforeUnmount(() => {
	ap?.destroy()
})

function toggleMinimize() {
	isMinimized.value = !isMinimized.value
	if (isMinimized.value) {
		ap?.pause()
	}
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
}
</style>
