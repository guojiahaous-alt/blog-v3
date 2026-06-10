---
title: 博客访问量统计功能Vercel部署实战笔记
date: 2026-06-11
description: 记录将博客访问量统计功能从本地迁移到Vercel生产环境的过程，详细说明遇到的问题、根因分析及解决方案
tags:
  - Vercel
  - 部署
  - Redis
  - 访问量统计
  - 问题排查
categories: 技术笔记
recommend: 1
---
# 博客访问量统计功能Vercel部署实战笔记

## 前言

在本地开发环境中，博客的访问量统计功能运行良好。但当我将其部署到Vercel平台后，发现统计数据始终为0，无法正常工作。本文详细记录了整个排查过程和最终解决方案，供有类似需求的开发者参考。

## 问题现象


| 环境           | 表现                                  |
| -------------- | ------------------------------------- |
| 本地开发       | ✅ 统计功能正常，可以正确记录访问     |
| Vercel生产环境 | ❌ 访问量始终显示为0或1，无法正常统计 |

## 问题分析

### 为什么本地正常，生产环境异常？

本地和生产环境最大的区别在于：


| 对比项       | 本地环境           | Vercel生产环境                 |
| ------------ | ------------------ | ------------------------------ |
| **数据存储** | 本地文件（持久化） | Serverless函数（临时文件系统） |
| **进程状态** | 持续运行           | 按需启动/关闭                  |
| **IP来源**   | 直接获取访客IP     | 通过CDN/代理获取（IP相同）     |

### 核心问题定位

#### 问题1：数据文件不持久化

Vercel的Serverless Functions使用临时文件系统，`data/`文件夹中的数据不会在请求之间保留。每次函数调用都是全新的实例，上一次保存的数据会丢失。

```
本地环境：请求1保存数据 → 请求2读取数据 → 数据存在 ✅
Vercel环境：请求1保存数据 → 请求2读取数据 → 文件不存在 ❌
```

#### 问题2：所有请求来自同一IP

当流量经过CDN或负载均衡器时，所有请求的来源IP都变成了CDN服务器的IP。这意味着：

- 所有访客都被识别为同一个IP
- 系统只记录了一个"访客"

#### 问题3：函数内存不共享

每次HTTP请求可能由不同的Serverless实例处理：

- 实例A记录了一次访问
- 实例B处理下一次请求时，内存中没有A的数据
- 数据统计变得随机且不一致

## 解决方案

### 方案选型


| 方案                      | 优点                   | 缺点                     | 推荐指数   |
| ------------------------- | ---------------------- | ------------------------ | ---------- |
| Vercel KV (Upstash Redis) | 官方推荐，免费额度足够 | 需要注册外部服务         | ⭐⭐⭐⭐⭐ |
| Vercel Postgres           | 功能强大               | 配置复杂，免费额度有限   | ⭐⭐⭐     |
| 第三方API                 | 实现简单               | 依赖外部服务，可能有延迟 | ⭐⭐⭐     |

最终选择：**Upstash Redis**（Vercel KV的底层服务）

### 具体实施步骤

#### 步骤1：在Vercel中创建Redis数据库

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 进入 **Storage** 页面
3. 点击 **Create Database**
4. 选择 **Upstash for Redis**
5. 配置数据库信息：
   - **Name**: `blog-visitor-stats`
   - **Region**: 选择离用户最近的区域（如 Asia Pacific）
   - **Plan**: 免费版（Free Tier）即可
6. 点击 **Create** 完成创建

#### 步骤2：连接数据库到项目

创建完成后：

1. 点击 **Connect to Project**
2. 选择你的博客项目
3. 勾选需要的运行环境：
   - ✅ Production（生产环境）
   - ✅ Preview（预览环境）
   - ✅ Development（本地开发）
4. 点击 **Connect** 完成连接

#### 步骤3：更新代码使用Redis

首先安装依赖：

```bash
pnpm add @upstash/redis
```

然后修改 `server/utils/visitors.ts` 文件，使用Redis替代本地文件存储：

```typescript
import { Redis } from '@upstash/redis'

export interface VisitorStats {
  total: number       // 总访问量
  today: number       // 今日访问量
  online: number      // 当前在线人数
  todayRecords: Record<string, { count: number; lastVisit: number }>  // 今日访客记录
  lastResetTime: number  // 上次重置时间（用于判断是否跨天）
}

const ONLINE_TIMEOUT = 300000  // 在线超时时间：5分钟

// 默认统计数据
const defaultStats: VisitorStats = {
  total: 0,
  today: 0,
  online: 0,
  todayRecords: {},
  lastResetTime: Date.now(),
}

// 创建Redis客户端（自动从环境变量读取配置）
const redis = Redis.fromEnv()

// 判断是否跨天（用于重置今日统计）
function isNewDay(lastReset: number): boolean {
  const lastDate = new Date(lastReset)
  const now = new Date()
  return (
    lastDate.getDate() !== now.getDate() ||
    lastDate.getMonth() !== now.getMonth() ||
    lastDate.getFullYear() !== now.getFullYear()
  )
}

// 计算当前在线人数（5分钟内有活动的访客）
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

// 记录访客访问
export async function recordVisit(ip: string, visitorId?: string): Promise<VisitorStats> {
  // 从Redis获取当前统计数据
  let stats = (await redis.get<VisitorStats>('visitor-stats')) || defaultStats
  
  // 如果跨天了，重置今日统计
  if (isNewDay(stats.lastResetTime)) {
    stats = {
      total: stats.total,  // 总访问量保留
      today: 0,
      online: 0,
      todayRecords: {},
      lastResetTime: Date.now(),
    }
  }
  
  const now = Date.now()
  // 使用访客ID（优先）或IP地址作为唯一标识
  const recordKey = visitorId ? `vid:${visitorId}` : `ip:${ip}`
  
  // 判断是否是新访客
  if (!stats.todayRecords[recordKey]) {
    stats.total++  // 总访问量+1
    stats.todayRecords[recordKey] = { count: 1, lastVisit: now }
  } else {
    // 老访客只更新时间戳
    stats.todayRecords[recordKey].lastVisit = now
  }
  
  // 重新计算今日访问量和在线人数
  stats.today = Object.keys(stats.todayRecords).length
  stats.online = calculateOnline(stats)
  
  // 保存到Redis
  await redis.set('visitor-stats', stats)
  return stats
}

// 获取统计数据
export async function getStats(): Promise<VisitorStats> {
  let stats = (await redis.get<VisitorStats>('visitor-stats')) || defaultStats
  
  // 跨天重置
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

#### 步骤4：部署到Vercel

```bash
# 1. 安装依赖（确保@upstash/redis已添加）
pnpm install

# 2. 构建项目
pnpm build

# 3. 部署到生产环境
npx vercel --prod
```

## 遇到的问题及解决方案

### 问题1：pnpm全局命令找不到

**错误信息：**

```
vercel: 无法将"vercel"项识别为cmdlet、函数...
```

**原因：** pnpm的全局命令目录没有添加到系统PATH环境变量

**解决方法：** 使用 `npx` 命令临时调用vercel

```bash
# 不需要全局安装，直接使用npx
npx vercel --prod
```

### 问题2：vercel.json配置错误

**错误信息：**

```
Error: Function Runtimes must have a valid version
```

**原因：** 手动创建的vercel.json文件中配置了不正确的函数运行时

**解决方法：** 删除vercel.json，让Vercel自动检测项目类型

```bash
# 删除错误的配置文件
Remove-Item "项目路径\vercel.json"

# 重新部署
npx vercel --prod
```

### 问题3：本地环境变量缺失

**现象：** 本地开发时连接不到Redis

**解决方法：** 拉取Vercel的环境变量到本地

```bash
# Vercel会自动创建.env.local文件
npx vercel env pull
```

### 问题4：pnpm add -g 报错

**错误信息：**

```
The configured global bin directory is not in PATH
```

**解决方法：** 直接使用npx，不需要全局安装

```bash
npx vercel --prod
```

## 部署后验证

### 验证步骤

1. **访问网站首页**

   - 打开部署后的网站URL
   - 打开浏览器开发者工具（F12）
   - 切换到Network（网络）标签
2. **检查API请求**

   - 刷新页面
   - 找到 `/api/visitors` 请求
   - 查看Response（响应）内容
3. **预期结果**

   ```json
   {
     "total": 105,
     "today": 6,
     "online": 1,
     "todayRecords": {...}
   }
   ```

### 在Upstash中查看数据

1. 登录 [Upstash Console](https://console.upstash.com)
2. 选择你的数据库
3. 点击 **Redis Browser**
4. 可以看到存储的键值对

## 技术要点总结

### 为什么选择Upstash Redis？

1. **Serverless友好**

   - 专为Serverless环境设计
   - 按请求计费，不用不花钱
   - 全球分布式，低延迟
2. **Vercel原生集成**

   - 一键创建和连接
   - 自动配置环境变量
   - Dashboard直接查看数据
3. **免费额度充足**

   - 100MB存储空间
   - 100K次请求/月
   - 个人博客完全够用

### 访客识别的三种方式

为了应对复杂的网络环境，系统采用多级访客识别策略：


| 优先级 | 标识方式        | 说明                             |
| ------ | --------------- | -------------------------------- |
| 1      | visitorId       | 前端生成的唯一访客ID，最准确     |
| 2      | IP + User-Agent | 组合哈希，识别同一IP的不同浏览器 |
| 3      | IP              | 仅IP，兜底方案                   |

### 数据统计口径


| 指标         | 定义               | 计算方式               |
| ------------ | ------------------ | ---------------------- |
| **总访问量** | 网站历史总访问次数 | 所有新访客的累计       |
| **今日访问** | 当天唯一访客数     | todayRecords对象的长度 |
| **当前在线** | 5分钟内活跃的访客  | 过滤超时记录后的人数   |

## 注意事项

1. **环境变量保密**

   - 不要将 `.env.local` 提交到Git
   - Vercel会自动注入生产环境变量
2. **免费额度监控**

   - 定期查看Upstash用量
   - 避免超出免费限额
3. **数据安全**

   - Redis中的数据默认不可删除
   - 定期备份重要数据

## 参考资料

- [Vercel Storage 官方文档](https://vercel.com/docs/storage)
- [Upstash Redis 快速开始](https://upstash.com/docs/redis/overall/getstarted)
- [Nuxt 部署指南](https://nuxt.com/docs/getting-started/deployment)

---

*本文档记录于2026年6月11日，后续如有更新会在博客中说明。*
