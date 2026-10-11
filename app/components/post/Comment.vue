<script setup lang="ts">
const commentEl = useTemplateRef('comment')
const colorMode = useColorMode()

onMounted(() => {
	// CDN 列表，按优先级尝试（jsdelivr 国内更稳定，unpkg 备用）
	const cdns = [
		'https://cdn.jsdelivr.net/npm/@waline/client@v3/dist',
		'https://unpkg.com/@waline/client@v3/dist',
	]

	// 加载 Waline 样式
	const link = document.createElement('link')
	link.rel = 'stylesheet'
	link.href = `${cdns[0]}/waline.css`
	document.head.appendChild(link)

	// 动态加载 Waline：第一个 CDN 失败则自动尝试下一个
	const tryLoad = (index = 0) => {
		const base = cdns[index]
		import(`${base}/waline.js`)
			.then(({ init }) => {
				window.__walineInstance = init({
					el: '#waline',
					serverURL: 'https://my-waline-1.vercel.app',
					dark: 'auto',
					requiredFields: ['nick'],
					locale: {
						placeholder: '说点什么吧~ 支持匿名评论',
					},
				})
			})
			.catch(() => {
				if (index + 1 < cdns.length) tryLoad(index + 1)
			})
	}
	tryLoad()
})

// 监听博客主题切换，同步 Waline 主题
watch(() => colorMode.value, (theme) => {
	window.__walineInstance?.update({ dark: theme === 'dark' })
})
</script>

<template>
<section id="comments" ref="comment" class="z-comment">
	<h3 class="z-comment__title">
		<Icon name="tabler:message-circle" />
		评论
	</h3>
	<div id="waline" />
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

#waline {
	:deep(.wl-card) {
		border-radius: 12px;
	}
	/* 隐藏网址输入框，评论只需昵称 */
	:deep(.wl-link) {
		display: none !important;
	}
}
</style>
