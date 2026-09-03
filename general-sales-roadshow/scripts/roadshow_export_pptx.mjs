#!/usr/bin/env -S deno run --allow-read --allow-write
/**
 * roadshow_export_pptx.mjs — 销售路演成稿 → PPT 渲染大纲 CLI 导出器（v1.3，双运行时）
 *
 * 用法（Node.js 或 Deno 均可）：
 *   node scripts/roadshow_export_pptx.mjs <路演成稿.md> [输出目录]
 *   deno run --allow-read --allow-write scripts/roadshow_export_pptx.mjs <路演成稿.md> [输出目录]
 *
 * 行为：
 *   - 先对成稿做合规校验（validateRoadshow）；八模块不全则拒绝导出（exit 1），
 *     保证「PPT 大纲只从合规成稿生成」，形成闭环。
 *   - 通过后生成 PPT 渲染大纲，默认输出到成稿同目录 `pptx_outline.md`，
 *     或第二个参数指定输出目录。
 *
 * 退出码：成功 0；成稿不合规 / 读取失败 1。
 */

import { fileURLToPath } from "node:url";
import { validateRoadshow } from "./roadshow_core.mjs";
import {
  buildPptxOutline,
  extractRadarData,
} from "./roadshow_export_core.mjs";
import { renderRadarSVG } from "./roadshow_radar_svg.mjs";

// ── 双运行时适配层 ─────────────────────────────────────────────
const isDeno = typeof Deno !== "undefined";

async function readTextFile(path) {
  if (isDeno) return await Deno.readTextFile(path);
  const fs = await import("node:fs/promises");
  return await fs.readFile(path, "utf8");
}

async function writeTextFile(path, content) {
  if (isDeno) {
    await Deno.mkdir(path.split("/").slice(0, -1).join("/") || ".", {
      recursive: true,
    });
    await Deno.writeTextFile(path, content);
    return;
  }
  const fs = await import("node:fs/promises");
  const pathObj = await import("node:path");
  await fs.mkdir(pathObj.dirname(path), { recursive: true });
  await fs.writeFile(path, content, "utf8");
}

function exit(code) {
  if (isDeno) Deno.exit(code);
  process.exit(code);
}

function getArgs() {
  if (isDeno) return Deno.args;
  return process.argv.slice(2);
}

async function main() {
  const args = getArgs();
  const input = args[0];
  const outDir = args[1] ?? null;

  if (!input) {
    console.error(
      "用法：node scripts/roadshow_export_pptx.mjs <路演成稿.md> [输出目录]",
    );
    exit(1);
  }

  let text;
  try {
    text = await readTextFile(input);
  } catch (e) {
    console.error(`❌ 无法读取成稿: ${input}\n${e.message}`);
    exit(1);
  }

  // 合规把关：PPT 大纲只从合规成稿导出（形成闭环）
  const r = validateRoadshow(text);
  if (!r.passed) {
    console.error("❌ 成稿未通过合规校验，拒绝导出 PPT 大纲。请先修复以下问题：");
    if (r.sections.missing.length)
      console.error(`  - 缺失模块：${r.sections.missing.join("、")}`);
    if (r.qaTopics.missing.length)
      console.error(`  - 缺失问答主题：${r.qaTopics.missing.join("、")}`);
    if (r.keyFields.unfilled.length)
      console.error(`  - 未填实关键字段：${r.keyFields.unfilled.join("；")}`);
    if (!r.placeholders.ok)
      console.error(`  - 残留占位符：${r.placeholders.hits.join("、")}`);
    if (!r.antiFabrication.ok)
      console.error(`  - 反编造：${r.antiFabrication.notes.join("；")}`);
    exit(1);
  }

  const { outline, warnings } = buildPptxOutline(text);

  // 输出路径：默认成稿同目录 pptx_outline.md；否则输出目录 + 同名 _pptx_outline.md
  let outPath;
  if (outDir) {
    const base = input.replace(/\.[^.]+$/, "");
    const name = base.split("/").pop() + "_pptx_outline.md";
    outPath = `${outDir.replace(/\/$/, "")}/${name}`;
  } else {
    outPath = input.replace(/\.[^.]+$/, "") + "_pptx_outline.md";
  }

  await writeTextFile(outPath, outline);

  // v1.4：若成稿含雷达图数据块，额外直出独立 .svg 雷达图文件（零依赖，任何环境可预览）
  let radarSvgPath = null;
  const radar = extractRadarData(text);
  const radarSvg = radar ? renderRadarSVG(radar) : "";
  if (radarSvg) {
    const baseName = input.replace(/\.[^.]+$/, "").split("/").pop();
    radarSvgPath = outDir
      ? `${outDir.replace(/\/$/, "")}/${baseName}_radar.svg`
      : input.replace(/\.[^.]+$/, "") + "_radar.svg";
    await writeTextFile(radarSvgPath, radarSvg);
  }

  console.log(`✅ 已生成 PPT 渲染大纲：${outPath}`);
  console.log(`   页数结构：封面 / 目录 / 八模块 / 竞品对比（含表格·雷达图）/ 结尾`);
  if (radarSvgPath) {
    console.log(`✅ 已直出雷达图：${radarSvgPath}（SVG，可直接预览/嵌入，无需平台图表能力）`);
  }
  if (warnings.length) {
    console.log("⚠️ 提示：");
    for (const w of warnings) console.log(`  - ${w}`);
  }
  exit(0);
}

main();
