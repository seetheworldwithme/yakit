#!/usr/bin/env bash
# Yakit 企业版 no-license —— Windows amd64 打包脚本
# 用法：在 macOS 或 Windows Git Bash 的项目根目录执行 `bash build-win-amd64.sh`
set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

BINS_DIR="${YAKIT_BINS_DIR:-$PROJECT_ROOT/bins}"
OUT_DIR="$PROJECT_ROOT/release/installers/windows-amd64"
ENGINE_ZIP="$BINS_DIR/yak_windows_amd64.zip"
ENGINE_EXE="$BINS_DIR/yak_windows_amd64.exe"
ENGINE_VERSION_FILE="$BINS_DIR/engine-version.txt"
TEMP_DIR=""
BUILD_LOCK_DIR="$PROJECT_ROOT/.build-win-amd64.lock"
BUILD_LOCK_ACQUIRED=false
# 打包日期注入：构建期间临时改写 package.json 版本号日期段，结束后恢复（见 cleanup）
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
  if [[ -n "$TEMP_DIR" && -d "$TEMP_DIR" ]]; then
    rm -rf -- "$TEMP_DIR"
  fi
  if [[ "$BUILD_LOCK_ACQUIRED" == "true" && -d "$BUILD_LOCK_DIR" ]]; then
    rmdir -- "$BUILD_LOCK_DIR" 2>/dev/null || true
  fi
}
trap cleanup EXIT

mkdir "$BUILD_LOCK_DIR" 2>/dev/null || fail "另一个 Windows amd64 打包任务正在运行"
BUILD_LOCK_ACQUIRED=true

require_command yarn
require_command node
require_command unzip

HOST_SYSTEM="$(uname -s)"
case "$HOST_SYSTEM" in
  Darwin)
    arch -x86_64 /usr/bin/true >/dev/null 2>&1 || fail "Apple Silicon 跨打 Windows 需要 Rosetta 2，请先执行：softwareupdate --install-rosetta"
    ;;
  MINGW*|MSYS*|CYGWIN*) ;;
  *) fail "Windows amd64 安装包仅支持在 macOS 或 Windows Git Bash 上构建" ;;
esac

echo "[prep] 校验并刷新 Windows amd64 内置引擎..."
[[ -f "$ENGINE_ZIP" ]] || fail "缺少 $ENGINE_ZIP"

ENGINE_ENTRY=""
while IFS= read -r entry; do
  if [[ "$entry" == "yak_windows_amd64.exe" || "$entry" == "bins/yak_windows_amd64.exe" ]]; then
    ENGINE_ENTRY="$entry"
    break
  fi
done < <(unzip -Z1 "$ENGINE_ZIP")
[[ -n "$ENGINE_ENTRY" ]] || fail "$ENGINE_ZIP 中未找到 yak_windows_amd64.exe"

TEMP_DIR="$(mktemp -d)"
TEMP_ENGINE="$TEMP_DIR/yak_windows_amd64.exe"
unzip -p "$ENGINE_ZIP" "$ENGINE_ENTRY" > "$TEMP_ENGINE"

node - "$TEMP_ENGINE" <<'NODE'
const fs = require('fs')
const target = process.argv[2]
const file = fs.openSync(target, 'r')
const header = Buffer.alloc(4096)
const size = fs.readSync(file, header, 0, header.length, 0)
fs.closeSync(file)
if (size < 64 || header.toString('ascii', 0, 2) !== 'MZ') {
  throw new Error('Windows 引擎不是有效的 PE 文件')
}
const peOffset = header.readUInt32LE(0x3c)
if (peOffset + 6 > size || header.toString('ascii', peOffset, peOffset + 4) !== 'PE\0\0') {
  throw new Error('Windows 引擎缺少 PE 头')
}
if (header.readUInt16LE(peOffset + 4) !== 0x8664) {
  throw new Error('Windows 引擎不是 amd64 架构')
}
NODE

mv -f "$TEMP_ENGINE" "$ENGINE_EXE"
chmod +x "$ENGINE_EXE" 2>/dev/null || true

ENGINE_VERSION="${YAK_ENGINE_VERSION:-}"
if [[ -z "$ENGINE_VERSION" && "$HOST_SYSTEM" == "Darwin" ]]; then
  MAC_ENGINE_ZIP="$BINS_DIR/yak_darwin_arm64.zip"
  [[ -f "$MAC_ENGINE_ZIP" ]] || fail "macOS 跨打 Windows 时需要 $MAC_ENGINE_ZIP 来读取同批引擎版本，或设置 YAK_ENGINE_VERSION"
  MAC_ENTRY=""
  while IFS= read -r entry; do
    if [[ "$entry" == "yak_darwin_arm64" || "$entry" == "bins/yak_darwin_arm64" ]]; then
      MAC_ENTRY="$entry"
      break
    fi
  done < <(unzip -Z1 "$MAC_ENGINE_ZIP")
  [[ -n "$MAC_ENTRY" ]] || fail "$MAC_ENGINE_ZIP 中未找到 yak_darwin_arm64"
  MAC_ENGINE="$TEMP_DIR/yak_darwin_arm64"
  unzip -p "$MAC_ENGINE_ZIP" "$MAC_ENTRY" > "$MAC_ENGINE"
  chmod +x "$MAC_ENGINE"
  ENGINE_VERSION="$($MAC_ENGINE version | awk -F': ' '/^[[:space:]]*Version:/ { print $2; exit }')"
elif [[ -z "$ENGINE_VERSION" ]]; then
  ENGINE_VERSION="$($ENGINE_EXE version | awk -F': ' '/^[[:space:]]*Version:/ { print $2; exit }')"
fi
[[ -n "$ENGINE_VERSION" ]] || fail "无法读取 Windows 引擎版本号，可通过 YAK_ENGINE_VERSION 指定"
printf '%s\n' "$ENGINE_VERSION" > "$ENGINE_VERSION_FILE"

echo "   ✅ 引擎成员：$ENGINE_ENTRY"
echo "   ✅ 引擎版本：$ENGINE_VERSION"
echo "   ✅ 已覆盖提取：$ENGINE_EXE"

if [[ "${YAKIT_BUILD_PREPARE_ONLY:-false}" == "true" ]]; then
  echo "✅ 引擎预检完成（prepare-only）"
  exit 0
fi

echo "[1/3] 构建渲染进程（企业版 no-license）..."
yarn build-renders-enterprise-no-license

echo "[2/3] 打包 win x64（EE 品牌，不签名）..."
# 安装包版本号日期段（如 2.4.7-0626 的 0626）改为打包当天日期：
# 打包前对 package.json 做字节级替换（只动 version 一处），构建结束由 cleanup 恢复。
# 不用 -c.extraMetadata.version CLI 覆盖——env-cmd 10.1.0 会把该参数吞掉导致构建直接退出。
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
BUILDER_ARGS=(
  electron-builder build --win --x64
  --config ./packageScript/electron-builder.config.js
)
if [[ "$HOST_SYSTEM" == "Darwin" ]]; then
  # electron-builder 26 会自动下载带 Wine 11 的 1.0.1 工具集，无需本机 Homebrew 安装 Wine。
  BUILDER_ARGS+=(--config.toolsets.wine=1.0.1)
fi
yarn env-cmd -e nonSignNormal,EE -r packageScript/.env-cmdrc "${BUILDER_ARGS[@]}"

echo "[3/3] 收拢安装包到 $OUT_DIR ..."
mkdir -p "$OUT_DIR"
shopt -s nullglob
ARTIFACTS=(release/*-windows-amd64.exe release/*-windows-amd64.exe.blockmap)
(( ${#ARTIFACTS[@]} > 0 )) || fail "electron-builder 未生成 Windows amd64 安装包"
mv -f "${ARTIFACTS[@]}" "$OUT_DIR/"

echo "✅ Windows amd64 打包完成："
ls -lh "$OUT_DIR/"
