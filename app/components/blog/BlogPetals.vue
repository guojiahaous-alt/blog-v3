<script setup lang="ts">
const appConfig = useAppConfig()
const enabled = computed(() => appConfig.petals?.enabled !== false)
const paused = ref(false)

const petals = ref<Array<{
	id: number
	left: number
	size: number
	opacity: number
	duration: number
	delay: number
	rotateStart: number
	swayAmplitude: number
	swayDuration: number
}>>([])

let nextId = 0

function createPetal() {
	return {
		id: nextId++,
		left: Math.random() * 100,
		size: 8 + Math.random() * 12,
		opacity: 0.6 + Math.random() * 0.4,
		duration: 3 + Math.random() * 5,
		delay: Math.random() * 2,
		rotateStart: Math.random() * 360,
		swayAmplitude: 30 + Math.random() * 50,
		swayDuration: 2 + Math.random() * 3,
	}
}

onMounted(() => {
	if (!enabled.value)
		return
	const count = appConfig.petals?.count ?? 15
	petals.value = Array.from({ length: count }, () => createPetal())
})
</script>

<template>
	<ClientOnly>
		<template v-if="enabled">
			<div class="petals-container" :class="{ paused }" aria-hidden="true">
				<div
					v-for="petal in petals"
					:key="petal.id"
					class="petal"
					:style="{
						left: `${petal.left}%`,
						width: `${petal.size}px`,
						height: `${petal.size}px`,
						opacity: petal.opacity,
						animationDuration: `${petal.duration}s, ${petal.swayDuration}s`,
						animationDelay: `${petal.delay}s, ${petal.delay}s`,
						transform: `rotate(${petal.rotateStart}deg)`,
						'--sway': `${petal.swayAmplitude}px`,
					}"
				>
					<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
						<path d="M12 2C12 2 8 6 8 10C8 14 12 22 12 22C12 22 16 14 16 10C16 6 12 2 12 2Z" />
					</svg>
				</div>
			</div>
			<button
				class="petal-toggle"
				:title="paused ? '继续花瓣飘落' : '暂停花瓣飘落'"
				aria-label="切换花瓣飘落"
				@click="paused = !paused"
			>
				<Icon :name="paused ? 'solar:play-bold-duotone' : 'solar:pause-bold-duotone'" />
			</button>
		</template>
	</ClientOnly>
</template>

<style lang="scss" scoped>
.petals-container {
	position: fixed;
	inset: 0;
	pointer-events: none;
	z-index: 9999;
	overflow: hidden;

	&.paused .petal {
		animation-play-state: paused;
	}
}

.petal {
	position: absolute;
	top: -30px;
	color: var(--petal-color, #f8a4c8);
	filter: blur(0.3px);
	animation: petal-fall linear infinite, petal-sway ease-in-out infinite alternate;
	will-change: transform, top;

	svg {
		width: 100%;
		height: 100%;
	}
}

@keyframes petal-fall {
	0% {
		top: -30px;
	}
	100% {
		top: calc(100vh + 30px);
	}
}

@keyframes petal-sway {
	0% {
		margin-left: calc(var(--sway) * -1);
	}
	100% {
		margin-left: var(--sway);
	}
}

.petal-toggle {
	position: fixed;
	bottom: 1rem;
	inset-inline-start: 1rem;
	z-index: var(--z-index-popover, 1000);
	width: 2.75rem;
	height: 2.75rem;
	min-width: 44px;
	min-height: 44px;
	border: 1.5px solid var(--c-border);
	border-radius: 50%;
	background-color: var(--c-bg-1);
	color: var(--petal-color, #f8a4c8);
	box-shadow: var(--box-shadow-2);
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 1.1em;
	transition: all 0.25s ease;

	&:hover {
		background-color: var(--c-bg-soft);
		color: var(--c-text);
		border-color: var(--c-primary);
		transform: scale(1.1);
		box-shadow: var(--box-shadow-3);
	}

	&:active {
		transform: scale(0.92);
	}
}

@media (max-width: $breakpoint-mobile) {
	.petal-toggle {
		inset-inline-start: 0.5rem;
		bottom: 0.5rem;
	}
}
</style>
