---
title: 折腾 CTF_Agent：用本地大模型自动打 CTF
description: 从零部署 CTF_Agent，踩了一路 Docker 和 WSL 的坑，最终用 Ollama 本地跑起来，让 AI 帮我自动解 CTF 题。
date: 2026-08-17
updated: 2026-08-17
categories:
  - 技术
tags:
  - CTF, Docker, Ollama, AI, 部署
recommend: 1
type: tech
---
# 折腾 CTF_Agent：用本地大模型自动打 CTF

最近在 GitHub 上刷到一个叫 CTF_Agent 的项目，思路挺有意思——把 CTF 题目丢给它，AI 会自动在隔离的 Docker 容器里解题，最多自动跑 6 轮。正好本地有 Ollama 跑着 deepseek-r1:8b，就想试试能不能接上去。结果部署过程比预想的坎坷不少，主要是 Docker 和 WSL2 的坑，记录一下。

## 项目是干啥的

简单说就是：你在网页上提交一道 CTF 题（web、pwn、crypto、reverse、misc 都行），可选上传附件，系统会自动起一个 Docker 容器，容器里跑着 OpenCode（一个 AI 编程助手），它会调用你配置的大模型来分析题目、写 exploit、拿 flag。整个过程全自动，你只需要看日志等结果。

架构大概是这样：

```
浏览器提交题目 → Go 后端排队 → 创建 Docker 容器 → 容器内 OpenCode 调用 AI 模型 → 解题 → 返回 flag
```

## 前期准备

需要的依赖不算多，但每个都可能卡你：

- **Go 1.25+**：跑后端服务
- **Docker Desktop**：跑解题容器
- **Ollama**：本地大模型推理（我用的 deepseek-r1:8b）

Go 和 Ollama 我之前就装好了，唯一卡住的是 Docker Desktop——它依赖 WSL2，而我的 WSL2 坏了。

## Docker Desktop 启动不了？WSL2 的锅

Docker Desktop 装好之后死活起不来，左下角一直是橙色。看了一眼提示，是 WSL2 的问题。

### 第一次尝试：直接装 Ubuntu

在管理员 PowerShell 里跑 `wsl --install -d Ubuntu`，结果报了 `0x801901ad`，一查是网络问题——WSL 组件要从 GitHub 下载，国内网络访问不了。

### 第二次尝试：手动开 Windows 功能 + 更新内核

这条路比较靠谱，分几步走：

```powershell
# 1. 先手动启用 WSL 和虚拟机平台这两个 Windows 功能
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
```

然后重启电脑。

重启之后，关键一步——更新 WSL2 内核：

```powershell
wsl --update
```

这步也会因为网络问题卡住或者超时。如果卡了，可以试 `wsl --update --web-download`，走网络下载而不是 Microsoft Store。

更新完之后设一下默认版本：

```powershell
wsl --set-default-version 2
```

再启动 Docker Desktop，等左下角变绿，就说明引擎起来了。

## 构建三个 Docker 镜像

项目需要构建三个镜像，有依赖顺序：base → opencode → misc。

```bash
docker build --pull -t ctf-agent-base:latest docker/agent-base
docker build -t ctf-agent-opencode:latest docker/opencode-agent
docker build -t ctf-agent-misc:latest docker/misc-agent
```

### 又是网络问题：Docker Hub 拉不动

第一条命令就卡住了，`docker build --pull` 试图从 Docker Hub 拉取 `python:3.12.13-slim-trixie`，直接超时。国内拉 Docker Hub 的老毛病了。

本来想配 Docker 镜像加速器，改了 `~/.docker/daemon.json` 加了 `registry-mirrors`，但 Docker Desktop 似乎不太认这个文件，折腾半天没生效。

最后换了个思路——直接改 Dockerfile，把 `FROM` 后面的镜像地址加上国内镜像源前缀：

```dockerfile
# 原来
FROM python:3.12.13-slim-trixie@sha256:xxxxx

# 改成
FROM docker.1ms.run/library/python:3.12.13-slim-trixie
```

opencode-agent 的 Dockerfile 也一样，把 `node:22-bookworm-slim` 改成 `docker.1ms.run/library/node:22-bookworm-slim`。

改完之后构建就很顺利了，三个镜像依次构建完成：

| 镜像 | 大小 |
| --- | --- |
| ctf-agent-base | 659MB |
| ctf-agent-opencode | 1.03GB |
| ctf-agent-misc | 1.42GB |

misc 那个比较大，因为装了 binwalk、ffmpeg、tshark 这些取证工具，构建时间最长，耐心等就行。

## 配置 Ollama 作为 AI 后端

项目支持 OpenAI 兼容格式的 API，Ollama 刚好提供了这个接口，所以可以直接对接。

我本地已经有 `deepseek-r1:8b` 模型了，Ollama 默认监听 `11434` 端口，OpenAI 兼容 API 地址是 `http://localhost:11434/v1`。

但有个坑：CTF_Agent 的解题容器跑在 Docker 里，容器内的 `localhost` 指向的是容器自己，不是宿主机。所以配置里不能写 `localhost`，要写 `host.docker.internal`——这是 Docker Desktop 提供的特殊域名，会自动解析到宿主机。

配置文件 `opencode.env` 内容如下：

```env
OPENCODE_PROVIDER_FORMAT=openai-compatible

OPENCODE_OPENAI_PROVIDER_ID=ctf
OPENCODE_OPENAI_PROVIDER_NAME=Local Ollama
OPENCODE_OPENAI_PROVIDER_NPM=@ai-sdk/openai-compatible
OPENCODE_OPENAI_BASE_URL=http://host.docker.internal:11434/v1
OPENCODE_OPENAI_API_KEY=ollama
OPENCODE_OPENAI_MODEL=deepseek-r1:8b

CTF_AGENT_DOCKER_IMAGE=ctf-agent-opencode:latest
CTF_AGENT_IMAGE_MISC=ctf-agent-misc:latest

CTF_AGENT_TASK_TIMEOUT=45m
CTF_AGENT_AUTO_CONTINUE_ROUNDS=6
```

API Key 随便填，Ollama 本地不校验。

## Go 代理也得换

最后启动服务的时候，`go run ./cmd/go-server` 又卡住了——Go 在下载依赖，默认走的 proxy.golang.org，国内访问不了。

设一下国内代理就行：

```bash
go env -w GOPROXY=https://goproxy.cn,direct
go env -w GOSUMDB=off
```

然后再跑 `go run ./cmd/go-server`，依赖很快就下完了，服务启动在 `127.0.0.1:8000`。

## 跑起来看看

浏览器打开 `http://127.0.0.1:8000`，界面很简洁，提交题目、选题型、传附件，然后等容器跑就行。

实际试了几道 misc 题，deepseek-r1:8b 的效果还行，简单的编码解码、文件分析能跑出来。复杂一点的 pwn 和 reverse 就有点吃力了，毕竟 8B 参数的模型能力有限。如果想要更好的效果，可以换个更大的模型，或者直接接 DeepSeek 的云端 API。

## 踩坑总结

整个部署过程踩了不少坑，大部分都是网络相关的：

| 问题 | 原因 | 解决方案 |
| --- | --- | --- |
| WSL 安装报 0x801901ad | GitHub 下载失败 | 手动开 Windows 功能 + `wsl --update` |
| Docker build 拉镜像超时 | Docker Hub 国内访问不了 | 改 Dockerfile 用 `docker.1ms.run` 前缀 |
| Go 依赖下载卡住 | proxy.golang.org 被墙 | `go env -w GOPROXY=https://goproxy.cn,direct` |
| 容器内连不上 Ollama | localhost 指向容器自身 | 改用 `host.docker.internal` |

其实核心就一句话：国内搞开发，什么都得换源。Docker 换镜像源，Go 换代理，连 WSL 更新都得想办法绕网络。

## 最后

项目地址：https://github.com/dlongx/CTF_Agent

整体思路挺有意思的，把 AI 编程助手和 CTF 解题结合起来，自动化程度很高。本地模型的好处是不花钱、不联网，坏处是推理速度慢、效果有限。如果只是拿来练手或者跑简单的 misc/crypto 题，够用了。想要打比赛的话，还是建议接个强一点的云端模型。
