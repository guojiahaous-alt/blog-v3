import type { Nav, NavItem } from '~/types/nav'
import { pascalCase } from 'es-toolkit/string'
import { Temporal } from 'temporal-polyfill'
import blogConfig from '~~/blog.config'
import { name, version } from '~~/package.json'

// 图标查询：https://yesicon.app/tabler
// 图标插件：https://marketplace.visualstudio.com/items?itemName=antfu.iconify

// @keep-sorted
export default defineAppConfig({
	// 将 blog.config 中的配置项复制到 appConfig，方便调用
	...blogConfig,

	component: {
		alert: {
			/** 默认使用卡片风格还是扁平风格 */
			defaultStyle: 'card' as 'card' | 'flat',
		},

		codeblock: {
			/** 代码块触发折叠的行数 */
			triggerRows: 32,
			/** 代码块折叠后的行数 */
			collapsedRows: 16,
			/** 启用代码块缩进导航会关闭空格渲染 */
			enableIndentGuide: true,
			/** 代码块缩进导航(Indent Guige)竖线匹配空格数 */
			indent: 4,
			/** tab渲染宽度 */
			tabSize: 3,
		},

		/** 文章开头摘要 */
		excerpt: {
			animation: true,
			caret: '_',
		},

		/** 精选文章 Slide */
		slide: {
			/** 适合封面图无字时启用 */
			showTitle: true,
		},

		stats: {
			/** 归档页面每年标题对应的年龄 */
			birthYear: 2003,
			/** blog-stats widget 的预置文本 */
			wordCount: '约10万',
		},
	},

	// @keep-sorted
	footer: {
		/** 页脚版权信息，支持 <br> 换行等 HTML 标签 */
		copyright: `© ${Temporal.Now.plainDateISO().year.toString()} ${blogConfig.author.name}`,
		/** 侧边栏底部图标导航 */
		iconNav: [
			{ icon: 'tabler:home', text: '个人主页', url: blogConfig.author.homepage },
			{ icon: 'ri:qq-line', text: '交流qq:3108917128', url: 'https://wang zhi/?_wv=1027&k=lQfNSeEd' },
			{ icon: 'tabler:brand-github', text: 'GitHub: guojiahaous-alt', url: 'https://github.com/guojiahaous-alt' },
			{ icon: 'tabler:rss', text: 'Atom订阅', url: '/atom.xml' },
			{ icon: 'ri:subway-line', text: '开往 - 博客下一站', url: 'https://wang zhi/go.html' },
		] satisfies NavItem[],
		/** 页脚站点地图 */
		nav: [
			{
				title: '探索',
				items: [
					{ icon: 'tabler:rss', text: 'Atom订阅', url: '/atom.xml' },
					{ icon: 'ri:subway-line', text: '开往', url: 'https://www.travellings.cn/go.html' },
				],
			},
			{
				title: '社交',
				items: [
					{ icon: 'tabler:brand-github', text: 'guojiahaous-alt', url: 'https://github.com/guojiahaous-alt' },
					{ icon: 'ri:qq-line', text: 'qq: 3018917128', url: 'https://wang zhi/?_wv=1027&k=lQfNSeEd' },
					{ icon: 'tabler:mail', text: blogConfig.author.email, url: `mailto:${blogConfig.author.email}` },
				],
			},
			{
				title: '信息',
				items: [
					{ icon: 'simple-icons:nuxt', text: `主题: ${pascalCase(name)} ${version}`, url: 'https://github.com/L33Z22L11/blog-v3' },
					{ icon: 'tabler:color-swatch', text: '主题和组件文档', url: '/theme' },
					{ icon: 'tabler:certificate', text: '未备案', url: 'https://wang zhi/' },
				],
			},
		] satisfies Nav,
	},

	/** 左侧栏顶部 Logo */
	header: {
		logo: '/avatar.jpg',
		/** 展示标题文本，否则展示纯 Logo */
		showTitle: true,
		subtitle: blogConfig.subtitle,
		emojiTail: ['📄', '🦌', '🙌', '🐟', '🏖️'],
	},

	/** 好友模块（侧边栏） */
	friends: [
		{ name: '2_haowen_V', url: 'https://hehaowen.com.cn/', avatar: 'https://img.hehaowen.com.cn/image/avatar/%E5%8B%87%E5%A4%AA.png', desc: 'CTF大手子' },
		{ name: '翞~涵', url: 'https://blog.han1130.top/', avatar: 'https://img.han1130.top/photo/touxiang.png', desc: 'web选手' },

	] satisfies { name: string, url: string, avatar?: string, desc?: string }[],

	/** 友链页面 */
	link: {
		/** 无订阅源展示静音图标 */
		remindNoFeed: true,
		/** 友链分组内随机排序 */
		randomInGroup: true,
	},

	/** 左侧栏导航 */
	nav: [
		{
			title: '',
			items: [
				{ icon: 'tabler:files', text: '文章', url: '/' },
				{ icon: 'tabler:link', text: '友链', url: '/link' },
				{ icon: 'tabler:archive', text: '归档', url: '/archive' },
			],
		},
	] satisfies Nav,

	pagination: {
		perPage: 10,
		/** 默认排序方式，需要是 this.article.order 中的键名 */
		sortOrder: 'date' as keyof typeof blogConfig.article.order,
		/** 允许（普通/预览/归档）文章列表正序，开启后排序方式左侧图标可切换顺序 */
		allowAscending: false,
	},

	themes: {
		light: {
			icon: 'tabler:sun',
			tip: '浅色模式',
		},
		system: {
			icon: 'tabler:device-desktop',
			tip: '跟随系统',
		},
		dark: {
			icon: 'tabler:moon',
			tip: '深色模式',
		},
	},

	/** 悬浮音乐播放器 */
	player: {
		audio: [
			{
				name: '沧海犹有你',
				artist: '小鱼dik',
				url: 'https://img.guoyubo.cn/img/海屿你 - 小鱼dik.flac',
			},
		],
		// meting: {
		// 	server: 'netease',
		// 	type: 'playlist',
		// 	id: '10085528215',
		// },
	},

	petals: {
		enabled: true,
		count: 15,
	},

	heartCursor: {
		enabled: true,
	},
})
