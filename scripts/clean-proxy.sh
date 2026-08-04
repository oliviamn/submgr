#!/bin/bash
# clean-proxy.sh — 清除 macOS 系统代理残留
# 用途: Surge / OpenSurge / Shadowrocket 等代理软件退出后,
#       系统代理可能残留指向死端口(如 127.0.0.1:6152/6153),
#       导致浏览器"无法连接服务器"而 curl 正常。
# 用法: bash ~/Dev/github-o/submgr/scripts/clean-proxy.sh

echo "清理前:"
scutil --proxy | grep -E "Enable|Proxy|Port" | sed 's/^/  /'

for svc in $(networksetup -listallnetworkservices 2>/dev/null | tail -n +2); do
  svc="${svc#\* }"
  [ -z "$svc" ] && continue
  networksetup -setwebproxystate "$svc" off >/dev/null 2>&1
  networksetup -setsecurewebproxystate "$svc" off >/dev/null 2>&1
  networksetup -setsocksfirewallproxystate "$svc" off >/dev/null 2>&1
  networksetup -setautoproxystate "$svc" off >/dev/null 2>&1
done

echo "清理后:"
scutil --proxy | grep -E "Enable" | sed 's/^/  /'
echo "  (全部应为 0 = 干净;然后重启浏览器测试)"
