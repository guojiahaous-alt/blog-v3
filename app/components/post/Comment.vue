<script setup lang="ts">
const commentEl = useTemplateRef('comment')

onMounted(() => {
	const script = document.createElement('script')
	script.src = 'https://giscus.app/client.js'
	script.setAttribute('data-repo', 'guojiahaous-alt/blog-v3')
	script.setAttribute('data-repo-id', 'R_kgDOSlEWmA')
	script.setAttribute('data-category', 'General')
	script.setAttribute('data-category-id', 'DIC_kwDONW9V2M4Cq5XV')
	script.setAttribute('data-mapping', 'pathname')
	script.setAttribute('data-strict', '0')
	script.setAttribute('data-reactions-enabled', '1')
	script.setAttribute('data-emit-metadata', '0')
	script.setAttribute('data-input-position', 'top')
	script.setAttribute('data-theme', 'preferred_color_scheme')
	script.setAttribute('data-lang', 'zh-CN')
	script.setAttribute('data-loading', 'lazy')
	script.crossOrigin = 'anonymous'
	script.async = true

	commentEl.value?.appendChild(script)
})
</script>

<template>
<section ref="comment" class="z-comment">
	<h3 class="text-creative">
		评论区
	</h3>
	<div class="giscus-container">
		<p>评论加载中...</p>
	</div>
</section>
</template>

<style lang="scss" scoped>
.z-comment {
	margin: 3rem 1rem;

	> h3 {
		margin-top: 3rem;
		font-size: 1.25rem;
	}
}

.giscus-container {
	margin: 2em 0;
	min-height: 200px;
}

:deep(.giscus) {
	margin-top: 1em;
}
</style>
