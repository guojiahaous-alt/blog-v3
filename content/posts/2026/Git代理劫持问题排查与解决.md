---
title: Git 被系统代理强制劫持？一次排查与解决的全记录
description: 明明用的是 SSH 地址，Git 却偷偷走 HTTPS？排查发现是系统代理的 URL 重写规则在作祟，记录一下完整的解决过程。
date: 2026-05-24
updated: 2026-05-24
categories:
  - 技术
tags:
  - Git, 代理, SSH, 排障
image: https://img.guoyubo.cn/img/Image-11-21-33.png
type: tech
recommend: 1
---
# Git 被系统代理强制劫持？一次排查与解决的全记录

最近在 clone 仓库的时候遇到了一个很诡异的问题——明明我用的是 SSH 地址，Git 却非要走 HTTPS，搞得认证一直失败。折腾了一阵子才搞明白，原来是系统代理在背后搞鬼。把排查过程记录下来，万一有人踩到同样的坑可以参考。

## 先排除掉那些"不是问题"的方向

刚开始遇到的时候，我下意识地怀疑了几个常见原因：

- 是不是仓库本身有问题？换了个仓库试，一样。
- 是不是 GitHub 挂了？浏览器访问一切正常。
- 是不是 SSH 密钥出了问题？`ssh -T git@github.com` 测试连接完全没问题。

这几个方向都排除了之后，我才注意到一个关键细节：我输入的明明是 `git@github.com:...`，但 Git 实际请求的却变成了 `https://github.com`。这就不对了——谁在偷偷改我的 URL？

## 真凶：Git 配置里的 URL 重写规则

答案藏在 Git 的全局配置里。某些代理工具（比如 Clash、V2Ray 之类的）在开启系统代理的时候，会自动往 Git 配置里注入一条 URL 重写规则，把所有 SSH 协议的请求强制转成 HTTPS。这样代理才能接管流量。

## 动手解决

### 第一步：看看 Git 里到底藏了什么

```bash
git config --list
```

在输出里仔细找找，大概率会看到类似这样的配置：

- `url.https://github.com/.insteadof=git@github.com:`
- `url.https://.insteadof=git@`

这就是罪魁祸首——`insteadOf` 的意思就是"把后面的地址替换成前面的"，所以 SSH 地址才会被偷偷换成 HTTPS。

### 第二步：干掉 URL 重写规则

找到是哪条规则在作祟，直接删掉就好：

```bash
git config --global --unset url.https://github.com/.insteadof
```

如果你的情况是更宽泛的 `url.https://.insteadof=git@`，那就对应删那条：

```bash
git config --global --unset url.https://.insteadof
```

### 第三步：顺便清理代理配置

既然都打开全局配置了，顺手把代理相关的设置也清一下：

```bash
git config --global --unset http.proxy
git config --global --unset https.proxy
```

### 第四步：验证一下

再试一次 clone：

```bash
git clone git@github.com:guojiahaous-alt/blog-v3.git
```

这次应该就能正常走 SSH 了，速度也会快不少。

## 写在最后

这个问题其实不难，但第一次遇到的时候确实容易走弯路——毕竟直觉上很难想到 Git 会自己改 URL。以后如果再碰到"SSH 地址却走 HTTPS"的怪事，第一时间去查 `git config --list` 里的 `insteadOf` 就对了。
