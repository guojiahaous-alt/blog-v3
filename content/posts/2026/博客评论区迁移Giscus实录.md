---
title: 博客评论区迁移实录：从 Twikoo 到 Giscus
description: 记录将博客评论系统从第三方 Twikoo 服务迁移到 Giscus（GitHub Discussions）的完整过程，包括方案对比、代码改造、GitHub 端配置，以及一次 Vercel 构建失败的排障经历。
date: 2026-10-11
updated: 2026-10-11
categories:
  - 技术
tags:
  - 博客, Giscus, 评论系统, Nuxt, GitHub
type: tech
---
# 博客评论区迁移实录：从 Twikoo 到 Giscus

> 评论区是一个博客的"客厅"。这次把博客的评论系统从别人部署的 Twikoo 服务，迁移到了基于 GitHub Discussions 的 Giscus，数据终于完全掌握在自己手里了。

---

## 一、为什么要迁移？

博客主题（L33Z22L11/blog-v3）默认集成了 **Twikoo** 评论系统，但配置文件里填的是主题作者自己部署的服务地址：

```ts
twikoo: {
  envId: 'https://twikoo.zhilu.site/',
  preload: 'https://twikoo.zhilu.site/',
}
```

这意味着几个问题：

1. **数据不可控**——所有评论都存在别人的 MongoDB 数据库里
2. **服务稳定性依赖第三方**——对方服务挂了，我的评论区就挂了
3. **隐私风险**——访客的评论数据经过陌生人的服务器

所以决定换掉它。

## 二、方案对比

| 方案 | 数据存储 | 成本 | 维护成本 |
|------|---------|------|---------|
| **Giscus** | 自己的 GitHub 仓库 Discussions | 免费 | 零维护 |
| 自建 Twikoo | 自己的 MongoDB | 需要数据库服务 | 需维护后端 |
| Waline | LeanCloud/自建数据库 | 免费/自建 | 需维护服务端 |

博客本身托管在 GitHub + Vercel，Giscus 是最自然的选择：**评论即 GitHub Discussion，数据在自己的仓库里，完全免费，无需任何后端**。

## 三、代码改造

### 3.1 重写评论组件

核心改动在 `app/components/post/Comment.vue`，删掉原来 Twikoo 的初始化逻辑和链接守卫，改为动态注入 Giscus 脚本：

```vue
<script setup lang="ts">
const commentEl = useTemplateRef('comment')

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
	script.setAttribute('data-theme', 'preferred_color_scheme')
	script.setAttribute('data-lang', 'zh-CN')
	script.crossOrigin = 'anonymous'
	script.async = true
	commentEl.value?.appendChild(script)
})
</script>
```

几个关键参数的含义：

- `data-mapping="pathname"`——按页面路径匹配 Discussion，每篇文章自动对应一个讨论帖
- `data-theme="preferred_color_scheme"`——自动跟随系统的明暗主题
- `data-repo-id` / `data-category-id`——仓库和分类的加密 ID，需从 giscus.app 生成器获取

### 3.2 清理 Twikoo 配置

`blog.config.ts` 中移除 Twikoo 的 CDN 脚本引用和服务配置：

```diff
 scripts: [
   { 'src': 'https://zhi.zhilu.site/zhi.js', ... },
   { 'src': 'https://static.cloudflareinsights.com/beacon.min.js', ... },
-  { src: 'https://lib.baomitu.com/twikoo/1.6.44/twikoo.min.js', defer: true },
 ],
-
-twikoo: {
-  envId: 'https://twikoo.zhilu.site/',
-  preload: 'https://twikoo.zhilu.site/',
-},
```

## 四、GitHub 端配置

代码之外还需要三步配置：

1. **开启 Discussions**：仓库 Settings → Features → 勾选 Discussions
2. **安装 Giscus App**：访问 github.com/apps/giscus，授权指定仓库
3. **获取配置 ID**：在 giscus.app 输入仓库名，生成 `repo-id` 和 `category-id` 填入代码

其中 `repo-id` 也可以通过 GitHub REST API 的 `node_id` 字段直接查到：

```powershell
Invoke-RestMethod -Uri "https://api.github.com/repos/用户名/仓库名" |
  Select-Object node_id
```

## 五、踩坑：一次 Vercel 构建失败

推送后 Vercel 部署直接报错，14 秒就失败了。查看构建日志发现：

```text
Cannot read properties of undefined (reading 'preload')
at nuxt.config.ts:30:55
```

**根因**：`nuxt.config.ts` 的 `<head>` 预加载配置里还残留着一行对 `blogConfig.twikoo.preload` 的引用，配置删了但引用没删干净，访问 `undefined.preload` 导致构建中断。

**修复**：删掉该预加载行。同时顺手处理了两个关联点：

- 目录组件 `Toc.vue` 中"跳转评论区"的锚点从 `#twikoo` 改为 `#comments`
- 评论区 `<section>` 元素加上对应的 `id="comments"`

> 💡 **教训**：删除一个功能的配置时，一定要全局搜索关键词（`twikoo`），把所有引用点清理干净。这次漏检了 `nuxt.config.ts`，白失败了一次部署。

## 六、最终效果

- 每篇文章底部自动加载 Giscus 评论区，读者用 GitHub 账号即可评论
- 评论数据存储在仓库的 Discussions 中，邮件实时通知
- 后台可直接在 GitHub 上管理评论（删除、置顶、锁定）
- 支持 Markdown、代码高亮、表情反应，自动适配明暗主题

---

时间太晚了，后续会继续优化
