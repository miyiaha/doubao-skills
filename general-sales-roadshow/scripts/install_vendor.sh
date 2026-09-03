#!/usr/bin/env bash
# install_vendor.sh — 一键构建并安装 pptxgen.standalone.cjs（自包含 PPT 渲染引擎）
#
# 用途：本仓库不直接提交 ~708KB 的第三方打包文件，用户 clone 后运行本脚本一键生成。
# 行为：在临时目录 npm install pptxgenjs + esbuild → esbuild 打包为自包含 CJS → 复制到 scripts/vendor/
# 兼容：Node.js ≥ 18；无需全局安装任何工具；不修改项目结构；完成后自动清理临时目录。
# 退出码：成功 0；失败 1。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENDOR_DIR="${SCRIPT_DIR}/vendor"
TARGET_FILE="${VENDOR_DIR}/pptxgen.standalone.cjs"

echo "══════════════════════════════════════════════════════"
echo "  安装自包含 PPT 渲染引擎（pptxgen.standalone.cjs）"
echo "══════════════════════════════════════════════════════"
echo ""

# ── 1. 检查 Node.js ─────────────────────────────────────────────
if ! command -v node >/dev/null 2>&1; then
  echo "❌ 未找到 node。请先安装 Node.js ≥ 18（https://nodejs.org）"
  exit 1
fi

NODE_VERSION="$(node -v | sed 's/v//' | cut -d. -f1)"
if [ "${NODE_VERSION}" -lt 18 ]; then
  echo "❌ Node.js 版本过低（当前 $(node -v)），需要 ≥ 18"
  exit 1
fi
echo "✅ Node.js $(node -v)"

# ── 2. 检查目标文件是否已存在 ───────────────────────────────────
if [ -f "${TARGET_FILE}" ]; then
  EXISTING_SIZE="$(wc -c < "${TARGET_FILE}" | tr -d ' ')"
  echo "ℹ️  目标文件已存在（${EXISTING_SIZE} bytes）。"
  read -r -p "是否覆盖重建？[y/N] " CONFIRM
  if [ "${CONFIRM}" != "y" ] && [ "${CONFIRM}" != "Y" ]; then
    echo "已取消，保留现有文件。"
    exit 0
  fi
fi

# ── 3. 创建临时构建目录 ─────────────────────────────────────────
BUILD_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t pptxgen-build)"
trap 'rm -rf "${BUILD_DIR}"' EXIT
echo "📦 临时构建目录：${BUILD_DIR}"

# ── 4. 初始化并安装依赖 ─────────────────────────────────────────
echo ""
echo "🔧 安装 pptxgenjs + esbuild（临时目录，不影响全局）..."
cd "${BUILD_DIR}"
npm init -y >/dev/null 2>&1
npm install pptxgenjs esbuild --no-audit --no-fund 2>&1 | tail -3

# ── 5. 创建入口文件 ─────────────────────────────────────────────
cat > entry.cjs << 'ENTRY_EOF'
// pptxgenjs 自包含打包入口
module.exports = require("pptxgenjs");
ENTRY_EOF

# ── 6. 用 esbuild 打包为自包含 CJS 单文件 ──────────────────────
echo ""
echo "⚙️  用 esbuild 打包为自包含单文件（含 JSZip 等全部依赖）..."
npx esbuild entry.cjs \
  --bundle \
  --platform=node \
  --format=cjs \
  --outfile=pptxgen.standalone.cjs \
  --log-level=warning

BUILD_SIZE="$(wc -c < pptxgen.standalone.cjs | tr -d ' ')"
echo "✅ 打包完成：${BUILD_SIZE} bytes"

# ── 7. 复制到 vendor 目录 ───────────────────────────────────────
mkdir -p "${VENDOR_DIR}"
cp pptxgen.standalone.cjs "${TARGET_FILE}"
echo ""
echo "📁 已安装到：${TARGET_FILE}"

# ── 8. 验证 ─────────────────────────────────────────────────────
echo ""
echo "🔍 验证模块可加载..."
cd "${SCRIPT_DIR}/.."
if node -e "const PptxGenJS = require('./scripts/vendor/pptxgen.standalone.cjs'); const p = new PptxGenJS(); console.log('✅ pptxgenjs 加载成功，默认布局：' + p.layout);" 2>&1; then
  echo ""
  echo "══════════════════════════════════════════════════════"
  echo "  ✅ 安装完成！"
  echo "══════════════════════════════════════════════════════"
  echo ""
  echo "下一步验证（可选）："
  echo "  node scripts/roadshow_test_harness.mjs    # 29 项全量回归"
  echo "  node scripts/roadshow_build_pptx.mjs references/saas-pitch-example.md  # 直出 .pptx"
  echo ""
  exit 0
else
  echo "❌ 模块加载验证失败，请检查上方错误信息"
  exit 1
fi
