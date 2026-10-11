<script setup lang="ts">
const commentEl = useTemplateRef('comment')
const colorMode = useColorMode()

onMounted(() => {
	// 加载 Waline 样式
	const link = document.createElement('link')
	link.rel = 'stylesheet'
	link.href = 'https://unpkg.com/@waline/client@v3/dist/waline.css'
	document.head.appendChild(link)

	// 加载 Waline 脚本并初始化
	const script = document.createElement('script')
	script.type = 'module'
	script.textContent = `
		import { init } from 'https://unpkg.com/@waline/client@v3/dist/waline.js';
		window.__walineInstance = init({
			el: '#waline',
			serverURL: 'https://my-waline-1.vercel.app',
			dark: 'auto',
			locale: {
				placeholder: '说点什么吧~ 支持匿名评论',
			},
		});
	`
	commentEl.value?.appendChild(script)
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
}
</style>
