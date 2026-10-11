---
title: 博客评论系统再迁移：从 Giscus 到 Waline，自部署评论区的连环踩坑全记录
description: 记录博客评论系统从 Giscus（GitHub Discussions）切换到自部署 Waline 的完整过程，涵盖 Vercel 部署 Waline 服务端、Neon 数据库初始化、前端组件改造，以及过程中遇到的 Framework 预设、monorepo 目录、pnpm 冲突、数据库表缺失等连环问题与排查解决。
date: 2026-10-11
updated: 2026-10-11
categories:
  - 技术
tags:
  - 博客, Waline, 评论系统, Vercel, Neon, PostgreSQL, Nuxt
type: tech
image: https://img.guoyubo.cn/img/Image-11-22-04.png
---
# 博客评论系统再迁移：从 Giscus 到 Waline，自部署评论区的连环踩坑全记录

> 上一篇文章刚把评论区从 Twikoo 迁到 Giscus，还没来得及用舒坦，就又折腾了一次——这回换成了 Waline。整个过程踩了七八个连环坑，索性把全部过程写下来，给后来者避坑。

---

## 一、为什么又要迁移？

上一次迁移到 Giscus 后，用了几天发现两个不太满意的点：

1. **评论门槛高**：Giscus 基于 GitHub Discussions，访客想评论必须有 GitHub 账号并登录。对国内普通读者来说，这个门槛直接劝退了大部分人，评论区基本等于摆设。
2. **样式不够灵活**：Giscus 是 iframe 嵌入，主题跟随系统而不是跟随博客，暗色主题切换时评论区会"慢半拍"，整体观感和博客卡片风格也不够统一。

所以目标很明确：找一个**支持匿名评论、数据自己掌控、样式可定制**的评论系统。最终选定了 **Waline**——一个开源的、自部署的评论系统，后端基于 Node.js，前端支持多种框架，数据可以存到各种数据库。

## 二、整体方案与技术选型

| 项目 | 选型 | 理由 |
|------|------|------|
| 评论系统 | Waline v3 | 开源、自部署、支持匿名评论、支持表情与 Markdown |
| 服务端托管 | Vercel | 博客本身就在 Vercel，零额外成本 |
| 数据库 | Neon（PostgreSQL） | Vercel 官方推荐，免费版无需绑卡，按量自动扩缩 |
| 前端接入 | 动态 script 注入 | 避免在 Nuxt 中引入额外 npm 依赖，保持构建干净 |

部署架构如下：

```
访客浏览器 ──> blog.guoyubo.cn (Nuxt, Vercel)
                  └── 评论组件 <script> ──> my-waline-1.vercel.app (Waline 服务端)
                                                    └── Neon PostgreSQL (wl_comment 等表)
```

## 三、完整操作步骤

### 步骤 1：前端组件改造（Comment.vue）

把原来的 Giscus 组件换成 Waline。核心做法是**动态注入 script 和样式**，而不是在 `package.json` 里装依赖：

```vue
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
```

关键点：
- `serverURL` 指向稍后要部署的 Waline 服务端地址
- `watch` 监听博客明暗主题变化，调用 `update({ dark })` 实时换肤
- 用 `:deep()` 给 Waline 卡片加圆角，和博客风格统一

### 步骤 2：Vercel 上部署 Waline 服务端

通过 Vercel 的「Clone Repository」功能，直接克隆官方 `walinejs/waline` 仓库到自己账号下，项目名设为 `my-waline-1`。

### 步骤 3：创建 Neon 数据库

在 Vercel 项目的 **Storage → Create Database** 中选择 **Serverless Postgres（由 Neon 提供）**，区域选了 `Cleveland, USA (East)`，免费套餐，Accept and Create。

### 步骤 4：修正 Vercel 构建设置

这一步是整个过程中坑最多的地方，具体问题见第四节。最终生效的配置：

| 配置项 | 值 |
|--------|-----|
| Framework Preset | Other |
| Root Directory | `example` |
| Install Command | `npm install` |
| Build Command | （空） |
| Output Directory | （空） |

### 步骤 5：初始化数据库表

在 Neon 的 SQL Editor 中执行 Waline 官方建表 SQL（`waline.pgsql`），创建 `wl_comment`、`wl_counter`、`wl_users` 三张表及对应的序列。

### 步骤 6：前端指向服务端并部署

把 `serverURL` 填成 `https://my-waline-1.vercel.app`，提交推送到 GitHub，Vercel 自动部署博客。

### 步骤 7：注册管理员

访问 `https://my-waline-1.vercel.app/ui/register`，注册第一个账号自动成为管理员，之后可以在后台审核、删除、回复评论。

## 四、遇到的问题与解决方案

### 问题 1：nuxt.config.ts 构建失败——`Cannot read properties of undefined (reading 'preload')`

**现象**：从 Giscus 切换到 Waline 时，删掉了 `blog.config.ts` 里的 `twikoo` 配置，结果博客构建失败。

**排查**：全局搜索 `twikoo`，发现 `nuxt.config.ts` 里还有一行：

```ts
head: {
  link: [{ rel: 'preload', href: blogConfig.twikoo.preload }],
}
```

`blogConfig.twikoo` 已被删除，所以 `blogConfig.twikoo.preload` 抛错。

**解决**：删除这行预加载配置。

---

### 问题 2：Giscus 阶段——页面出现"两个评论区"

**现象**：文章底部同时显示了"评论加载中..."文字和真正的 Giscus 组件，看起来像两个评论区。

**排查**：`Comment.vue` 模板里有一个 loading 占位 `<p>`，giscus 加载完成后没有移除它。

**解决**：给占位元素加 `v-if="!loaded"`，脚本 `onload` 后把 `loaded` 设为 true，占位自动消失。

---

### 问题 3：Giscus 阶段——暗色主题不跟随博客

**现象**：切换博客明暗主题时，Giscus 评论区不变色。

**解决**：`watch` 监听 `colorMode`，通过 `postMessage` 向 giscus iframe 发送 `set-theme` 消息。（后来换 Waline 后这个问题用 `update({ dark })` 更优雅地解决了。）

---

### 问题 4：Waline 首次部署失败——`No Output Directory named 'dist' found`

**现象**：Vercel 部署 Waline 直接报错 `No Output Directory named 'dist' found after the Build completed`。

**排查**：Waline 是 monorepo，根目录没有实际要部署的产物。Vercel 自动检测到根目录 `package.json` 里有 `vite` 依赖，就把 Framework Preset 设成了 Vite，默认输出目录 `dist`——但根目录根本不产出 dist。

**解决**：把 **Framework Preset 改为 Other**，清空 Build Command 和 Output Directory。

> 小坑：Vercel 的 Framework Preset 下拉框点击不展开，Save 按钮也被锁定。最后通过在 Console 里直接操作 DOM + 触发 React 的 change 事件才保存成功。

---

### 问题 5：改完 Framework 后仍然失败——`Command "pnpm install" exited with 1`

**现象**：部署 8 秒就挂了，日志显示 pnpm 安装失败。

**排查**：Waline 根目录 `package.json` 里声明了 `"packageManager": "pnpm@12.8.1"`，Vercel 检测到后强制用 pnpm 安装。但我把 Root Directory 设成了 `example`，example 子目录里没有 `pnpm-lock.yaml`，`pnpm install --frozen-lockfile` 直接失败。

**解决**：
1. 把 **Root Directory 设为 `example`**（Waline 官方部署目录，里面有 `vercel.json` 和 `index.cjs`）
2. **Install Command 覆盖为 `npm install`**

---

### 问题 6：仍然 pnpm 失败——`ERR_PNPM_OTHER_PM_EXPECTED`

**现象**：设置了 `npm install` 还是报 `ERR_PNPM_OTHER_PM_EXPECTED`，Vercel 依然用 pnpm。

**排查**：Vercel 检测到仓库根目录存在 `pnpm-lock.yaml`，就强制启用 pnpm，忽略了 Install Command 的设置。同时 example 目录的 `package.json` 又没有声明包管理器，pnpm 读到根目录的 `packageManager: pnpm` 就和 `npm install` 冲突。

**解决**（两步）：
1. 在 GitHub 上编辑 `example/package.json`，添加 `"packageManager": "npm@10.0.0"`，告诉 Vercel 在 example 目录用 npm
2. **删除仓库根目录的 `pnpm-lock.yaml`**，彻底切断 Vercel 启用 pnpm 的依据

提交后 Vercel 自动触发新部署，这次 `npm install` 成功执行，构建通过。

---

### 问题 7：服务端部署成功但 API 返回 500——`relation "wl_comment" does not exist`

**现象**：`https://my-waline-1.vercel.app` 能打开，但访问评论 API `https://my-waline-1.vercel.app/api/comment?path=/` 返回 500。

**排查**：错误信息明确是数据库表不存在。Waline 服务端不会自动建表，需要手动执行官方的 `waline.pgsql`。

**解决**：去 Neon 控制台的 SQL Editor 执行建表 SQL。

---

### 问题 8：建表 SQL 整段执行失败——`wl_comment_seq does not exist` / `read-only transaction`

**现象**：把整段 SQL 粘进去执行，报 `cannot execute CREATE TABLE in a read-only transaction` 和 `relation "wl_comment_seq" does not exist`。

**排查**：
1. Neon 的 SQL Editor 默认开了 **Read-only** 模式，不能写操作
2. 整段多语句执行时，`CREATE TABLE` 引用了还没创建的序列（`wl_comment_seq`），语句顺序/事务边界出了问题

**解决**：
1. 关闭 SQL Editor 上的 **Read-only** 开关
2. **把 6 条 SQL 拆成单条逐一执行**（3 个 `CREATE SEQUENCE` + 3 个 `CREATE TABLE`），每条确认成功后再执行下一条

全部成功后，API 恢复正常，返回 `{"errno":0,"data":{...}}`。

## 五、最终成果与验证

部署完成后做了以下验证：

- ✅ Vercel 部署状态 Ready
- ✅ `https://my-waline-1.vercel.app` 显示 Waline 评论表单
- ✅ `https://my-waline-1.vercel.app/api/comment?path=/` 返回 200 JSON
- ✅ 博客文章页底部渲染出 Waline 评论组件，有"说点什么吧~ 支持匿名评论"输入框
- ✅ Console 无 Waline 相关报错，无 CORS 错误
- ✅ 明暗主题切换时评论区实时跟随变色

最终评论区支持：
- **匿名评论**（填昵称即可，邮箱/网址可选）
- **Markdown 语法**
- **表情反应**
- **评论回复**（树形结构）
- **管理员后台**审核与管理

## 六、经验总结

1. **monorepo 项目部署要找对子目录**：Waline 官方仓库根目录是开发用的，真正能直接部署的是 `example` 目录，里面有完整的 `vercel.json` 和 serverless function 入口 `index.cjs`。

2. **Vercel 的包管理器检测优先级**：`pnpm-lock.yaml` 存在 → 强制 pnpm；`packageManager` 字段 → 决定用哪个。两者要保持一致，否则就会出现 `ERR_PNPM_OTHER_PM_EXPECTED`。

3. **数据库建表 SQL 最好逐条执行**：多语句一次性粘贴容易因为事务边界或依赖顺序失败，拆开执行更稳妥，也方便定位哪条出错。

4. **Neon 免费版够用但会冷启动**：长期无请求会休眠，首次访问慢几秒，对博客评论完全可以接受。

## 七、后续优化方向

- [ ] 配置评论邮件通知（SMTP），有人评论时及时收到提醒
- [ ] 给 Waline 服务端绑定自定义域名（如 `comment.guoyubo.cn`），避免依赖 `vercel.app` 子域名
- [ ] 开启评论审核，防止垃圾评论
- [ ] 把 Giscus 的旧评论迁移过来（如果有的话）

---

> 时间太晚了，后续会继续优化。
