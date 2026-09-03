#!/usr/bin/env -S deno run --allow-read
/**
 * roadshow_check.mjs — 销售路演成稿「合规」CLI 校验器（薄包装，双运行时）
 *
 * 校验逻辑全部来自 roadshow_core.mjs（单一事实来源）。
 *
 * 用法（Node.js 或 Deno 均可）：
 *   node scripts/roadshow_check.mjs <路演成稿.md>
 *   deno run --allow-read scripts/roadshow_check.mjs <路演成稿.md>
 *   （不传路径则默认校验 references/pitch-example.md）
 *
 * 语言（v1.7.1）：
 *   默认自动检测（纯英文成稿按英文词表校验，双语版按中文词表校验）；
 *   可用 --lang en 强制英文词表、--lang zh 锁定中文词表。
 *
 * 退出码：全部通过 0；有缺失 1。
 */

import { fileURLToPath } from "node:url";
import {
  KEY_FIELDS,
  KEY_FIELDS_EN,
  MEETING_ACTION_MARKERS,
  MEETING_DECISION_MARKERS,
  MEETING_MODULE_REFS,
  MEETING_PARTS,
  REQUIRED_QA_TOPICS,
  REQUIRED_QA_TOPICS_EN,
  REQUIRED_SECTIONS,
  REQUIRED_SECTIONS_EN,
  validateMeetingMinutes,
  validateRoadshow,
} from "./roadshow_core.mjs";

// ── 双运行时适配层 ─────────────────────────────────────────────
// 通过检测全局 Deno 判断当前运行时；Node 环境则走 fs/path，Deno 环境走 Deno.*。
const isDeno = typeof Deno !== "undefined";

async function readTextFile(path) {
  if (isDeno) return await Deno.readTextFile(path);
  const fs = await import("node:fs/promises");
  return await fs.readFile(path, "utf8");
}

function exit(code) {
  if (isDeno) Deno.exit(code);
  process.exit(code);
}

function getArgs() {
  if (isDeno) return Deno.args;
  return process.argv.slice(2);
}

// 解析默认校验文件路径（本文件所在目录的 ../references/pitch-example.md）
function defaultTarget() {
  const here = new URL(".", import.meta.url);
  const ref = new URL("../references/pitch-example.md", here);
  return fileURLToPath(ref);
}

async function main() {
  const args = getArgs();
  const isMinutes = args.includes("--minutes");
  // --lang en|zh（v1.7.1）：强制语言词表；不传则由 validateRoadshow 自动检测
  const langFlagIdx = args.indexOf("--lang");
  const langArg = langFlagIdx >= 0 ? args[langFlagIdx + 1] : undefined;
  if (langArg !== undefined && langArg !== "en" && langArg !== "zh") {
    console.error(`❌ --lang 仅支持 en 或 zh，收到：${langArg}`);
    exit(1);
  }
  const path = args.find(
    (a, i) =>
      !a.startsWith("--") && (langFlagIdx < 0 || i !== langFlagIdx + 1),
  ) ?? defaultTarget();

  let text;
  try {
    text = await readTextFile(path);
  } catch (e) {
    console.error(`❌ 无法读取文件: ${path}\n${e.message}`);
    exit(1);
  }

  // 复盘纪要模式（--minutes）：校验三部分结构（不套用八模块成稿规则）
  if (isMinutes) {
    console.log(`\n🔍 校验路演复盘纪要：${path}\n`);
    const m = validateMeetingMinutes(text);

    console.log("【三部分结构】");
    for (const [name] of MEETING_PARTS) {
      console.log(`  ${!m.parts.missing.includes(name) ? "✅" : "❌"} ${name}`);
    }

    console.log("\n【① 结构化会议纪要：决策/未决/分歧 + 事实/待确认】");
    for (const t of MEETING_DECISION_MARKERS) {
      console.log(`  ${!m.decision.missing.includes(t) ? "✅" : "❌"} ${t}`);
    }

    console.log("\n【③ 行动项清单：负责人/时限/优先级】");
    for (const t of MEETING_ACTION_MARKERS) {
      console.log(`  ${!m.actions.missing.includes(t) ? "✅" : "❌"} ${t}`);
    }

    console.log("\n【② 内容落点对照：映射到八模块】");
    console.log(
      `  ${
        m.moduleRefs.ok
          ? `✅ 已映射到模块：${m.moduleRefs.found.join("、")}`
          : `❌ 未映射到任何八模块`
      }`,
    );

    console.log("\n【占位符泄露检查（「待确认」为合法标注，不计入）】");
    console.log(
      `  ${
        m.placeholders.ok
          ? "✅ 无残留占位符（【需补】/TODO 等）"
          : `❌ 残留占位符：${m.placeholders.hits.join("、")}`
      }`,
    );

    if (m.passed) {
      console.log(
        "\n✅ 复盘纪要校验通过：三部分齐全、决策/未决/分歧+事实/待确认到位、行动项齐备、落点已对照八模块。",
      );
      exit(0);
    }
    console.log("\n⚠️ 复盘纪要校验未通过，见上方 ❌ 项。");
    if (m.parts.missing.length) console.log(`缺失部分：${m.parts.missing.join("、")}`);
    if (m.decision.missing.length) console.log(`缺失纪要要素：${m.decision.missing.join("、")}`);
    if (m.actions.missing.length) console.log(`缺失行动项要素：${m.actions.missing.join("、")}`);
    if (!m.moduleRefs.ok) console.log("缺失落点对照映射");
    exit(1);
  }

  console.log(`\n🔍 校验路演成稿：${path}\n`);

  const r = validateRoadshow(text, { lang: langArg });
  const isEn = r.lang === "en";
  const secSet = isEn ? REQUIRED_SECTIONS_EN : REQUIRED_SECTIONS;
  const topicSet = isEn ? REQUIRED_QA_TOPICS_EN : REQUIRED_QA_TOPICS;
  const fieldSet = isEn ? KEY_FIELDS_EN : KEY_FIELDS.map((f) => [f, f]);
  const label = ([name, frag]) => (isEn ? `${frag}（${name}）` : name);
  console.log(
    `🌐 语言模式：${isEn ? "English（英文词表）" : "中文（中文词表）"}${
      langArg ? "（--lang 指定）" : "（自动检测）"
    }\n`,
  );

  console.log("【八模块结构】");
  for (const entry of secSet) {
    console.log(
      `  ${!r.sections.missing.includes(entry[0]) ? "✅" : "❌"} ${label(entry)}`,
    );
  }

  console.log("\n【12 问答主题覆盖】");
  for (const entry of topicSet) {
    const t = isEn ? entry[0] : entry;
    console.log(
      `  ${!r.qaTopics.missing.includes(t) ? "✅" : "❌"} ${isEn ? label(entry) : t}`,
    );
  }

  console.log("\n【关键业务字段防漏填】");
  for (const entry of fieldSet) {
    const ok = !r.keyFields.unfilled.some((u) => u.startsWith(entry[0]));
    console.log(`  ${ok ? "✅" : "❌"} ${isEn ? label(entry) : entry[0]}`);
  }

  console.log("\n【占位符泄露检查】");
  console.log(
    `  ${
      r.placeholders.ok
        ? "✅ 无残留占位符（【需补】/TODO 等）"
        : `❌ 残留占位符：${r.placeholders.hits.join("、")}`
    }`,
  );

  console.log("\n【反编造检查（规则⑤）】");
  console.log(
    `  ${
      r.antiFabrication.ok
        ? "✅ 未发现编造矛盾（声明缺失即有【需补】，或已标注虚构示例）"
        : `❌ ${r.antiFabrication.notes.join("；")}`
    }`,
  );

  console.log("\n【竞品对比定量化（规则⑥，v1.1 软校验）】");
  console.log(
    `  ${
      r.competitorQuantified.ok
        ? "✅ 竞品对比已定量或已标注待补充"
        : `⚠️ ${r.competitorQuantified.notes.join("；")}`
    }`,
  );

  if (r.passed) {
    console.log(
      "\n✅ 校验通过：八模块齐全、12 主题全覆盖、关键字段已填实、无占位符泄露、无编造矛盾。",
    );
    exit(0);
  }
  console.log("\n⚠️ 校验未通过，见上方 ❌ 项。");
  if (r.sections.missing.length) {
    console.log(`缺失模块：${r.sections.missing.join("、")}`);
  }
  if (r.qaTopics.missing.length) {
    console.log(`缺失主题：${r.qaTopics.missing.join("、")}`);
  }
  if (r.keyFields.unfilled.length) {
    console.log(`未填实字段：${r.keyFields.unfilled.join("；")}`);
  }
  if (!r.placeholders.ok) {
    console.log(`残留占位符：${r.placeholders.hits.join("、")}`);
  }
  exit(1);
}

main();
