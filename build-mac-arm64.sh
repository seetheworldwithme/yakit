#!/usr/bin/env bash
# Yakit 企业版 no-license —— macOS arm64 打包脚本
# 用法：在 macOS 项目根目录执行 `bash build-mac-arm64.sh`
set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

BINS_DIR="${YAKIT_BINS_DIR:-$PROJECT_ROOT/bins}"
OUT_DIR="$PROJECT_ROOT/release/installers/mac-arm64"
ENGINE_ZIP="$BINS_DIR/yak_darwin_arm64.zip"
ENGINE_SHA="$BINS_DIR/yak_darwin_arm64.sha256.txt"
ENGINE_VERSION_FILE="$BINS_DIR/engine-version.txt"
TEMP_DIR=""

fail() {
  echo "❌ $*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "缺少命令：$1"
}

cleanup() {
  if [[ -n "$TEMP_DIR" && -d "$TEMP_DIR" ]]; then
    rm -rf -- "$TEMP_DIR"
  fi
}
trap cleanup EXIT

[[ "$(uname -s)" == "Darwin" ]] || fail "mac arm64 安装包只能在 macOS 上构建"
require_command yarn
require_command unzip
require_command shasum

echo "[prep] 校验 mac arm64 内置引擎..."
[[ -f "$ENGINE_ZIP" ]] || fail "缺少 $ENGINE_ZIP"
[[ -s "$ENGINE_SHA" ]] || fail "缺少或为空：$ENGINE_SHA"

ENGINE_ENTRY=""
while IFS= read -r entry; do
  if [[ "$entry" == "yak_darwin_arm64" || "$entry" == "bins/yak_darwin_arm64" ]]; then
    ENGINE_ENTRY="$entry"
    break
  fi
done < <(unzip -Z1 "$ENGINE_ZIP")
[[ -n "$ENGINE_ENTRY" ]] || fail "$ENGINE_ZIP 中未找到 yak_darwin_arm64"

TEMP_DIR="$(mktemp -d)"
TEMP_ENGINE="$TEMP_DIR/yak_darwin_arm64"
unzip -p "$ENGINE_ZIP" "$ENGINE_ENTRY" > "$TEMP_ENGINE"
chmod +x "$TEMP_ENGINE"

EXPECTED_SHA="$(awk 'NR == 1 { print $1 }' "$ENGINE_SHA")"
ACTUAL_SHA="$(shasum -a 256 "$TEMP_ENGINE" | awk '{ print $1 }')"
[[ "$EXPECTED_SHA" =~ ^[0-9a-fA-F]{64}$ ]] || fail "$ENGINE_SHA 不是有效的 SHA256 文件"
[[ "$ACTUAL_SHA" == "$EXPECTED_SHA" ]] || fail "mac 引擎 SHA256 不匹配：expected=$EXPECTED_SHA actual=$ACTUAL_SHA"

ENGINE_VERSION="${YAK_ENGINE_VERSION:-$($TEMP_ENGINE version | awk -F': ' '/^[[:space:]]*Version:/ { print $2; exit }')}"
[[ -n "$ENGINE_VERSION" ]] || fail "无法从 mac 引擎读取版本号，可通过 YAK_ENGINE_VERSION 指定"
printf '%s\n' "$ENGINE_VERSION" > "$ENGINE_VERSION_FILE"

echo "   ✅ 引擎成员：$ENGINE_ENTRY"
echo "   ✅ 引擎版本：$ENGINE_VERSION"
echo "   ✅ 二进制 SHA256：$ACTUAL_SHA"

if [[ "${YAKIT_BUILD_PREPARE_ONLY:-false}" == "true" ]]; then
  echo "✅ 引擎预检完成（prepare-only）"
  exit 0
fi

echo "[1/3] 构建渲染进程（企业版 no-license）..."
yarn build-renders-enterprise-no-license

echo "[2/3] 打包 mac arm64（EE 品牌，不签名）..."
yarn env-cmd -e nonSignNormal,EE -r packageScript/.env-cmdrc \
  electron-builder build --mac --arm64 \
  --config ./packageScript/electron-builder.config.js

echo "[3/3] 收拢安装包到 $OUT_DIR ..."
mkdir -p "$OUT_DIR"
shopt -s nullglob
ARTIFACTS=(release/*-darwin-arm64.dmg release/*-darwin-arm64.dmg.blockmap)
(( ${#ARTIFACTS[@]} > 0 )) || fail "electron-builder 未生成 mac arm64 安装包"
mv -f "${ARTIFACTS[@]}" "$OUT_DIR/"

echo "✅ mac arm64 打包完成："
ls -lh "$OUT_DIR/"
