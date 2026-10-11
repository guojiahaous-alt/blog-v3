<script setup lang="ts">
const commentEl = useTemplateRef('comment')
const colorMode = useColorMode()

onMounted(() => {
	const script = document.createElement('script')
	script.src = 'https://giscus.app/client.js'
	script.setAttribute('data-repo', 'guojiahaous-alt/blog-v3')
	script.setAttribute('data-repo-id', 'R_kgDOSlEWmA')
	script.setAttribute('data-category', 'General')
	script.setAttribute('data-category-id', 'DIC_kwDOSlEWmM4DHgYM')
	script.setAttribute('data-mapping', 'pathname')
	script.setAttribute('data-reactions-enabled', '1')
	script.setAttribute('data-input-position', 'top')
	script.setAttribute('data-theme', colorMode.value === 'dark' ? 'dark' : 'light')
	script.setAttribute('data-lang', 'zh-CN')
	script.crossOrigin = 'anonymous'
	script.async = true
	commentEl.value?.appendChild(script)
})

// 监听博客主题切换，同步 Giscus 主题
watch(() => colorMode.value, (theme) => {
	const iframe = document.querySelector<HTMLIFrameElement>('iframe.giscus-frame')
	iframe?.contentWindow?.postMessage({
		giscus: { setConfig: { theme: theme === 'dark' ? 'dark' : 'light' } },
	}, 'https://giscus.app')
})
</script>

<template>
<section id="comments" ref="comment" class="z-comment">
	<h3 class="z-comment__title">
		<Icon name="tabler:message-circle" />
		评论
	</h3>
	<div class="giscus" />
</section>
</template>

<style lang="scss" scoped>
.z-comment {
	margin: 4rem 0 2rem;

	&__title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
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
}

.giscus {
	min-height: 10rem;
}
</style>
