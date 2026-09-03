#!/usr/bin/env bash
# 通用销售路演 skill · 一键合规回归（Node.js / Deno 双运行时）
# 依次运行：单份成稿 CLI 体检 + 输出合规测试 harness
# 任一环节失败则整体退出非 0（可作 CI 门禁）。
#
# 运行器自动检测：优先用 node（更普及），没有则回退 deno。
set -euo pipefail

cd "$(dirname "$0")/.."

RUNNER=""
if command -v node >/dev/null 2>&1; then
  RUNNER="node"
  RUN_CMD=("node")
elif command -v deno >/dev/null 2>&1; then
  RUNNER="deno"
  RUN_CMD=("deno" "run" "--allow-read")
else
  echo "❌ 未找到 node 或 deno，请先安装其一：https://nodejs.org 或 https://deno.land" >&2
  exit 1
fi

# 临时目录（v1.7.2 健壮性修复）：优先系统 mktemp；/tmp 不可写（沙箱/受限环境）时
# 回退到技能目录内 .roadshow-tmp，避免 EACCES 导致回归假失败。
make_tmp_dir() {
  local d
  if d="$(mktemp -d 2>/dev/null)"; then
    printf '%s' "$d"
  else
    mkdir -p "$(dirname "$0")/../.roadshow-tmp"
    mktemp -d "$(dirname "$0")/../.roadshow-tmp/roadshow.XXXXXX"
  fi
}

echo "══════════════════════════════════════════════════════"
echo "  运行器：${RUNNER}    （node 优先，无则回退 deno）"
echo "══════════════════════════════════════════════════════"

echo ""
echo "══════════════════════════════════════════════════════"
echo "  1) CLI 体检（内置范例 pitch-example）"
echo "══════════════════════════════════════════════════════"
"${RUN_CMD[@]}" scripts/roadshow_check.mjs

echo ""
echo "══════════════════════════════════════════════════════"
echo "  2) 输出合规测试 harness（多用例正/负/边界）"
echo "══════════════════════════════════════════════════════"
"${RUN_CMD[@]}" scripts/roadshow_test_harness.mjs

echo ""
echo "══════════════════════════════════════════════════════"
echo "  3) PPT 渲染大纲导出回归（内置范例 → 临时目录）"
echo "══════════════════════════════════════════════════════"
OUT_DIR="$(make_tmp_dir)"
"${RUN_CMD[@]}" scripts/roadshow_export_pptx.mjs references/saas-pitch-example.md "$OUT_DIR" >/dev/null
rm -rf "$OUT_DIR"

echo ""
echo "══════════════════════════════════════════════════════"
echo "  4) .pptx 技能内直出回归（v1.5，内置范例 → 临时目录）"
echo "══════════════════════════════════════════════════════"
OUT_DIR="$(make_tmp_dir)"
"${RUN_CMD[@]}" scripts/roadshow_build_pptx.mjs references/saas-pitch-example.md "$OUT_DIR" >/dev/null
# 校验确实产出了合法 pptx（zip 结构 + 含 slide 与 chart）
if command -v python3 >/dev/null 2>&1; then
  python3 - "$OUT_DIR/saas-pitch-example.pptx" <<'PY'
import sys, zipfile
z = zipfile.ZipFile(sys.argv[1])
slides = [n for n in z.namelist() if n.startswith("ppt/slides/slide") and n.endswith(".xml")]
assert len(slides) >= 10, f"pptx 页数异常: {len(slides)}"
assert any("chart" in n for n in z.namelist()), "pptx 缺少竞品雷达图"
print(f"  ✅ .pptx 合法：{len(z.namelist())} 条目 / {len(slides)} 页 / 含雷达图")
PY
else
  test -f "$OUT_DIR/saas-pitch-example.pptx" && echo "  ✅ .pptx 文件已产出（无 python3 深度校验）"
fi
rm -rf "$OUT_DIR"

echo ""
echo "✅ 一键合规回归全部通过（含 PPT 大纲导出 + .pptx 技能内直出）。"
