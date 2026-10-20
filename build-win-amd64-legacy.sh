#!/usr/bin/env bash
# Yakit 企业版 no-license —— Windows amd64 legacy（Win7 兼容）打包脚本
# 用法：在项目根目录执行 `bash build-win-amd64-legacy.sh`
#
# 与 build-win-amd64.sh 的差异（对齐 CI build-multi-prod.yml 的 legacy 流程）：
#   1. 内置引擎使用 legacy（Win7 兼容）yak 引擎，而非常规版
#   2. Electron 临时降级到 22.3.27（最后一个支持 Win7 的版本），打包结束自动还原
#   3. env-cmd 环境由 nonSignNormal,EE 换成 nonSignLegacy,EE（THE_LEGACY=true，
#      产物文件名带 -legacy，见 packageScript/buildHook/before-pack.js）
#
# legacy 引擎来源（二选一，脚本自动处理）：
#   a) 已有 bins/yak_windows_legacy_amd64.zip
#   b) 在同级 yaklang 仓库先执行 ./build-windows-legacy-amd64.sh，
#      本脚本会把产出的 yak_windows_legacy_amd64.exe 自动打包成 zip
#      （或用 YAK_LEGACY_ENGINE=/path/to/yak_windows_legacy_amd64.exe 指定）
#
# 产物：release/installers/windows-legacy-amd64/EnpriTrace-<版本>-windows-legacy-amd64.exe
set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

BINS_DIR="${YAKIT_BINS_DIR:-$PROJECT_ROOT/bins}"
OUT_DIR="$PROJECT_ROOT/release/installers/windows-legacy-amd64"
LEGACY_ENGINE_ZIP="$BINS_DIR/yak_windows_legacy_amd64.zip"
# electron-builder 的 before-pack 固定读取这两个文件名（packageScript/buildHook/before-pack.js）
ENGINE_ZIP="$BINS_DIR/yak_windows_amd64.zip"
ENGINE_EXE="$BINS_DIR/yak_windows_amd64.exe"
ENGINE_VERSION_FILE="$BINS_DIR/engine-version.txt"
ELECTRON_LEGACY_VERSION="${ELECTRON_LEGACY_VERSION:-22.3.27}"
TEMP_DIR=""
BUILD_LOCK_DIR="$PROJECT_ROOT/.build-win-amd64-legacy.lock"
BUILD_LOCK_ACQUIRED=false
# 打包期间临时改写 package.json（electron 降级 + 版本号日期段），结束后恢复（见 cleanup）
# ORIG_PKG_CONTENT 在切换 electron 前抓取，恢复它即可同时还原 electron 版本与版本号日期段
PACKAGE_JSON="$PROJECT_ROOT/package.json"
YARN_LOCK="$PROJECT_ROOT/yarn.lock"
ORIG_PKG_CONTENT=""
ORIG_LOCK_CONTENT=""
ELECTRON_SWITCHED=false
# 打包前备份的常规版引擎文件，cleanup 时还原，避免污染后续普通打包
BACKUP_DIR=""

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
  if [[ -n "$ORIG_LOCK_CONTENT" && -f "$YARN_LOCK" ]]; then
    printf '%s\n' "$ORIG_LOCK_CONTENT" > "$YARN_LOCK"
  fi
  if [[ "$ELECTRON_SWITCHED" == "true" ]]; then
    echo "[cleanup] 还原 Electron 依赖版本（yarn install）..."
    (cd "$PROJECT_ROOT" && yarn install) >/dev/null 2>&1 \
      || echo "⚠️ yarn install 还原失败，请手动执行 yarn install 恢复 electron 版本" >&2
  fi
  if [[ -n "$BACKUP_DIR" && -d "$BACKUP_DIR" ]]; then
    mv -f "$BACKUP_DIR/yak_windows_amd64.exe" "$ENGINE_EXE" 2>/dev/null || rm -f "$ENGINE_EXE"
    mv -f "$BACKUP_DIR/yak_windows_amd64.zip" "$ENGINE_ZIP" 2>/dev/null || rm -f "$ENGINE_ZIP"
    rmdir "$BACKUP_DIR" 2>/dev/null || true
  fi
  if [[ -n "$TEMP_DIR" && -d "$TEMP_DIR" ]]; then
    rm -rf -- "$TEMP_DIR"
  fi
  if [[ "$BUILD_LOCK_ACQUIRED" == "true" && -d "$BUILD_LOCK_DIR" ]]; then
    rmdir -- "$BUILD_LOCK_DIR" 2>/dev/null || true
  fi
}
trap cleanup EXIT

mkdir "$BUILD_LOCK_DIR" 2>/dev/null || fail "另一个 Windows legacy 打包任务正在运行"
BUILD_LOCK_ACQUIRED=true
TEMP_DIR="$(mktemp -d)"

require_command yarn
require_command node
require_command unzip
require_command zip

HOST_SYSTEM="$(uname -s)"
case "$HOST_SYSTEM" in
  Darwin)
    arch -x86_64 /usr/bin/true >/dev/null 2>&1 || fail "Apple Silicon 跨打 Windows 需要 Rosetta 2，请先执行：softwareupdate --install-rosetta"
    ;;
  MINGW*|MSYS*|CYGWIN*) ;;
  Linux)
    # Linux 跨打 Windows 与 macOS 同机制：electron-builder 26 自带 Wine 工具集（见下方 toolsets.wine）
    ;;
  *) fail "Windows amd64 legacy 安装包仅支持在 Linux、macOS 或 Windows Git Bash 上构建" ;;
esac

export ELECTRON_MIRROR="${ELECTRON_MIRROR:-https://npmmirror.com/mirrors/electron/}"
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--max-old-space-size=${YAKIT_NODE_HEAP_MB:-5632}"

echo "[prep] 校验并刷新 Windows amd64 legacy（Win7 兼容）内置引擎..."

if [[ ! -f "$LEGACY_ENGINE_ZIP" ]]; then
  LEGACY_ENGINE_EXE="${YAK_LEGACY_ENGINE:-$PROJECT_ROOT/../yaklang/yak_windows_legacy_amd64.exe}"
  [[ -f "$LEGACY_ENGINE_EXE" ]] || fail "未找到 legacy 引擎：$LEGACY_ENGINE_ZIP 不存在，且未找到 $LEGACY_ENGINE_EXE
请先在 yaklang 仓库执行 ./build-windows-legacy-amd64.sh，或用 YAK_LEGACY_ENGINE 指定 yak_windows_legacy_amd64.exe 路径"
  # 先落到临时目录再 zip，保证 zip 内条目名为 yak_windows_amd64.exe（与 CI 打包方式一致）
  cp -f "$LEGACY_ENGINE_EXE" "$TEMP_DIR/yak_windows_amd64.exe"
  zip -j -q "$LEGACY_ENGINE_ZIP" "$TEMP_DIR/yak_windows_amd64.exe"
  echo "   ✅ 已由 $LEGACY_ENGINE_EXE 生成 $LEGACY_ENGINE_ZIP"
fi

ENGINE_ENTRY=""
while IFS= read -r entry; do
  if [[ "$entry" == "yak_windows_amd64.exe" || "$entry" == "bins/yak_windows_amd64.exe" ]]; then
    ENGINE_ENTRY="$entry"
    break
  fi
done < <(unzip -Z1 "$LEGACY_ENGINE_ZIP")
[[ -n "$ENGINE_ENTRY" ]] || fail "$LEGACY_ENGINE_ZIP 中未找到 yak_windows_amd64.exe"

TEMP_ENGINE="$TEMP_DIR/yak_windows_amd64.exe"
unzip -p "$LEGACY_ENGINE_ZIP" "$ENGINE_ENTRY" > "$TEMP_ENGINE"

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

# 备份常规版引擎占位的两个文件名，再换入 legacy 引擎（before-pack 固定读这两个文件名）
BACKUP_DIR="$TEMP_DIR/backup"
mkdir -p "$BACKUP_DIR"
[[ -f "$ENGINE_EXE" ]] && mv -f "$ENGINE_EXE" "$BACKUP_DIR/yak_windows_amd64.exe" || true
[[ -f "$ENGINE_ZIP" ]] && mv -f "$ENGINE_ZIP" "$BACKUP_DIR/yak_windows_amd64.zip" || true
mv -f "$TEMP_ENGINE" "$ENGINE_EXE"
chmod +x "$ENGINE_EXE" 2>/dev/null || true
cp -f "$LEGACY_ENGINE_ZIP" "$ENGINE_ZIP"

ENGINE_VERSION="${YAK_ENGINE_VERSION:-}"
if [[ -z "$ENGINE_VERSION" ]]; then
  case "$HOST_SYSTEM" in
    MINGW*|MSYS*|CYGWIN*)
      ENGINE_VERSION="$("$ENGINE_EXE" version | awk -F': ' '/^[[:space:]]*Version:/ { print $2; exit }')" || true
      ;;
    Darwin)
      # 与 build-win-amd64.sh 相同：借 darwin 引擎读同批构建的版本号
      MAC_ENGINE_ZIP="$BINS_DIR/yak_darwin_arm64.zip"
      if [[ -f "$MAC_ENGINE_ZIP" ]]; then
        MAC_ENTRY=""
        while IFS= read -r entry; do
          if [[ "$entry" == "yak_darwin_arm64" || "$entry" == "bins/yak_darwin_arm64" ]]; then
            MAC_ENTRY="$entry"
            break
          fi
        done < <(unzip -Z1 "$MAC_ENGINE_ZIP")
        if [[ -n "$MAC_ENTRY" ]]; then
          MAC_ENGINE="$TEMP_DIR/yak_darwin_arm64"
          unzip -p "$MAC_ENGINE_ZIP" "$MAC_ENTRY" > "$MAC_ENGINE"
          chmod +x "$MAC_ENGINE"
          ENGINE_VERSION="$("$MAC_ENGINE" version | awk -F': ' '/^[[:space:]]*Version:/ { print $2; exit }')" || true
        fi
      fi
      ;;
  esac
fi
if [[ -z "$ENGINE_VERSION" ]]; then
  # Linux 等无法直接运行 Windows 引擎的环境：本地构建的引擎版本形如 dev-<hash>，直接从二进制提取
  ENGINE_VERSION="$(grep -aoE 'dev-[0-9a-f]{7,40}' "$ENGINE_EXE" | head -n 1 || true)"
fi
[[ -n "$ENGINE_VERSION" ]] || fail "无法读取引擎版本号，可通过 YAK_ENGINE_VERSION 指定"
printf '%s\n' "$ENGINE_VERSION" > "$ENGINE_VERSION_FILE"

echo "   ✅ 引擎成员：$ENGINE_ENTRY"
echo "   ✅ 引擎版本：$ENGINE_VERSION"
echo "   ✅ 已换入 legacy 引擎：$ENGINE_EXE / $ENGINE_ZIP"

if [[ "${YAKIT_BUILD_PREPARE_ONLY:-false}" == "true" ]]; then
  echo "✅ 引擎预检完成（prepare-only）"
  exit 0
fi

echo "[1/4] 构建渲染进程（企业版 no-license）..."
yarn build-renders-enterprise-no-license

echo "[2/4] 临时切换 Electron 到 ${ELECTRON_LEGACY_VERSION}（legacy 专用，结束后自动还原）..."
ORIG_PKG_CONTENT="$(cat "$PACKAGE_JSON")"
ORIG_LOCK_CONTENT="$(cat "$YARN_LOCK" 2>/dev/null || true)"
node - "$PACKAGE_JSON" "$ELECTRON_LEGACY_VERSION" <<'NODE'
const fs = require('fs')
const [pkgPath, version] = process.argv.slice(2)
const raw = fs.readFileSync(pkgPath, 'utf8')
const m = raw.match(/"electron":\s*"([^"]+)"/)
if (!m) {
  throw new Error('package.json 中未找到 electron 依赖')
}
fs.writeFileSync(pkgPath, raw.replace(m[0], `"electron": "${version}"`))
console.log(`   ✅ electron ${m[1]} -> ${version}`)
NODE
yarn install
ELECTRON_SWITCHED=true

echo "[3/4] 打包 win x64 legacy（EE 品牌，Win7 兼容，不签名）..."

# ---------- arm64 Linux 专用适配 ----------
# 1) electron-builder 的 NSIS 工具集里 linux makensis 是 x86_64 ELF，需 qemu-user + binfmt 透明运行；
#    运行期还需要 amd64 multiarch 的 glibc/libstdc++/zlib
# 2) 卸载器提取默认走捆绑的 x86_64 wine，在 qemu-user 下会核心转储（wineserver 机制不兼容），
#    改为纯 JS 的 UninstallerReader（electron-builder 在 macOS Catalina 的同款免 wine 路径）
if [[ "$(uname -s)" == "Linux" && "$(uname -m)" == "aarch64" ]]; then
  if ! ls /proc/sys/fs/binfmt_misc/ 2>/dev/null | grep -q '^qemu-x86_64'; then
    fail "arm64 Linux 打 Windows 包需要 qemu-user 的 binfmt 支持，请执行：
  sudo apt install qemu-user-static binfmt-support"
  fi
  MAKENSIS="$(ls -1 "$HOME"/.cache/electron-builder/nsis-*/nsis-*/linux/makensis 2>/dev/null | head -n 1 || true)"
  if [[ -n "$MAKENSIS" && ! -x "$MAKENSIS" ]]; then
    fail "NSIS makensis 存在但不可执行：$MAKENSIS"
  fi
  if [[ -n "$MAKENSIS" ]]; then
    if ! "$MAKENSIS" -VERSION &>/dev/null; then
      fail "x86_64 makensis 无法运行（缺 amd64 动态库），请执行：
  sudo dpkg --add-architecture amd64
  sudo tee /etc/apt/sources.list.d/amd64-multiarch.list >/dev/null <<'EOF'
deb [arch=amd64] http://archive.ubuntu.com/ubuntu/ jammy main universe
deb [arch=amd64] http://archive.ubuntu.com/ubuntu/ jammy-updates main universe
deb [arch=amd64] http://security.ubuntu.com/ubuntu jammy-security main universe
EOF
  sudo apt update && sudo apt install libc6:amd64 libstdc++6:amd64 zlib1g:amd64"
    fi
  fi
  node - "$PROJECT_ROOT/node_modules/app-builder-lib/out/targets/nsis/NsisTarget.js" <<'NODE'
const fs = require('fs')
const file = process.argv[2]
let src = fs.readFileSync(file, 'utf8')
const marker = '// patched by build-win-amd64-legacy'
if (src.includes(marker)) {
  console.log('   ✅ NSIS 卸载器提取补丁已存在，跳过')
} else {
  const from = 'await wineVm.exec(installerPath, [], { env: { __COMPAT_LAYER: "RunAsInvoker" } });'
  const to = `await nsisUtil_1.UninstallerReader.exec(installerPath, uninstallerPath); ${marker}`
  if (!src.includes(from)) {
    throw new Error('未找到 wineVm.exec 调用，electron-builder 版本可能已更新，请检查补丁适配')
  }
  fs.writeFileSync(file, src.replace(from, to))
  console.log('   ✅ NSIS 卸载器提取已改为 UninstallerReader（纯 JS，免 wine）')
}
NODE
fi

# 清理上次 legacy 产物，避免 mv 收拢时混入旧文件
rm -f release/*-windows-legacy-amd64.exe release/*-windows-legacy-amd64.exe.blockmap
# 安装包版本号日期段（如 2.4.7-0626 的 0626）改为打包当天日期：
# 打包前对 package.json 做字节级替换（只动 version 一处），构建结束由 cleanup 恢复。
# 不用 -c.extraMetadata.version CLI 覆盖——env-cmd 10.1.0 会把该参数吞掉导致构建直接退出。
BUILD_DATE="$(date +%m%d)"
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
  # electron-builder 26 会自动下载带 Wine 11 的 1.0.1 工具集，无需本机安装 Wine。
  BUILDER_ARGS+=(--config.toolsets.wine=1.0.1)
fi
yarn env-cmd -e nonSignLegacy,EE -r packageScript/.env-cmdrc "${BUILDER_ARGS[@]}"

echo "[4/4] 收拢安装包到 $OUT_DIR ..."
mkdir -p "$OUT_DIR"
shopt -s nullglob
ARTIFACTS=(release/*-windows-legacy-amd64.exe release/*-windows-legacy-amd64.exe.blockmap)
(( ${#ARTIFACTS[@]} > 0 )) || fail "electron-builder 未生成 Windows legacy amd64 安装包"
mv -f "${ARTIFACTS[@]}" "$OUT_DIR/"

echo "✅ Windows amd64 legacy 打包完成："
ls -lh "$OUT_DIR/"
