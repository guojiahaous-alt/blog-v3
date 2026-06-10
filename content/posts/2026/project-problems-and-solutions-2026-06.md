---
title: 博客项目问题汇总与解决方案（2026年6月）
date: 2026-06-11
description: 系统性记录博客项目近期遇到的技术问题、根因分析及完整解决方案
tags:
  - 问题排查
  - 解决方案
  - 技术总结
categories: 技术文档
---

# 博客项目问题汇总与解决方案

## 问题一：图标显示异常

### 问题描述
"今日访问"功能区域的日历图标无法正常显示，页面上该位置显示为空或显示默认占位符。

### 发生时间
2026年6月

### 影响范围
- 首页侧边栏的访问统计组件
- 全站页脚的统计展示

### 严重程度
🟡 中等 - 不影响核心功能，但影响用户体验

### 问题根因
使用了不存在的图标名称 `tabler:calendar-day`，Tabler Icons 图标库中该图标不存在。

### 解决方案

#### 1. 定位问题文件

| 文件路径 | 行号 | 错误代码 |
|---------|------|---------|
| `app/components/blog/VisitorStats.vue` | 第64行 | `<Icon name="tabler:calendar-day" />` |
| `app/components/widget/BlogStats.vue` | 第99行 | `<Icon name="tabler:calendar-day" ... />` |

#### 2. 修复步骤

```bash
# 确认图标名称是否正确
# 访问 Tabler Icons 官网：https://tabler.io/icons
# 搜索 "calendar"，确认正确的图标名称
```

#### 3. 修改代码

**修改文件 1**: `app/components/blog/VisitorStats.vue`

```vue
<!-- 修复前 -->
<Icon name="tabler:calendar-day" />

<!-- 修复后 -->
<Icon name="tabler:calendar" />
```

**修改文件 2**: `app/components/widget/BlogStats.vue`

```vue
<!-- 修复前 -->
<Icon name="tabler:calendar-day" class="w-5 h-5" />

<!-- 修复后 -->
<Icon name="tabler:calendar" class="w-5 h-5" />
```

#### 4. 验证方法
1. 启动开发服务器：`pnpm dev`
2. 访问网站首页
3. 确认"今日访问"图标正常显示

---

## 问题二：访问量统计数值异常

### 问题描述
总访问量、今日访问量和当前在线人数三个指标数值完全一致，且刷新页面时总访问量出现减少的情况。

### 发生时间
2026年6月

### 影响范围
- 访问统计API接口 `/api/visitors`
- 所有使用统计数据的页面组件

### 严重程度
🔴 高 - 数据统计完全失效，影响运营数据准确性

### 问题根因
#### 1. 重复累加问题

后端API返回数据时，对 `total` 字段进行了重复计算：

```typescript
// server/api/visitors.post.ts 第10行
return {
  total: stats.total + stats.today,  // ❌ 错误：重复累加
  today: stats.today,
  online: stats.online,
}
```

前端组件也犯了同样的错误：

```typescript
// VisitorStats.vue 和 BlogStats.vue
stats.value = {
  total: data.total + data.today,  // ❌ 重复累加
  today: data.today,
  online: data.online,
}
```

#### 2. cleanupOnline 函数副作用

`cleanupOnline()` 函数会删除超时的IP记录，但不会同步更新 `today` 值，导致数据不一致。

### 解决方案

#### 1. 修复后端 API

**文件**: `server/api/visitors.post.ts`

```typescript
// 修复前
return {
  total: stats.total + stats.today,  // ❌
  today: stats.today,
  online: stats.online,
}

// 修复后
return {
  total: stats.total,  // ✅ 不再累加
  today: stats.today,
  online: stats.online,
}
```

#### 2. 修复前端组件

**文件**: `app/components/blog/VisitorStats.vue` 和 `app/components/widget/BlogStats.vue`

```typescript
// 修复前
stats.value = {
  total: data.total + data.today,  // ❌
  today: data.today,
  online: data.online,
}

// 修复后
stats.value = {
  total: data.total,  // ✅ 直接使用
  today: data.today,
  online: data.online,
}
```

#### 3. 重构 visitors.ts

**文件**: `server/utils/visitors.ts`

将 `cleanupOnline()` 改为 `calculateOnline()`，只计算不修改：

```typescript
// 修复前：会删除记录并修改 today
function cleanupOnline(stats: VisitorStats) {
  for (const [ip, record] of Object.entries(stats.todayRecords)) {
    if (now - record.lastVisit > ONLINE_TIMEOUT) {
      delete stats.todayRecords[ip]  // ❌ 副作用
    }
  }
  stats.online = ...
}

// 修复后：只计算在线人数
function calculateOnline(stats: VisitorStats): number {
  let onlineCount = 0
  for (const record of Object.values(stats.todayRecords)) {
    if (now - record.lastVisit <= ONLINE_TIMEOUT) {
      onlineCount++
    }
  }
  return onlineCount  // ✅ 无副作用
}
```

### 预期效果
| 指标 | 修复前 | 修复后 |
|------|--------|--------|
| total | 异常（重复累加） | ✅ 正确（所有新访客累计） |
| today | 异常（与total相同） | ✅ 正确（今日唯一访客数） |
| online | 异常（与其他相同） | ✅ 正确（5分钟内活跃访客） |

---

## 问题三：在线人数显示为0

### 问题描述
用户正在访问网站，但"当前在线"人数显示为0。

### 发生时间
2026年6月

### 影响范围
- 访问统计组件的在线人数显示
- 实时在线状态展示

### 严重程度
🟡 中等 - 用户体验问题

### 问题根因

#### 1. SSR 兼容性问题

在 Nuxt 的服务器端渲染阶段，浏览器 API（如 `localStorage`、`window.screen`）不可用，导致 `getVisitorId()` 函数抛出错误，阻止了访问记录发送。

```typescript
// 错误代码
const getVisitorId = () => {
  let visitorId = localStorage.getItem('blog_visitor_id')  // ❌ SSR时不可用
  // ...
}
```

#### 2. API 处理逻辑问题

POST 请求的 API 路由处理不当，导致访问记录未能正确写入。

### 解决方案

#### 1. 添加 SSR 检测

**文件**: `app/components/blog/VisitorStats.vue` 和 `app/components/widget/BlogStats.vue`

```typescript
// 添加客户端检测
const isClient = typeof window !== 'undefined'

const getVisitorId = (): string => {
  // SSR 环境检测
  if (typeof localStorage === 'undefined') {
    return 'ssr-' + Math.random().toString(36).substring(2, 15)
  }
  
  // 正常逻辑...
}

// 记录访问
const recordVisit = async () => {
  if (!isClient) return  // 在服务端时直接返回
  // ...
}
```

#### 2. 确保 API 路由存在

确认 `server/api/visitors.post.ts` 文件存在并正确处理 POST 请求。

### 验证方法

```bash
# 1. 启动开发服务器
pnpm dev

# 2. 打开浏览器访问
http://localhost:3000

# 3. 打开开发者工具查看控制台
# 应该看到类似日志：
# [Visitor] Recording visit with visitorId: xxx
# [Visitor] Visit recorded: {total: xxx, today: xxx, online: xxx}
```

---

## 问题四：生产环境访问量始终为1

### 问题描述
本地开发环境统计功能正常，但部署到 Vercel 后访问量始终显示为1，无法正常统计。

### 发生时间
2026年6月

### 影响范围
- Vercel 生产环境
- 所有线上访问者统计

### 严重程度
🔴 高 - 生产环境功能完全失效

### 问题根因

#### 1. Serverless 环境特性

Vercel 使用 Serverless Functions 架构，存在以下特性：

| 环境特性 | 说明 |
|---------|------|
| 临时文件系统 | 写入的文件不会持久化 |
| 函数无状态 | 每次请求可能由不同实例处理 |
| CDN 代理 | 所有请求来源IP相同 |

#### 2. 数据不持久化

```bash
# 本地环境：请求1保存数据 → 请求2读取数据 → 数据存在 ✅
# Vercel环境：请求1保存数据 → 请求2读取数据 → 文件不存在 ❌
```

#### 3. IP 识别失效

经过 CDN 后，所有请求的 IP 都变成 CDN 服务器的 IP，导致系统将所有访客识别为同一用户。

### 解决方案

使用 **Upstash Redis**（Vercel KV 的底层服务）替代本地文件存储。

#### 1. 在 Vercel 中创建 Redis 数据库

**步骤**：

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 进入 **Storage** 页面
3. 点击 **Create Database**
4. 选择 **Upstash for Redis**
5. 配置数据库：
   - **Name**: `blog-visitor-stats`
   - **Region**: 离用户最近的区域
   - **Plan**: 免费版（Free Tier）
6. 点击 **Create**

#### 2. 连接数据库到项目

1. 点击 **Connect to Project**
2. 选择博客项目
3. 勾选运行环境：
   - ✅ Production
   - ✅ Preview
   - ✅ Development
4. 点击 **Connect**

#### 3. 更新代码使用 Redis

**安装依赖**：

```bash
pnpm add @upstash/redis
```

**修改文件**: `server/utils/visitors.ts`

```typescript
import { Redis } from '@upstash/redis'

export interface VisitorStats {
  total: number
  today: number
  online: number
  todayRecords: Record<string, { count: number; lastVisit: number }>
  lastResetTime: number
}

const ONLINE_TIMEOUT = 300000

const defaultStats: VisitorStats = {
  total: 0,
  today: 0,
  online: 0,
  todayRecords: {},
  lastResetTime: Date.now(),
}

// 使用 Vercel KV 的环境变量
let redis: ReturnType<typeof Redis.fromEnv> | null = null

try {
  redis = new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  })
} catch (error) {
  console.warn('[Visitor] Redis initialization failed:', error)
}

function isNewDay(lastReset: number): boolean {
  const lastDate = new Date(lastReset)
  const now = new Date()
  return (
    lastDate.getDate() !== now.getDate() ||
    lastDate.getMonth() !== now.getMonth() ||
    lastDate.getFullYear() !== now.getFullYear()
  )
}

function calculateOnline(stats: VisitorStats): number {
  const now = Date.now()
  let onlineCount = 0
  for (const record of Object.values(stats.todayRecords)) {
    if (now - record.lastVisit <= ONLINE_TIMEOUT) {
      onlineCount++
    }
  }
  return onlineCount
}

export async function recordVisit(ip: string, visitorId?: string): Promise<VisitorStats> {
  if (!redis) {
    return defaultStats
  }

  let stats = defaultStats

  try {
    const stored = await redis.get<VisitorStats>('visitor-stats')
    if (stored) stats = stored
  } catch (error) {
    console.warn('[Visitor] Failed to get stats:', error)
  }

  if (isNewDay(stats.lastResetTime)) {
    stats = {
      total: stats.total,
      today: 0,
      online: 0,
      todayRecords: {},
      lastResetTime: Date.now(),
    }
  }

  const now = Date.now()
  const recordKey = visitorId ? `vid:${visitorId}` : `ip:${ip}`

  if (!stats.todayRecords[recordKey]) {
    stats.total++
    stats.todayRecords[recordKey] = { count: 1, lastVisit: now }
  } else {
    stats.todayRecords[recordKey].lastVisit = now
  }

  stats.today = Object.keys(stats.todayRecords).length
  stats.online = calculateOnline(stats)

  try {
    await redis.set('visitor-stats', stats)
  } catch (error) {
    console.warn('[Visitor] Failed to save stats:', error)
  }

  return stats
}

export async function getStats(): Promise<VisitorStats> {
  if (!redis) {
    return defaultStats
  }

  let stats = defaultStats

  try {
    const stored = await redis.get<VisitorStats>('visitor-stats')
    if (stored) stats = stored
  } catch (error) {
    console.warn('[Visitor] Failed to get stats:', error)
    return defaultStats
  }

  if (isNewDay(stats.lastResetTime)) {
    stats = {
      total: stats.total,
      today: 0,
      online: 0,
      todayRecords: {},
      lastResetTime: Date.now(),
    }
    await redis.set('visitor-stats', stats)
  }

  stats.today = Object.keys(stats.todayRecords).length
  stats.online = calculateOnline(stats)

  return stats
}
```

#### 4. 拉取环境变量

```bash
npx vercel env pull
```

#### 5. 构建并部署

```bash
pnpm build
npx vercel --prod
```

### 技术要点

#### 为什么选择 Upstash Redis？

| 特性 | 说明 |
|------|------|
| Serverless 友好 | 专为 Serverless 环境设计 |
| 全球分布式 | 低延迟、高可用 |
| 免费额度充足 | 100MB存储 + 100K请求/月 |
| Vercel 原生集成 | 一键连接、自动配置 |

#### 访客识别策略

采用多级访客识别，应对复杂网络环境：

| 优先级 | 方式 | 说明 |
|--------|------|------|
| 1 | visitorId | 前端生成唯一ID，最准确 |
| 2 | IP + User-Agent | 组合哈希 |
| 3 | IP | 兜底方案 |

---

## 问题五：构建失败（prerender 错误）

### 问题描述
执行 `pnpm build` 时，预渲染阶段失败，错误信息为 `categories.entries is not a function`。

### 发生时间
2026年6月

### 影响范围
- 项目构建流程
- Vercel 部署

### 严重程度
🔴 高 - 无法正常部署

### 问题根因

`server/api/stats.get.ts` 中假设 `post.categories` 一定是数组，但在某些情况下它可能是 `undefined` 或其他类型。

```typescript
// 错误代码
const categories = post.categories || []
for (const [index, categoryName] of categories.entries()) {  // ❌
  // ...
}
```

### 解决方案

**文件**: `server/api/stats.get.ts`

```typescript
// 修复前
const categories = post.categories || []
let currentLevel = stats.categories

for (const [index, categoryName] of categories.entries()) {
  // ...
}

// 修复后
const categories = post.categories || []
let currentLevel = stats.categories

// 确保 categories 是数组
if (Array.isArray(categories)) {
  for (const [index, categoryName] of categories.entries()) {
    if (typeof categoryName !== 'string')
      continue

    const category = findOrCreateCategory(categoryName, currentLevel)
    category.posts++

    if (index < categories.length - 1) {
      if (!category.children)
        category.children = []
      currentLevel = category.children
    }
  }
}
```

### 验证方法

```bash
pnpm build
# 应该看到：
# ✓ Prerendered 5 routes in xx seconds
# ✓ Generated public .output/public
```

---

## 问题六：环境变量配置不匹配

### 问题描述
Vercel 环境中的 Redis 连接失败，警告信息为 `Unable to find environment variable: UPSTASH_REDIS_REST_URL`。

### 发生时间
2026年6月

### 影响范围
- Redis 连接
- 数据持久化

### 严重程度
🟡 中等 - 本地构建成功但功能受限

### 问题根因

代码中使用了错误的环境变量名称：

```typescript
// 错误：使用了 @vercel/kv 的变量名
redis = Redis.fromEnv()
// @vercel/kv 需要: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

// 正确：应该使用 Vercel KV 自动配置的变量名
redis = new Redis({
  url: process.env.KV_REST_API_URL!,      // ✅ Vercel KV 使用 KV_ 前缀
  token: process.env.KV_REST_API_TOKEN!,
})
```

### 解决方案

已在上文"问题四"中包含修复代码，确保使用正确的环境变量：

```typescript
redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})
```

---

## 总结

### 问题统计

| 问题编号 | 问题类型 | 严重程度 | 状态 |
|---------|---------|---------|------|
| 问题一 | 图标显示异常 | 🟡 中等 | ✅ 已修复 |
| 问题二 | 统计数值异常 | 🔴 高 | ✅ 已修复 |
| 问题三 | 在线人数为0 | 🟡 中等 | ✅ 已修复 |
| 问题四 | 生产环境异常 | 🔴 高 | ✅ 已修复 |
| 问题五 | 构建失败 | 🔴 高 | ✅ 已修复 |
| 问题六 | 环境变量不匹配 | 🟡 中等 | ✅ 已修复 |

### 技术改进

#### 数据存储方案对比

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| 本地文件 | 简单 | 不持久化 | 本地开发 |
| Redis | 持久化、高性能 | 需要额外服务 | 生产环境 ✅ |
| 数据库 | 功能强大 | 配置复杂 | 大型应用 |

#### 架构改进

```
修复前：
┌─────────┐     ┌─────────┐     ┌─────────┐
│  前端   │────▶│  API    │────▶│  文件   │
└─────────┘     └─────────┘     └─────────┘
                                    ❌ 不持久化

修复后：
┌─────────┐     ┌─────────┐     ┌─────────┐
│  前端   │────▶│  API    │────▶│  Redis  │
└─────────┘     └─────────┘     └─────────┘
                                  ✅ 持久化
```

### 经验总结

1. **Serverless 环境特性**
   - 不要依赖本地文件系统存储
   - 使用专门的持久化服务（Redis、数据库）

2. **SSR 兼容性**
   - 始终检查浏览器 API 可用性
   - 使用 `typeof window !== 'undefined'` 检测

3. **数据一致性**
   - 确保统计口径统一
   - 避免重复计算
   - 添加边界检查

4. **环境变量**
   - 确认不同服务商的变量命名规则
   - 优先使用官方推荐的配置方式

### 参考资料

- [Vercel Storage 官方文档](https://vercel.com/docs/storage)
- [Upstash Redis 快速开始](https://upstash.com/docs/redis/overall/getstarted)
- [Nuxt 3 部署指南](https://nuxt.com/docs/getting-started/deployment)
- [Tabler Icons 图标库](https://tabler.io/icons)

---

*文档生成时间：2026年6月11日*
*最后更新：完成所有问题修复和部署验证*
