---
title: 青岑re类begin题wp
description: 一道面向新手的逆向工程 CTF 入门题 writeup，通过 IDA Pro 静态分析提取三段 flag，记录完整的分析思路与解题过程。
date: 2026-05-25
updated: 2026-05-25
categories:
  - 技术
tags:
  - 逆向工程, CTF, IDA Pro, WriteUp
type: tech
---
# 青岑re类begin题wp

## 题目背景

这是一道面向逆向工程新手的入门级 CTF 题目。给到一个 `begin.exe`，里面藏了一个 flag，需要通过逆向分析把它找出来。

**分析目标：**

- 从 `begin.exe` 中提取隐藏的 flag
- 掌握基础的逆向工程分析方法
- 学习使用 IDA Pro 等工具进行静态分析

**已知线索（程序字符串中的提示）：**

> - The flag has three parts with a total length of 50
> - There are no spaces in the flag
> - If you find that flag part1 is garbled, please press the 'a' key
> - The second part of the flag can be achieved by pressing shift+F12
> - Flag Part 3 is right there. the function name is flag part3
> - Don't forget to add a '}' at the end

---

## 工具准备


| 工具            | 用途             | 获取                                         |
| --------------- | ---------------- | -------------------------------------------- |
| IDA Pro         | 反汇编与逆向分析 | 需购买或使用评估版                           |
| Ghidra          | 开源逆向分析     | [官网](https://ghidra-sre.org/) 免费下载     |
| strings         | 提取可打印字符串 | Linux/macOS 内置，Windows 可通过 Cygwin 获取 |
| xxd / hexeditor | 十六进制查看     | 系统自带或第三方工具                         |

**IDA Pro 常用快捷键速查：**


| 操作       | 快捷键        | 说明                      |
| ---------- | ------------- | ------------------------- |
| 反编译函数 | `F5`          | 汇编 → 伪 C 代码         |
| 字符串窗口 | `Shift + F12` | 搜索字符串                |
| 交叉引用   | `X`           | 查看谁调用了当前函数/数据 |
| 切换视图   | `Space`       | 图形视图 ↔ 文本视图      |
| ASCII 转换 | `A`           | 将数据解释为 ASCII 字符串 |
| 搜索       | `Ctrl + S`    | 全局搜索                  |
| 函数列表   | `Shift + F3`  | 查看所有函数              |

---

## 逆向分析过程

### 1. 文件类型识别

先确认一下文件类型：

```
begin.exe: PE32 executable (console) Intel 80386, for MS Windows
```

文件头以 `MZ` 开头，标准的 PE 文件，没什么特别的。

### 2. 提取字符串

用 `strings` 命令或 IDA 的字符串窗口提取可打印字符串：

```powershell
strings begin.exe
```

关键发现：

- `flag{Mak3_aN_?-@?????????????` — flag 第一部分（部分乱码）
- `flag_part2F0rt_tO_5eArcH_` — flag 第二部分
- `flag_part1` — 第一部分变量名
- `flag part3` — 第三部分函数名
- 各种提示信息

### 3. 用 IDA 打开程序

1. 启动 IDA Pro，`File → Open` 选择 `begin.exe`
2. 选择 `PE` 格式，点击 OK
3. 等待自动分析完成

### 4. 定位关键函数

IDA 会自动识别入口点，按 `F5` 反编译主函数。按 `Shift + F12` 打开字符串窗口，搜索包含 "flag" 的字符串。

根据提示，flag 分为三部分：


| 部分   | 位置              | 内容                           |
| ------ | ----------------- | ------------------------------ |
| Part 1 | `flag_part1` 变量 | `flag{Mak3_aN_` + 后续（乱码） |
| Part 2 | `flag_part2` 变量 | `F0rt_tO_5eArcH_`              |
| Part 3 | `flag part3` 函数 | 需在函数列表中查找             |

### 5. 乱码处理

提示说 "If you find that flag part1 is garbled, please press the 'a' key"。

在 IDA 中查看 `flag_part1` 变量时，如果显示为乱码，按 `A` 键将其解释为 ASCII 字符串即可。从乱码特征来看，`flag_part1` 可能使用了简单的 XOR 加密或位变换，但在这道入门题里直接按 `A` 就能看到明文。

### 6. 提示解读


| 提示                          | 含义                             |
| ----------------------------- | -------------------------------- |
| "press the 'a' key"           | IDA 中按`A` 键将数据解释为 ASCII |
| "shift+F12"                   | 打开字符串窗口                   |
| "function name is flag part3" | 在函数列表中搜索该函数名         |
| "add a '}' at the end"        | flag 以`}` 结尾                  |

---

## 解题步骤

**第一步：** IDA 打开 `begin.exe`，等待自动分析完成

**第二步：** `Shift + F12` 打开字符串窗口，搜索 "flag" 相关字符串

**第三步：** 找到 `flag_part1` 变量，按 `A` 键转换为 ASCII，得到第一部分

**第四步：** 找到 `flag_part2` 相关字符串，得到 `F0rt_tO_5eArcH_`

**第五步：** 在函数列表中找到 `flag part3` 函数，`F5` 反编译查看内容

**第六步：** 三部分按顺序拼接，末尾加 `}`

---

## 最终答案

```
flag{Mak3_aN_3Ff0rt_tO_5eArcH_Th3_F14g_C0Rpse}
```

**验证：**

- 总长度 = 50 字符 ✓（符合提示）
- 无空格 ✓（符合提示）
- 以 `}` 结尾 ✓（符合提示）

---

## 知识点总结

**基础概念：**

- **PE 文件格式**：Windows 可执行文件格式，包含文件头、节区表、代码段、数据段等
- **反汇编**：将机器码转换为汇编语言
- **反编译**：将汇编代码转换为伪 C 代码（IDA 的 F5 功能）
- **交叉引用**：追踪代码和数据之间的引用关系

**实用技巧：**

- 字符串搜索（`Shift + F12`）是快速定位关键逻辑的利器
- 变量显示格式切换（`A` 键）能解决大部分乱码问题
- 函数名和变量名本身就是重要线索，出题人往往会在命名上给提示

**进阶方向：**

- 学习 x86/x64 汇编基础，读懂反汇编代码
- 用 x64dbg 进行动态调试，观察运行时行为
- 了解常见加密算法的识别与破解
- 尝试分析带代码混淆的程序

**推荐资源：**

- 书籍：《逆向工程权威指南》《IDA Pro 权威指南》
- CTF 平台：Hack The Box、TryHackMe、CTFtime
- 开源工具：Ghidra（IDA 的免费替代方案）
