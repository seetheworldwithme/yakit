#!/usr/bin/env bash
# Yakit 企业版 no-license —— Linux arm64 AppImage 打包脚本
# 用法：在 macOS 或 Linux 的项目根目录执行 `bash build-linux-arm64.sh`
set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

BINS_DIR="${YAKIT_BINS_DIR:-$PROJECT_ROOT/bins}"
OUT_DIR="$PROJECT_ROOT/release/installers/linux-arm64"
ENGINE_ZIP="$BINS_DIR/yak_linux_arm64.zip"
ENGINE_BIN="$BINS_DIR/yak_linux_arm64"
ENGINE_VERSION_FILE="$BINS_DIR/engine-version.txt"
PACKAGE_JSON="$PROJECT_ROOT/package.json"
ORIG_PKG_CONTENT=""

fail() {
  echo "❌ $*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "缺少命令：$1"
}

cleanup() {
  if [[ -n "$ORIG_PKG_CONTENT" ]]; then
    printf '%s\n' "$ORIG_PKG_CONTENT" > "$PACKAGE_JSON"
  fi
}

trap cleanup EXIT

require_command yarn
require_command node
require_command unzip

HOST_SYSTEM="$(uname -s)"
case "$HOST_SYSTEM" in
  Darwin|Linux) ;;
  *) fail "Linux arm64 安装包仅支持在 macOS 或 Linux 上构建" ;;
esac

echo "[prep] 校验并刷新 Linux arm64 内置引擎..."
[[ -f "$ENGINE_ZIP" ]] || fail "缺少 $ENGINE_ZIP"

ENGINE_ENTRY=""
while IFS= read -r entry; do
  if [[ "$entry" == "yak_linux_arm64" || "$entry" == "bins/yak_linux_arm64" ]]; then
    ENGINE_ENTRY="$entry"
    break
  fi
done < <(unzip -Z1 "$ENGINE_ZIP")
[[ -n "$ENGINE_ENTRY" ]] || fail "$ENGINE_ZIP 中未找到 yak_linux_arm64"

TEMP_ENGINE="$(mktemp)"
unzip -p "$ENGINE_ZIP" "$ENGINE_ENTRY" > "$TEMP_ENGINE"

node - "$TEMP_ENGINE" <<'NODE'
const fs = require('fs')
const target = process.argv[2]
const file = fs.openSync(target, 'r')
const header = Buffer.alloc(64)
const size = fs.readSync(file, header, 0, header.length, 0)
fs.closeSync(file)
// ELF 魔数 \x7fELF，e_machine 偏移 18（64 位小端）：183 = EM_AARCH64
if (size < 20 || header.toString('ascii', 0, 4) !== '\x7fELF') {
  throw new Error('Linux 引擎不是有效的 ELF 文件')
}
if (header.readUInt16LE(18) !== 183) {
  throw new Error('Linux 引擎不是 arm64 架构')
}
NODE

mv -f "$TEMP_ENGINE" "$ENGINE_BIN"
chmod +x "$ENGINE_BIN" 2>/dev/null || true

# 引擎版本：macOS 无法执行 linux 二进制，直接从二进制里抠 CI 注入的版本串（dev-<短hash>）
ENGINE_VERSION="${YAK_ENGINE_VERSION:-}"
if [[ -z "$ENGINE_VERSION" ]]; then
  ENGINE_VERSION="$(grep -aom1 -E 'dev-[0-9a-f]{7,40}' "$ENGINE_BIN" || true)"
fi
[[ -n "$ENGINE_VERSION" ]] || fail "无法读取 Linux 引擎版本号，可通过 YAK_ENGINE_VERSION 指定"
printf '%s\n' "$ENGINE_VERSION" > "$ENGINE_VERSION_FILE"

echo "   ✅ 引擎成员：$ENGINE_ENTRY"
echo "   ✅ 引擎版本：$ENGINE_VERSION"
echo "   ✅ 已覆盖提取：$ENGINE_BIN"

if [[ "${YAKIT_BUILD_PREPARE_ONLY:-false}" == "true" ]]; then
  echo "✅ 引擎预检完成（prepare-only）"
  exit 0
fi

echo "[1/3] 构建渲染进程（企业版 no-license）..."
yarn build-renders-enterprise-no-license

echo "[2/3] 打包 linux arm64（EE 品牌，不签名）..."
# 安装包版本号日期段（如 2.4.7-0626 的 0626）改为打包当天日期：
# 打包前对 package.json 做字节级替换（只动 version 一处），构建结束由 cleanup 恢复。
BUILD_DATE="$(date +%m%d)"
ORIG_PKG_CONTENT="$(cat "$PACKAGE_JSON")"
node - "$PACKAGE_JSON" "$BUILD_DATE" <<'NODE'
const fs = require('fs')
const [pkgPath, date] = process.argv.slice(2)
const raw = fs.readFileSync(pkgPath, 'utf8')
const m = raw.match(/"version":\s*"([^"]+)"/)
if (!m) {
  throw new Error('package.json 中未找到 version 字段')
}
const base = m[1].replace(/-\d{4}$/, '')
fs.writeFileSync(pkgPath, raw.replace(m[0], `"version": "${base}-${date}"`))
console.log(`   ✅ 版本号设为 ${base}-${date}`)
NODE
yarn env-cmd -e nonSignNormal,EE -r packageScript/.env-cmdrc \
  electron-builder build --linux --arm64 \
  --config ./packageScript/electron-builder.config.js

echo "[3/3] 收拢安装包到 $OUT_DIR ..."
mkdir -p "$OUT_DIR"
shopt -s nullglob
ARTIFACTS=(release/*-linux-arm64.AppImage release/*-linux-arm64.AppImage.blockmap)
(( ${#ARTIFACTS[@]} > 0 )) || fail "electron-builder 未生成 Linux arm64 AppImage"
mv -f "${ARTIFACTS[@]}" "$OUT_DIR/"

echo "✅ Linux arm64 打包完成："
ls -lh "$OUT_DIR/"
