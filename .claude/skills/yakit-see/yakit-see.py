#!/usr/bin/env python3
"""
yakit-see.py — 一键查看当前 Yakit(Electron/Sentinel) 页面
依赖：Yakit 以 dev:full-enterprise-no-license:debug 启动（CDP 端口 9222）
作用：连到主渲染页，打印 当前URL/标题/激活域/可见标签/页面正文摘要，并截图到 /tmp/yakit-cdp.png
用法：
  python3 ~/pw-toolkit/yakit-see.py            # 摘要 + 截图
  python3 ~/pw-toolkit/yakit-see.py --full     # 打印完整正文(不截断)
  python3 ~/pw-toolkit/yakit-see.py --dom SEL  # 额外 dump 选择器 SEL 的 outerHTML(前 2000 字符)
"""
import sys, os, json, urllib.request, websocket, base64, time, argparse

# Windows 控制台默认 GBK，强制 UTF-8 避免中文乱码
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

CDP = "http://127.0.0.1:9222"
# 截图写到脚本同目录（跨平台，Windows 无 /tmp）
SHOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "yakit-cdp.png")


def fail(msg):
    print("⚠️", msg)
    sys.exit(1)


def get_page_target():
    try:
        targets = json.load(urllib.request.urlopen(f"{CDP}/json", timeout=5))
    except Exception as e:
        fail(f"连不上 CDP({CDP})——Yakit 是否用 :debug 命令启动？({e})")
    pages = [t for t in targets if t.get("type") == "page" and "3000" in t.get("url", "")]
    if not pages:
        fail("没找到 :3000 主页面 target。")
    # 多个时挑带 Sentinel 标题的；否则取第一个
    for t in pages:
        if "Sentinel" in t.get("title", ""):
            return t
    return pages[0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--full", action="store_true")
    ap.add_argument("--dom", default=None)
    args = ap.parse_args()

    page = get_page_target()
    ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=20)
    mid = [0]

    def call(method, params=None):
        mid[0] += 1
        ws.send(json.dumps({"id": mid[0], "method": method, "params": params or {}}))
        while True:
            msg = json.loads(ws.recv())
            if msg.get("id") == mid[0]:
                return msg

    call("Page.enable")
    call("Runtime.enable")

    expr = """(function(){
      var at=document.querySelector('[class*=active]');
      var tabs=Array.from(document.querySelectorAll('[role=tab], .ant-tabs-tab, [class*=domain-tab]'))
        .map(function(e){return (e.textContent||'').trim();})
        .filter(function(x){return !!x;}).slice(0,20);
      var body=document.body?document.body.innerText:'';
      return JSON.stringify({url:location.href, hash:location.hash, path:location.pathname,
        active: at ? at.className+' | '+(at.textContent||'').trim() : '',
        tabs:tabs, body:body});
    })()"""
    r = call("Runtime.evaluate", {"expression": expr, "returnByValue": True})
    val = json.loads(r.get("result", {}).get("result", {}).get("value") or "{}")

    print("URL    :", val.get("url"))
    print("激活   :", val.get("active") or "(无)")
    tabs = val.get("tabs", [])
    print("标签   :", " / ".join(tabs) if tabs else "(无)")
    body = val.get("body", "")
    print("正文摘要:", body if args.full else (body[:600] + ("…(截断)" if len(body) > 600 else "")))

    if args.dom:
        d = call("Runtime.evaluate", {"expression": f"document.querySelector({json.dumps(args.dom)})?.outerHTML||'(无匹配)'", "returnByValue": True})
        dom = d.get("result", {}).get("result", {}).get("value", "")
        print(f"\nDOM[{args.dom}]:", dom[:2000])

    s = call("Page.captureScreenshot", {"format": "png"})
    open(SHOT, "wb").write(base64.b64decode(s["result"]["data"]))
    print(f"\n截图已存: {SHOT}")
    ws.close()


if __name__ == "__main__":
    main()
