<script setup lang="ts">
const appConfig = useAppConfig()
const enabled = computed(() => appConfig.heartCursor?.enabled !== false)

interface Heart {
	id: number
	x: number
	y: number
	size: number
	color: string
	rotation: number
}

const hearts = ref<Heart[]>([])
let heartId = 0
let lastTime = 0
const throttleMs = 50

const colors = [
	'rgba(255, 107, 129, 0.85)',
	'rgba(255, 138, 128, 0.85)',
	'rgba(255, 167, 196, 0.85)',
	'rgba(244, 143, 177, 0.85)',
	'rgba(233, 30, 99, 0.75)',
	'rgba(255, 82, 82, 0.8)',
	'rgba(255, 128, 171, 0.85)',
]

function randomColor() {
	return colors[Math.floor(Math.random() * colors.length)]
}

function spawnHeart(x: number, y: number) {
	hearts.value.push({
		id: heartId++,
		x: x + (Math.random() - 0.5) * 20,
		y: y + (Math.random() - 0.5) * 20,
		size: 10 + Math.random() * 14,
		color: randomColor(),
		rotation: (Math.random() - 0.5) * 40,
	})
	if (hearts.value.length > 20) {
		hearts.value.splice(0, hearts.value.length - 20)
	}
}

function onMouseMove(e: MouseEvent) {
	if (!enabled.value)
		return
	const now = Date.now()
	if (now - lastTime < throttleMs)
		return
	lastTime = now
	spawnHeart(e.clientX, e.clientY)
}

function onTouchMove(e: TouchEvent) {
	if (!enabled.value)
		return
	const touch = e.touches[0]
	if (!touch)
		return
	const now = Date.now()
	if (now - lastTime < throttleMs)
		return
	lastTime = now
	spawnHeart(touch.clientX, touch.clientY)
}

function onAfterLeave(el: Element) {
	const idx = hearts.value.findIndex(h => h.id === Number((el as HTMLElement).dataset.id))
	if (idx !== -1)
		hearts.value.splice(idx, 1)
}

onMounted(() => {
	document.addEventListener('mousemove', onMouseMove, { passive: true })
	document.addEventListener('touchmove', onTouchMove, { passive: true })
})

onBeforeUnmount(() => {
	document.removeEventListener('mousemove', onMouseMove)
	document.removeEventListener('touchmove', onTouchMove)
})
</script>

<template>
<ClientOnly>
	<div v-if="enabled" class="heart-cursor" aria-hidden="true">
		<TransitionGroup name="heart" @after-leave="onAfterLeave">
			<span
				v-for="heart in hearts"
				:key="heart.id"
				:data-id="heart.id"
				class="heart-item"
				:style="{
					left: `${heart.x}px`,
					top: `${heart.y}px`,
					fontSize: `${heart.size}px`,
					color: heart.color,
					transform: `rotate(${heart.rotation}deg)`,
				}"
			>♥</span>
		</TransitionGroup>
	</div>
</ClientOnly>
</template>

<style lang="scss" scoped>
.heart-cursor {
	position: fixed;
	inset: 0;
	pointer-events: none;
	z-index: 9999;
	overflow: hidden;
}

.heart-item {
	position: absolute;
	line-height: 1;
	will-change: transform, opacity;
	animation: heart-float 1.2s ease-out forwards;
	filter: drop-shadow(0 0 2px rgba(255, 107, 129, 0.4));
}

.heart-enter-active {
	animation: heart-float 1.2s ease-out forwards;
}

.heart-leave-active {
	display: none;
}

@keyframes heart-float {
	0% {
		opacity: 1;
		transform: scale(0.3) translateY(0);
	}
	30% {
		opacity: 1;
		transform: scale(1.1) translateY(-10px);
	}
	100% {
		opacity: 0;
		transform: scale(0.6) translateY(-60px);
	}
}
</style>
