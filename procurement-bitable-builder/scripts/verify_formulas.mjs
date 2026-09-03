#!/usr/bin/env node
/**
 * verify_formulas.mjs — 采购管理多维表格 skill「公式可执行校验」（v2.1.2 新增）
 *
 * 目的：把 50+ 公式中最关键的公式抽成可复算的确定性测试，杜绝
 *   table-templates.md 与 formulas-automations.md 双份漂移（同公式两处写法不一致），
 *   并守住 5 处历史缺陷（v2.1.2 修复项）不回归。
 *
 * 组成：
 *   1) 基线复算：与 quality-checklist.md 中的预期基准值逐项核对（82.5 / 86 / 111.8 / 16.67…）
 *   2) 边界测试：除零保护、MAX 钳制、负值、档位边界（正好命中阈值）等
 *   3) 跨文档一致性：读取本技能 md 文档，断言两文件公式口径一致、前置字段已定义
 *
 * 运行（Node ≥18 即可，零依赖，纯 ESM）：
 *   node scripts/verify_formulas.mjs
 * 全部通过 exit 0；任一失败 exit 1 并打印明细。
 * 注意：文档一致性检查读取的路径基于本文件所在目录（scripts/../references）。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const here = path.dirname(fileURLToPath(import.meta.url));
const refDir = path.join(here, "..", "references");
const read = (f) => readFileSync(path.join(refDir, f), "utf8");
// ── 公式复算辅助（把文档中的公式翻译为可执行的确定性实现）────────
const F = {
  // 供应商加权总分：质量*0.35 + 交付*0.25 + 服务*0.20 + 价格*0.20
  weightedTotal: (q, d, s, p) => q * 0.35 + d * 0.25 + s * 0.20 + p * 0.20,
  // 绩效评定等级判定（分数口径）：>=90 S / >=80 A / >=70 B / >=60 C / else D
  grade: (score) => (score >= 90 ? "S" : score >= 80 ? "A" : score >= 70 ? "B" : score >= 60 ? "C" : "D"),
  // 基础预测：近3月*0.5 + 3-6月*0.3 + 6-12月*0.2
  baseForecast: (a, b, c) => a * 0.5 + b * 0.3 + c * 0.2,
  // 预测偏差率：IF(实际>0, |预测-实际|/实际*100, 0)
  devRate: (f, a) => (a > 0 ? Math.abs(f - a) / a * 100 : 0),
  // 预测准确率：MAX(0, 100 - 偏差率)
  accuracy: (dev) => Math.max(0, 100 - dev),
  // RPN = 概率*影响*可检测性
  rpn: (p, i, d) => p * i * d,
  rpnLevel: (r) => (r >= 80 ? "🔴 高风险" : r >= 40 ? "🟡 中风险" : "🟢 低风险"),
  // HHI = 各份额平方和（方案 B，0-100 数字份额）
  hhi: (...shares) => shares.reduce((s, x) => s + (Number(x) || 0) ** 2, 0),
  hhiLevel: (h) => (h >= 2500 ? "🔴 高度集中（垄断风险）" : h >= 1500 ? "🟡 中度集中" : h >= 1000 ? "🟢 适度集中" : "🟢 充分竞争"),
  // 谈判达成率：IF(目标价!=底线价, (成交-底线)/(目标-底线)*100, 100)
  negRate: (target, floor, deal) => (target !== floor ? (deal - floor) / (target - floor) * 100 : 100),
  negRateLevel: (r) => (r > 100 ? "🏆 超预期" : r >= 80 ? "✅ 达成" : r >= 50 ? "⚠️ 基本达成" : "❌ 未达成"),
  // 降本率：(原-现)/原*100
  costCutRate: (oldP, newP) => (oldP > 0 ? (oldP - newP) / oldP * 100 : 0),
  // 供应商份额占比：该供应商采购额/品类总采购额*100
  share: (s, total) => (total > 0 ? s / total * 100 : 0),
  // 可用天数：IF(日均>0, 库存/日均, "∞")
  daysOfStock: (stock, daily) => (daily > 0 ? stock / daily : "∞"),
  // 补货建议量：MAX(0, 安全库存*2 - 当前库存)
  reorder: (safe, stock) => Math.max(0, safe * 2 - stock),
  // 建议采购量：MAX(0, 最终预测值 - 当前库存 + 安全库存)
  suggestBuy: (f, stock, safe) => Math.max(0, f - stock + safe),
  // 价格异常检测：IF(AND(均价>0, |单价-均价|/均价>0.3), "⚠️ 价格异常", "正常")
  priceAnomaly: (price, avg) => (avg > 0 && Math.abs(price - avg) / avg > 0.3 ? "⚠️ 价格异常" : "正常"),
  // 卡拉杰克象限自动判定（前置字段：品类阈值（数字）/ 风险等级）
  kraljic: (amount, threshold, risk) =>
    amount >= threshold && risk === "高" ? "战略型"
    : amount >= threshold && risk === "低" ? "杠杆型"
    : amount < threshold && risk === "高" ? "瓶颈型"
    : "常规型",
};
// ── 测试框架 ───────────────────────────────────────────────────
let pass = 0, fail = 0;
const fails = [];
function check(name, actual, expected, tol = 1e-6) {
  const ok = typeof expected === "number"
    ? Math.abs(actual - expected) <= tol
    : actual === expected;
  if (ok) { pass++; }
  else { fail++; fails.push(`  ✗ ${name}：期望 ${expected}，实际 ${actual}`); }
}
function section(title) { console.log(`\n【${title}】`); }
// ── 1. 基线复算（与 quality-checklist.md 基准值一致）─────────────
section("1. 基线复算（对齐 quality-checklist 基准值）");
check("加权总分（90/80/70/85）", F.weightedTotal(90, 80, 70, 85), 82.5);
check("基础预测（100/80/60）", F.baseForecast(100, 80, 60), 86);
check("季节调整（86*1.3）", 86 * 1.3, 111.8);
check("预测偏差率（预测100/实际120）", F.devRate(100, 120), 100 / 6); // 16.666...
check("RPN（4*3*5）", F.rpn(4, 3, 5), 60);
check("HHI（50/30/20）", F.hhi(50, 30, 20), 3800);
// ── 2. 绩效评定等级判定（分数口径）───────────────────────────────
section("2. 绩效评定等级判定（分数口径，v2.1.2 修复③）");
for (const [score, expect] of [[92, "S"], [90, "S"], [85, "A"], [75, "B"], [70, "B"], [65, "C"], [60, "C"], [55, "D"], [0, "D"]]) {
  check(`加权总分=${score} → ${expect}`, F.grade(score), expect);
}
// ── 3. 预测公式边界（v2.1.2 修复①⑤）────────────────────────────
section("3. 预测公式边界（除零保护 + MAX 钳制）");
check("预测偏差率（实际=0）→ 0 不报错", F.devRate(100, 0), 0);
check("预测准确率（偏差率16.67）", F.accuracy(100 / 6), 100 - 100 / 6);
check("预测准确率（偏差率300）→ 0 钳制非负", F.accuracy(300), 0);
check("预测准确率（偏差率300）不为负", F.accuracy(300) >= 0, true);
// ── 4. 谈判达成率（v2.1.2 修复④）────────────────────────────────
section("4. 谈判达成率（目标价<底线价口径）");
check("成交=目标价 → 100", F.negRate(90, 100, 90), 100);
check("成交<目标价 → >100 更优", F.negRate(90, 100, 85), 150);
check("成交>底线价 → 负值失败", F.negRate(90, 100, 105), -50);
check("目标价=底线价 → 默认100", F.negRate(90, 90, 95), 100);
check("评价：150 → 超预期", F.negRateLevel(150), "🏆 超预期");
check("评价：100 → 达成（非超预期）", F.negRateLevel(100), "✅ 达成");
check("评价：75 → 基本达成", F.negRateLevel(75), "⚠️ 基本达成");
check("评价：-50 → 未达成", F.negRateLevel(-50), "❌ 未达成");
// ── 5. 风险管理 / 集中度 / 库存 / 降本 / 品类等 ──────────────────
section("5. 风险管理 / HHI / 库存 / 降本 / 品类");
check("RPN 上限（5*5*5）", F.rpn(5, 5, 5), 125);
check("RPN=85 → 高风险", F.rpnLevel(85), "🔴 高风险");
check("RPN=50 → 中风险", F.rpnLevel(50), "🟡 中风险");
check("RPN=20 → 低风险", F.rpnLevel(20), "🟢 低风险");
check("HHI=3800 → 高度集中", F.hhiLevel(3800), "🔴 高度集中（垄断风险）");
check("依赖度=75 → 过度依赖", F.hhiLevel(75 * 75 + 25 * 25), "🔴 高度集中（垄断风险）"); // 75/25 → 6250
check("可用天数 100/10", F.daysOfStock(100, 10), 10);
check("可用天数 消耗=0 → ∞", F.daysOfStock(100, 0), "∞");
check("补货 安全100/库存50 → 150", F.reorder(100, 50), 150);
check("补货 库存250 → 0", F.reorder(100, 250), 0);
check("建议采购量 MAX 钳制（负值→0）", F.suggestBuy(100, 200, 50), 0);
check("降本率（200→180）", F.costCutRate(200, 180), 10);
check("降本率 原价=0 → 0", F.costCutRate(0, 100), 0);
check("份额 60/200", F.share(60, 200), 30);
check("份额 总额=0 → 0", F.share(60, 0), 0);
check("价格异常（+40%）→ 异常", F.priceAnomaly(140, 100), "⚠️ 价格异常");
check("价格异常（+20%）→ 正常", F.priceAnomaly(120, 100), "正常");
check("卡拉杰克（高支出+高风险→战略型）", F.kraljic(600000, 500000, "高"), "战略型");
check("卡拉杰克（高支出+低风险→杠杆型）", F.kraljic(600000, 500000, "低"), "杠杆型");
check("卡拉杰克（低支出+高风险→瓶颈型）", F.kraljic(400000, 500000, "高"), "瓶颈型");
check("卡拉杰克（低支出+低风险→常规型）", F.kraljic(400000, 500000, "低"), "常规型");
check("卡拉杰克（支出=阈值+高风险→战略型，边界）", F.kraljic(500000, 500000, "高"), "战略型");
// ── 6. 跨文档一致性（table-templates ↔ formulas-automations）───
section("6. 跨文档一致性（防止双份漂移）");
const tt = read("table-templates.md");
const fa = read("formulas-automations.md");
const pl = read("platform-comparison.md");
const sk = read("../SKILL.md");
function docCheck(name, doc, substr) {
  check(`[文档] ${name}`, doc.includes(substr), true);
}
// 修复①⑤：预测偏差率除零保护 + 准确率 MAX 钳制，两文件一致
docCheck("table 预测偏差率含除零保护", tt, "IF(实际需求量 > 0");
docCheck("formulas 预测偏差率含除零保护", fa, "IF(实际需求量 > 0");
docCheck("table 预测准确率含 MAX 钳制", tt, "MAX(0, 100 - 预测偏差率)");
docCheck("formulas 预测准确率含 MAX 钳制", fa, "MAX(0, 100 - 预测偏差率)");
// 修复②：品类策略表前置字段已定义 + 公式引用具体字段名
docCheck("table 品类策略表含「品类阈值（数字）」", tt, "品类阈值（数字）");
docCheck("table 品类策略表含「风险等级」", tt, "| 风险等级 | 单选 | 高 / 中 / 低；卡拉杰克象限");
docCheck("formulas 1.8 引用「品类阈值（数字）」", fa, "品类阈值（数字）");
// 修复③：等级口径两文件统一
docCheck("formulas 1.4 为「绩效评定等级判定」", fa, "绩效评定等级判定（分数口径");
docCheck("table 绩效评定等级映射为分数口径", tt, "绩效评定等级映射（分数口径");
docCheck("platform 对照表已更名并补 C 级", pl, "IF(B2>=60,\"C\",\"D\")");
// 修复④：达成率评价 >100 档位，两文件一致
docCheck("formulas 达成率评价 >100", fa, "IF(谈判达成率 > 100");
docCheck("table 达成率评价 >100", tt, "IF(谈判达成率>100");
// 版本与校验脚本自身
docCheck("SKILL.md 版本为 v2.1.2", sk, "version: 2.1.2");
docCheck("SKILL.md 含公式校验脚本章节", sk, "公式校验脚本");
// ── 汇总 ───────────────────────────────────────────────────────
console.log(`\n${"-".repeat(60)}`);
console.log(`结果：通过 ${pass} / 失败 ${fail}`);
console.log(`${"-".repeat(60)}`);
if (fail > 0) {
  console.log("失败明细：");
  for (const f of fails) console.log(f);
  console.log("\n❌ 公式校验未通过，请检查修复是否完整。\n");
  process.exit(1);
}
console.log("✅ 公式校验全部通过：基线复算正确、边界守得住、跨文档口径一致，逻辑闭环。\n");
process.exit(0);
