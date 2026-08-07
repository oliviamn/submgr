# sing-box (SFM) 与 Surge 代理冲突排查手册

> 适用环境: macOS + SFM (sing-box for Mac, TUN 模式) + Surge 共存
> 最后验证: 2026-08-05

## 一、症状

- 启动 sing-box (SFM) 后,**浏览器**(Chrome / Safari)打不开 YouTube / Twitter 等,
  报"无法连接服务器" / `ERR_PROXY_CONNECTION_FAILED`
- 但 **命令行 `curl` 一切正常**(HTTP 200)
- **sing-box 日志里看不到浏览器的任何流量**(只有 curl 的)
- 关闭 sing-box、只用 Surge(或路由器代理)时,浏览器正常

## 二、根因

**Surge 退出后残留了"系统代理"配置,指向死端口 `127.0.0.1:6152/6153`。**

浏览器读取系统代理 → 连死端口 → 失败;`curl` 不读系统代理 → 直连 TUN → 正常。
浏览器流量从未到达 sing-box,所以日志里没有浏览器记录。

残留分**三层**,这也是"清了又复发"的原因:

| 层 | 位置 | 谁处理 |
|---|---|---|
| ① 接口层 | 各网络服务(NetworkServices)的 `Proxies` | `clean-proxy.sh` (`networksetup`) |
| ② 持久化层 | `preferences.plist` 的 `VPN/Proxies` 子层 | `clean-proxy-deep.py` (需 sudo) |
| ③ NE 配置层 | `com.apple.networkextension.plist` 的 `NEProxySettings` | **不要直接改**(macOS 保护,且危险);用 SFM 界面 "System HTTP Proxy" 开关 |

> ⚠️ 曾尝试用脚本直接改第 ③ 层,被 macOS 权限保护拒绝(sudo 也不行),
> 且该操作有风险,已放弃并删除对应脚本。正确做法是走 SFM 自己的开关。

### 常见误导

- 6152/6153 是 **Surge 的默认端口**,容易被误认为是 Surge 在运行;
  实际可能是 SFM 自己的 NE 配置里残留了这个值(早期配置或导入时写入)。
- UDP / IPv6 / fakeip / 节点质量**都不是**浏览器打不开的根因。
  (NaiveProxy 不支持 UDP 只影响 YouTube 视频播放,见下文"附加问题")

## 三、修复 SOP(每次 Surge 退出后、启动 sing-box 前)

```bash
# 1. 清接口层代理残留
bash ~/Dev/github-o/submgr/scripts/clean-proxy.sh

# 2. 清持久化层残留(需 sudo,会提示密码)
sudo python3 ~/Dev/github-o/submgr/scripts/clean-proxy-deep.py

# 3. 重启 sing-box(SFM 里停止再启动)

# 4. 验证
scutil --proxy        # 应全为 0
```

验证 `scutil --proxy` 输出里 `HTTPEnable / HTTPSEnable / SOCKSEnable / ProxyAutoConfigEnable` 全部为 0 即成功。

## 四、脚本说明

| 脚本 | 作用层 | sudo | 适用场景 |
|---|---|---|---|
| `scripts/clean-proxy.sh` | ① 接口层 | 否 | 日常快速清理 |
| `scripts/clean-proxy-deep.py` | ② 持久化层 | 是 | Surge 残留导致"清了又复发"时兜底 |
| `scripts/clean-ne-proxy.py` | ~~③ NE 层~~ | — | **已删除**(危险且系统保护拒绝写入) |

日常用 `clean-proxy.sh` 即可;Surge 捣乱后两层都跑:

```bash
bash ~/Dev/github-o/submgr/scripts/clean-proxy.sh && sudo python3 ~/Dev/github-o/submgr/scripts/clean-proxy-deep.py
```

## 五、附加问题: YouTube 视频 `video unavailable`(页面正常)

**原因**: 浏览器用 HTTP/3 (QUIC, UDP 443) 播放视频,而 NaiveProxy 节点**只支持 TCP**,UDP 被丢弃 → 视频流失败;页面/评论走 TCP 所以正常。

**解决**:

1. **加 UDP reject 规则**(让浏览器 QUIC 快速失败并回退 TCP):
   使用 `temp/config_1-fixed.json`(在 `route.rules` 的 `hijack-dns` 之后加了
   `{"action": "reject", "network": "udp"}`)。
   SFM → Profiles → `+` → 本地文件 → 选择该文件 → 切换 → 启动。
   (注意: 这是测试配置,基于当时的 company profile 生成)
2. **换支持 UDP 的节点**: 使用 home profile 中的 Tuic / Hysteria2 节点,QUIC 原生支持,视频最流畅。
3. **临时验证**: 用 `--disable-quic` 启动的 Chrome 可看视频(TCP 路径)。

## 六、防复发 & 使用原则

- Surge 和 sing-box 的"系统代理"本质**互斥**,不要同时开。
- 主力 Surge 时: 开 Surge,别开 sing-box。
- 测 sing-box 时: 完全退出 Surge → 跑上面的 SOP → 启动 sing-box。
- 若 SFM 界面里有 "System HTTP Proxy" 开关,确保它是**关闭**状态
  (否则 SFM 会把 6152 写进自己的 NE 配置)。

## 七、常用诊断命令

```bash
scutil --proxy                          # 当前生效的系统代理(排查首选)
scutil --dns                            # DNS 是否指向 172.19.0.2(sing-box TUN)
ifconfig | grep 172.19.0.1              # sing-box TUN 是否存在
lsof -nP -iTCP:6152 -sTCP:LISTEN        # 6152 是否有进程监听(空=死端口)
networksetup -listallnetworkservices    # 列出所有网络服务
systemextensionsctl list                # NE 系统扩展状态(SFM / Surge)
```
