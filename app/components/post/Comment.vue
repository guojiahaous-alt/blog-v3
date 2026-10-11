<script setup lang="ts">
const commentEl = useTemplateRef('comment')
const loaded = ref(false)
const colorMode = useColorMode()

const giscusTheme = computed(() => (colorMode.value === 'dark' ? 'dark_dimmed' : 'light'))

onMounted(() => {
	const script = document.createElement('script')
	script.src = 'https://giscus.app/client.js'
	script.setAttribute('data-repo', 'guojiahaous-alt/blog-v3')
	script.setAttribute('data-repo-id', 'R_kgDOSlEWmA')
	script.setAttribute('data-category', 'General')
	script.setAttribute('data-category-id', 'DIC_kwDOSlEWmM4DHgYM')
	script.setAttribute('data-mapping', 'pathname')
	script.setAttribute('data-strict', '0')
	script.setAttribute('data-reactions-enabled', '1')
	script.setAttribute('data-emit-metadata', '0')
	script.setAttribute('data-input-position', 'top')
	script.setAttribute('data-theme', giscusTheme.value)
	script.setAttribute('data-lang', 'zh-CN')
	script.setAttribute('data-loading', 'lazy')
	script.crossOrigin = 'anonymous'
	script.async = true

	script.onload = () => { loaded.value = true }
	commentEl.value?.appendChild(script)
})

// 监听博客主题切换，同步通知 giscus iframe 更换主题
watch(() => colorMode.value, (theme) => {
	const iframe = document.querySelector<HTMLIFrameElement>('iframe.giscus-frame')
	iframe?.contentWindow?.postMessage(
		{ giscus: { setConfig: { theme: theme === 'dark' ? 'dark_dimmed' : 'light' } } },
		'https://giscus.app',
	)
})
</script>

<template>
<section id="comments" ref="comment" class="z-comment">
	<h3 class="z-comment__title">
		<Icon name="tabler:message-circle" />
		评论
	</h3>
	<div v-if="!loaded" class="z-comment__loading">
		<Icon name="line-md:loading-twotone-loop" class="spin" />
		<span>评论区加载中…</span>
	</div>
</section>
</template>

<style lang="scss" scoped>
.z-comment {
	margin: 4rem 0 2rem;

	&__title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1.25rem;
		font-size: 1.35rem;
		font-weight: 700;
		color: var(--text-1);

		&::before {
			content: '';
			display: inline-block;
			width: 4px;
			height: 1.1em;
			border-radius: 2px;
			background: var(--text-creative);
		}
	}

	&__loading {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 2.5rem 1rem;
		color: var(--text-3);
		font-size: 0.9rem;

		.spin {
			animation: spin 1s linear infinite;
		}
	}
}

@keyframes spin {
	to { transform: rotate(360deg); }
}

:deep(.giscus) {
	width: 100%;
	max-width: 100%;
	margin: 0;
	border-radius: 12px;
	overflow: hidden;
}
</style>
