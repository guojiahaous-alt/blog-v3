---
title: 加一个悬浮音乐播放器
description: 基于 APlayer 在 Nuxt 博客中实现右下角悬浮音乐播放器的完整过程，包括资源准备、组件编写、全局集成和外部存储配置。
date: 2026-05-26
updated: 2026-05-26
categories:
  - 技术
tags:
  - Nuxt, APlayer, 音乐播放器, 博客定制
image: https://img-reg-ab.imagency.cn/e/af48c66408dfa1363293b57d97971005.jpg
recommend: 1
type: tech
---
# 加一个悬浮音乐播放器

博客写久了总觉得少了点什么——对，背景音乐。这篇文章记录了我在 Nuxt 博客里集成 APlayer 悬浮播放器的全过程，从零开始，一步步来。

## 整体思路

先明确要做什么：

1. 页面右下角固定一个音乐播放器，不随滚动移动
2. 播放器可以折叠为一个小圆形按钮，点击展开
3. 支持播放列表，列表默认折叠
4. 全局可用，任何页面都能控制播放

技术选型上，APlayer 是国内开发者 DIYgod 写的 HTML5 音乐播放器，样式精美、功能完善，社区活跃，中文文档齐全，是博客音乐播放器的主流选择。

实现路径拆成四步：

1. 准备 APlayer 的 CSS 和 JS 文件
2. 编写 Vue 组件封装播放器逻辑
3. 在全局布局中引入组件
4. 配置播放列表数据

## 第一步：准备 APlayer 资源文件

APlayer 的源码仓库在 GitHub 上，但我们的博客项目不需要编译它，只需要编译后的产物。

从 APlayer 源码的 `dist/` 目录中提取两个文件：

- `APlayer.min.css` — 播放器样式
- `APlayer.min.js` — 播放器逻辑

将它们复制到项目的 `public/aplayer/` 目录下：

```
public/
  aplayer/
    APlayer.min.css
    APlayer.min.js
```

放在 `public/` 下的文件在 Nuxt 中会作为静态资源直接提供服务，部署后可以通过 `/aplayer/APlayer.min.js` 这样的路径访问。

为什么不通过 npm 安装？APlayer 的 npm 包（`aplayer`）版本是 1.10.1，和源码仓库一致，但直接 import 会在 SSR 环境中报错（APlayer 依赖 `document` 和 `window`）。通过静态资源方式加载，可以精确控制加载时机，只在客户端执行，避免 SSR 兼容问题。

## 第二步：编写播放器组件

在 `app/components/blog/` 目录下新建 `BlogPlayer.vue`。Nuxt 会根据目录结构自动注册组件，放在 `blog/` 下就能以 `<BlogPlayer>` 使用。

### 完整代码

文件位置：`app/components/blog/BlogPlayer.vue`

```vue
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
```

### 逐段说明

**数据接口定义**

```ts
interface MusicItem {
	name: string      // 歌曲名
	artist: string    // 歌手
	url: string       // 音频文件地址
	cover?: string    // 封面图（可选）
	lrc?: string      // 歌词文件地址（可选）
	theme?: string    // 播放器主题色（可选）
}
```

组件通过 `audio` 属性接收播放列表，类型为 `MusicItem[]`。`cover`、`lrc`、`theme` 都是可选的，不填也能正常播放。

**资源动态加载**

```ts
function loadScript(src: string): Promise<void> { ... }
function loadStyle(href: string) { ... }
```

这两个函数在 `onMounted` 中调用，动态向 `<head>` 注入 APlayer 的 CSS 和 JS。这样做的好处是：

- 只在组件挂载时加载，SSR 阶段不会执行
- 有重复检测，页面切换不会重复加载
- 不需要修改 `nuxt.config.ts` 的全局配置

**APlayer 初始化**

```ts
onMounted(async () => {
	if (!props.audio?.length)
		return

	loadStyle('/aplayer/APlayer.min.css')
	await loadScript('/aplayer/APlayer.min.js')

	ap = new APlayer({
		container: playerContainer.value,
		// ...
		audio: props.audio,
	})
})
```

关键点：

- `if (!props.audio?.length) return` — 没有歌曲时不初始化，组件自动隐藏
- `await loadScript(...)` — 必须等 JS 加载完成才能调用 `new APlayer()`
- `container: playerContainer.value` — 挂载到模板中的 `ref` 元素

APlayer 的配置项说明：


| 配置项          | 值         | 说明                                |
| --------------- | ---------- | ----------------------------------- |
| `mini`          | `false`    | 不使用迷你模式，保留完整控件        |
| `autoplay`      | `false`    | 不自动播放，尊重用户选择            |
| `theme`         | `#b7daff`  | 播放器默认主题色                    |
| `loop`          | `all`      | 列表循环播放                        |
| `order`         | `list`     | 按列表顺序播放（可选`random` 随机） |
| `preload`       | `metadata` | 只预加载元数据，节省流量            |
| `volume`        | `0.7`      | 默认音量 70%                        |
| `mutex`         | `true`     | 互斥播放，同一时间只播放一首        |
| `listFolded`    | `true`     | 播放列表默认折叠                    |
| `listMaxHeight` | `200px`    | 列表最大高度，超出滚动              |

**折叠/展开逻辑**

```ts
function toggleMinimize() {
	isMinimized.value = !isMinimized.value
	if (isMinimized.value) {
		ap?.pause()
	}
}
```

折叠时暂停播放，展开时恢复。`isMinimized` 控制模板中的 `v-show` 和样式类名。

**模板结构**

```html
<ClientOnly>
	<div class="aplayer-float" :class="{ minimized: isMinimized }">
		<div class="aplayer-toggle" @click="toggleMinimize">
			<Icon :name="isMinimized ? 'tabler:music' : 'tabler:chevron-down'" />
		</div>
		<div v-show="!isMinimized" ref="playerContainer" class="aplayer-container" />
	</div>
</ClientOnly>
```

- `<ClientOnly>` 包裹整个组件，确保只在客户端渲染
- 折叠时只显示圆形按钮（音乐图标），展开时显示完整播放器
- `v-show` 而非 `v-if`，保持 APlayer 实例不被销毁

**样式要点**

```scss
.aplayer-float {
	position: fixed;           // 固定定位，不随滚动移动
	inset-inline-end: 1rem;    // 右侧 1rem（RTL 兼容）
	bottom: 1rem;              // 底部 1rem
	z-index: var(--z-index-popover, 1000);  // 层级高于普通内容
}
```

- `inset-inline-end` 代替 `right`，兼容从右到左的语言布局
- 使用项目已有的 CSS 变量（`--c-bg-1`、`--c-text-2` 等），自动适配浅色/深色主题
- 移动端缩小边距，避免溢出屏幕

## 第三步：集成到全局布局

文件位置：`app/app.vue`

在 `app.vue` 的模板末尾添加播放器组件：

```html
<template>
<!-- ... 其他内容 ... -->
<BlogPlayer :audio="appConfig.player?.audio" />
</template>
```

同时在 `app.vue` 中添加 `<script setup>` 来获取配置：

```ts
<script setup>
const appConfig = useAppConfig()
</script>
```

播放器放在 `app.vue` 中意味着它是全局的——无论用户在哪个页面，播放器都会显示在右下角，切换页面时音乐不会中断。

## 第四步：配置播放列表

文件位置：`app/app.config.ts`

在配置对象中添加 `player` 字段：

```ts
/** 悬浮音乐播放器 */
player: {
	audio: [
		{
			name: '晴天',
			artist: '周杰伦',
			url: '/music/晴天.mp3',
			cover: '/music/晴天.jpg',
			theme: '#b7daff',
		},
		{
			name: '夜曲',
			artist: '周杰伦',
			url: '/music/夜曲.mp3',
			cover: '/music/夜曲.jpg',
		},
	],
},
```

放在 `app.config.ts` 而不是 `blog.config.ts` 的原因：`app.config` 是运行时配置，通过 `useAppConfig()` 可以在组件中直接读取，修改后热更新生效，不需要重启开发服务器。

每首歌的字段说明：


| 字段     | 必填 | 说明                               |
| -------- | ---- | ---------------------------------- |
| `name`   | 是   | 歌曲名称，显示在播放器上           |
| `artist` | 是   | 歌手名                             |
| `url`    | 是   | 音频文件地址，支持 mp3/ogg/wav/m4a |
| `cover`  | 否   | 封面图，不填则显示默认图标         |
| `lrc`    | 否   | LRC 歌词文件地址，支持显示滚动歌词 |
| `theme`  | 否   | 该歌曲的主题色，覆盖全局 theme     |

## 使用外部存储托管音乐文件

音乐文件通常比较大（一首 mp3 约 3-8MB），全放在项目仓库里会让 git 仓库膨胀、部署变慢。实际使用中建议把音乐文件上传到外部存储，播放列表中直接填写外部 URL。

### 方案一：Cloudflare R2（推荐）

Cloudflare R2 提供免费额度：10GB 存储 + 每月 1000 万次读取，对个人博客绰绰有余。

**配置步骤：**

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)，进入 R2 服务
2. 创建一个存储桶（如 `blog-media`）
3. 上传音乐文件和封面图
4. 在存储桶设置中开启公开访问，绑定自定义域名（如 `media.yourdomain.com`）
5. 上传后的文件访问路径为 `https://media.yourdomain.com/music/晴天.mp3`

**访问权限设置：**

R2 默认私有，需要手动开启公开访问。在存储桶的 Settings 页面中找到 "Public access"，选择 "Custom domain" 或 "R2.dev subdomain" 方式开启。自定义域名方式支持 CDN 加速，推荐使用。

**播放列表配置：**

```ts
player: {
	audio: [
		{
			name: '晴天',
			artist: '周杰伦',
			url: 'https://media.yourdomain.com/music/晴天.mp3',
			cover: 'https://media.yourdomain.com/covers/晴天.jpg',
		},
	],
},
```

### 方案二：GitHub 仓库

新建一个专门的资源仓库（如 `blog-media`），把音乐文件 push 上去，通过 raw 链接访问。

**文件路径：**

```
blog-media/
  music/
    晴天.mp3
    夜曲.mp3
  covers/
    晴天.jpg
    夜曲.jpg
```

**访问地址格式：**

```
https://raw.githubusercontent.com/你的用户名/blog-media/main/music/晴天.mp3
```

**注意事项：**

- GitHub 对单文件大小限制 100MB，一般 mp3 不会超
- raw 链接国内访问可能较慢，建议配合 CDN 使用
- 仓库设为 Public 才能通过 raw 链接直接访问

### 方案三：又拍云

又拍云有[免费 CDN 加速联盟计划](https://www.upyun.com/league)，个人博客可以申请，审核通过后每月有免费额度。

**配置步骤：**

1. 注册又拍云账号，创建云存储服务
2. 开启 CDN 加速，绑定自定义域名
3. 通过控制台或 FTP 上传文件
4. 访问地址为 `https://你的域名/music/晴天.mp3`

### 方案四：本地 public 目录

最简单的方式，适合歌曲不多的情况。

**目录结构：**

```
public/
  music/
    晴天.mp3
    夜曲.mp3
  covers/
    晴天.jpg
    夜曲.jpg
```

**播放列表配置：**

```ts
player: {
	audio: [
		{
			name: '晴天',
			artist: '周杰伦',
			url: '/music/晴天.mp3',
			cover: '/covers/晴天.jpg',
		},
	],
},
```

**注意事项：**

- 音乐文件会进入 git 仓库和部署包，建议在 `.gitignore` 中排除大文件
- 部署到 Vercel 等平台时，单个文件大小不能超过 50MB
- 歌曲多了以后建议迁移到外部存储

### 跨域问题处理

如果音频文件托管在外部域名下，浏览器可能因为 CORS 策略拒绝加载。解决方法是在存储服务端配置允许跨域访问。

**Cloudflare R2 的 CORS 配置：**

在存储桶的 Settings 页面找到 CORS policy，添加规则：

```json
[
	{
		"AllowedOrigins": ["https://your-blog-domain.com"],
		"AllowedMethods": ["GET", "HEAD"],
		"AllowedHeaders": ["*"],
		"MaxAgeSeconds": 86400
	}
]
```

如果希望任何网站都能播放（比如友链站点也想测试），可以把 `AllowedOrigins` 设为 `["*"]`。

**又拍云的 CORS 配置：**

在云存储服务的「基本设置」→「CORS 跨域共享」中添加规则，来源填写博客域名，允许方法勾选 GET 和 HEAD。

## 常见问题

### 播放器不显示

按顺序排查：

1. `app.config.ts` 中 `player.audio` 数组是否有数据
2. 浏览器控制台是否有 JS 报错（APlayer 加载失败）
3. `public/aplayer/` 下是否存在 `APlayer.min.css` 和 `APlayer.min.js`
4. `app.vue` 中是否正确引入了 `<BlogPlayer>` 组件

### 音频加载失败

- 检查 URL 是否正确，在浏览器中直接访问该 URL 看能否播放
- 如果是外部链接，检查 CORS 配置
- 如果是本地文件，检查文件是否在 `public/` 目录下且路径匹配

### 页面切换时播放中断

播放器组件放在 `app.vue` 中，Nuxt 页面切换不会销毁 `app.vue` 的子组件，所以音乐不会中断。如果放在具体页面组件中，切换页面时组件会被销毁重建，播放就会中断。

### 移动端播放器太宽

组件已设置 `max-width: 380px`，移动端会自动缩小到 `calc(100vw - 1rem)`。如果仍然觉得宽，可以调整 `max-width` 的值。

## 文件清单

整个功能涉及的文件汇总：


| 文件                                 | 作用                 |
| ------------------------------------ | -------------------- |
| `public/aplayer/APlayer.min.css`     | APlayer 样式文件     |
| `public/aplayer/APlayer.min.js`      | APlayer 逻辑文件     |
| `app/components/blog/BlogPlayer.vue` | 播放器 Vue 组件      |
| `app/app.vue`                        | 全局布局，引入播放器 |
| `app/app.config.ts`                  | 播放列表配置         |
