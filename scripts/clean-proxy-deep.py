#!/usr/bin/env python3
"""clean-proxy-deep.py — 清除 macOS 系统配置里残留的 VPN 接口代理(需 sudo)

背景: Surge 的"增强模式+系统代理"会把 127.0.0.1:6152/6153 写进
      preferences.plist 里每个 VPN 服务的 Proxies / VPN/Proxies 配置,
      退出时不清除,导致 sing-box/Tailscale 的 utun 接口继承死代理,
      浏览器全部失败(curl 正常)。
用法: sudo python3 ~/Dev/github-o/submgr/scripts/clean-proxy-deep.py
      (自动备份原 plist 到同目录 .bak-时间戳)
改完后重启 sing-box(SFM)或重启 Mac 使其生效。
"""
import plistlib
import shutil
import sys
import time

P = "/Library/Preferences/SystemConfiguration/preferences.plist"
ENABLE_KEYS = ("HTTPEnable", "HTTPSEnable", "SOCKSEnable", "FTPEnable",
               "GopherEnable", "RTSPEnable", "ProxyAutoConfigEnable",
               "ProxyAutoDiscoveryEnable")
REMOVE_KEYS = ("HTTPPort", "HTTPSPort", "SOCKSPort",
               "HTTPProxy", "HTTPSProxy", "SOCKSProxy",
               "FTPProxy", "GopherProxy", "RTSPProxy",
               "ProxyAutoConfigURLString", "ProxyAutoConfigJavaScript")

try:
    with open(P, "rb") as f:
        data = plistlib.load(f)
except PermissionError:
    sys.exit("权限不足: 请用 sudo 运行本脚本")

backup = P + ".bak-" + time.strftime("%Y%m%d-%H%M%S")
shutil.copy(P, backup)
print("已备份:", backup)

changed = []

def clean_proxies(svc, sid, layer_name, layer):
    if not isinstance(layer, dict) or not layer.get("HTTPEnable"):
        return
    for k in ENABLE_KEYS:
        layer[k] = 0
    for k in REMOVE_KEYS:
        layer.pop(k, None)
    changed.append(f"{svc.get('UserDefinedName', sid)}/{layer_name}")

ns = data.get("NetworkServices", {})
for sid, svc in ns.items():
    clean_proxies(svc, sid, "Proxies", svc.get("Proxies"))
    vpn = svc.get("VPN")
    if isinstance(vpn, dict):
        clean_proxies(svc, sid, "VPN/Proxies", vpn.get("Proxies"))

if not changed:
    print("没有发现残留代理配置(已干净)")
else:
    with open(P, "wb") as f:
        plistlib.dump(data, f)
    print("已清理:", *changed, sep="\n  ")
    print("\n完成。请重启 sing-box(SFM) 或重启 Mac 使配置生效。")
