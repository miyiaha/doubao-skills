#!/usr/bin/env bash
# test.sh — 采购多维表格 skill 一键校验（v2.1.2）
# 用法：bash scripts/test.sh
set -euo pipefail
cd "$(dirname "$0")/.."
echo "==> 采购多维表格 skill 公式校验"
node scripts/verify_formulas.mjs
echo "==> 全部通过 ✔"
