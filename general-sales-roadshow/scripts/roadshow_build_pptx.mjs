#!/usr/bin/env -S deno run --allow-read --allow-write
/**
 * roadshow_build_pptx.mjs — 销售路演成稿 → .pptx 技能内直出（v1.5）
 *
 * 背景：v1.3 只能导出 PPT 渲染大纲（pptx_outline.md），再交给外部 PPT 技能
 *       渲染为 .pptx，链路较长。v1.5 起技能内直接渲染 .pptx：不再依赖外部
 *       PPT 技能，一个命令产出可打开的演示文稿。
 *
 * 用法（Node.js 或 Deno 均可）：
 *   node scripts/roadshow_build_pptx.mjs <路演成稿.md> [输出目录]
 *   deno run --allow-read --allow-write scripts/roadshow_build_pptx.mjs <路演成稿.md> [输出目录]
 *
 * 行为：
 *   - 先对成稿做合规校验（validateRoadshow）；八模块不全则拒绝导出（exit 1），
 *     与大纲导出同一把闸，保证「PPTX 只从合规成稿生成」。
 *   - 页面内容与 `roadshow_export_core.mjs` 的大纲完全同源（复用 buildPptxOutline），
 *     杜绝大纲与 PPTX 内容漂移。
 *   - 竞品对比页：有竞品表→原生表格；有雷达图数据→pptxgenjs 原生雷达图（chart）。
 *   - 默认输出到成稿同目录 `<成稿名>.pptx`，或第二个参数指定输出目录。
 *
 * 零外部依赖说明：渲染引擎 `vendor/pptxgen.standalone.cjs` 已用 esbuild 打包
 *   为自包含单文件（含 JSZip 等全部依赖），无需 npm install，Node ≥18 与 Deno
 *   均可运行。本脚本不访问网络。
 *
 * 退出码：成功 0；成稿不合规 / 读取失败 / 渲染失败 1。
 */

import { fileURLToPath } from "node:url";
import { validateRoadshow } from "./roadshow_core.mjs";
import {
  buildPptxOutline,
  extractMarkdownTable,
  extractRadarData,
} from "./roadshow_export_core.mjs";
import { createRequire } from "node:module";

// ── 双运行时适配层 ─────────────────────────────────────────────
const isDeno = typeof Deno !== "undefined";

async function readTextFile(path) {
  if (isDeno) return await Deno.readTextFile(path);
  const fs = await import("node:fs/promises");
  return await fs.readFile(path, "utf8");
}

async function writeFileBytes(path, buf) {
  if (isDeno) {
    await Deno.mkdir(path.split("/").slice(0, -1).join("/") || ".", {
      recursive: true,
    });
    await Deno.writeFile(path, buf);
    return;
  }
  const fs = await import("node:fs/promises");
  const pathObj = await import("node:path");
  await fs.mkdir(pathObj.dirname(path), { recursive: true });
  await fs.writeFile(path, buf);
}

function exit(code) {
  if (isDeno) Deno.exit(code);
  process.exit(code);
}

function getArgs() {
  if (isDeno) return Deno.args;
  return process.argv.slice(2);
}

// 加载自包含渲染引擎（双运行时：createRequire 兼容 Node 与 Deno）
const require = createRequire(import.meta.url);
const PptxGenJS = require("./vendor/pptxgen.standalone.cjs");

// ── 主题配色（商务极简：深蓝 + 白，与大纲建议一致）────────────────
const THEME = {
  primary: "1F4E8C", // 深蓝
  secondary: "E07B39", // 强调橙
  dark: "1A1A1A",
  gray: "666666",
  light: "F2F6FB",
  white: "FFFFFF",
};

// ── 大纲解析：把 buildPptxOutline 输出的 markdown 大纲切分为页 ──
function parseOutlinePages(outline) {
  const lines = outline.split("\n");
  const pages = [];
  let cur = null;
  for (const line of lines) {
    const m = line.match(/^## 第 (\d+) 页 · (.+?)（(.+?)）$/);
    if (m) {
      cur = { num: Number(m[1]), title: m[2], type: m[3], lines: [] };
      pages.push(cur);
    } else if (cur) {
      cur.lines.push(line);
    }
  }
  return pages;
}

/** 从大纲页中提取"要点"文本行（- 要点：… / - 01 … / - 编号… / 纯列表项）。 */
function extractBulletsFromPage(page) {
  const out = [];
  for (const l of page.lines) {
    const t = l.trim();
    if (!t || t.startsWith("```")) continue;
    let m = t.match(/^-\s*要点：\s*(.+)$/);
    if (m) { out.push(m[1].trim()); continue; }
    m = t.match(/^-\s*(.+)$/);
    if (m) {
      const v = m[1].trim();
      if (v && !v.startsWith("备注") && !v.startsWith("说明") && !v.startsWith("表格") &&
          !v.startsWith("雷达图") && !v.startsWith("```")) out.push(v);
    }
  }
  return out;
}

/** markdown 表格 → pptxgenjs 表格行（去分隔行、去 ** 强调）。 */
function mdTableToRows(mdTable) {
  const rows = mdTable
    .split("\n")
    .filter((l) => l.trim().startsWith("|"))
    .map((l) =>
      l
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim().replace(/\*\*/g, "")),
    )
    .filter((r) => !(r.length && r.every((c) => /^:?-{2,}:?$/.test(c))));
  return rows;
}

/**
 * 由合规成稿构建并写出 .pptx 文件。
 * @returns {Promise<{ ok, path, warnings }>}
 */
export async function buildPptx(text, input, outDir) {
  const warnings = [];

  // 内容与大纲同源（无漂移）：大纲结构 + 成稿雷达数据/竞品表
  const { outline } = buildPptxOutline(text);
  const radar = extractRadarData(text);
  const table = extractMarkdownTable(text);
  const pages = parseOutlinePages(outline);

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: 13.33, height: 7.5 });
  pptx.layout = "WIDE";
  pptx.author = "通用销售路演顾问";
  pptx.company = "General Sales Roadshow";
  pptx.subject = "B2B 销售路演方案";
  pptx.title = "销售路演方案";

  const bulletFont = { face: "Microsoft YaHei", size: 15, color: THEME.dark };

  for (const page of pages) {
    const slide = pptx.addSlide();
    slide.background = { color: THEME.white };

    // 页眉：页序号 + 标题 + 主题色横条
    slide.addShape("rect", { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: THEME.primary } });
    slide.addText(`0${page.num}`.slice(-2), {
      x: 0.5, y: 0.32, w: 0.8, h: 0.6, fontSize: 13, color: THEME.gray, bold: true,
    });
    slide.addText(page.title, {
      x: 1.3, y: 0.3, w: 10.5, h: 0.6, fontSize: 24, color: THEME.primary, bold: true,
    });
    slide.addShape("line", { x: 1.3, y: 1.0, w: 10.7, h: 0, line: { color: "D8DEE8", width: 1 } });

    const bullets = extractBulletsFromPage(page);

    if (page.type === "封面页") {
      const coreTitle = bullets.find((b) => b.includes("主标题"))?.replace(/^主标题：/, "") ||
        (bullets[0] ? bullets[0].replace(/^主标题：/, "") : "销售路演方案");
      const sub = bullets.find((b) => b.includes("副标题"))?.replace(/^副标题：/, "") || "";
      slide.addText(coreTitle, {
        x: 1.5, y: 2.4, w: 10.3, h: 1.6, fontSize: 40, bold: true, color: THEME.primary, align: "center",
      });
      if (sub) slide.addText(sub, {
        x: 1.5, y: 4.1, w: 10.3, h: 0.8, fontSize: 18, color: THEME.gray, align: "center",
      });
      slide.addText("通用销售路演顾问 · 竞品多维对比 · 风险预警 · 跟进清单", {
        x: 1.5, y: 6.4, w: 10.3, h: 0.5, fontSize: 12, color: THEME.gray, align: "center",
      });
    } else if (page.type === "目录页") {
      const items = bullets.filter((b) => /^\d{2}\s/.test(b));
      slide.addText(items.map((b, i) => ({ text: b, options: bulletFont })), {
        x: 1.6, y: 1.5, w: 10, h: 5.2, lineSpacing: 26, valign: "top",
      });
    } else if (page.type === "结尾页") {
      slide.addText("感谢聆听，期待下一步合作", {
        x: 1.5, y: 2.6, w: 10.3, h: 1.2, fontSize: 32, bold: true, color: THEME.primary, align: "center",
      });
      const last = bullets.find((b) => b.includes("行动承诺") || b.includes("补充"));
      if (last) slide.addText(last.replace(/^补充：/, "").replace(/^行动承诺：/, ""), {
        x: 1.5, y: 4.2, w: 10.3, h: 0.8, fontSize: 16, color: THEME.dark, align: "center",
      });
    } else if (page.type === "表格页") {
      // 竞品对比表格页：表格 + 雷达图（有则）
      let y = 1.3;
      if (table) {
        const rows = mdTableToRows(table);
        if (rows.length) {
          const colW = 13.33 - 1.2 * 2;
          slide.addTable(
            rows.map((r, ri) =>
              r.map((c) => ({
                text: c,
                options: {
                  bold: ri === 0,
                  fontSize: 11,
                  color: ri === 0 ? THEME.white : THEME.dark,
                  fill: { color: ri === 0 ? THEME.primary : (ri % 2 ? THEME.light : THEME.white) },
                },
              })),
            ),
            { x: 1.2, y: 1.25, w: colW, colW: rows[0].map(() => colW / rows[0].length), border: { color: "D8DEE8" } },
          );
          y = 1.25 + Math.min(rows.length, 6) * 0.55 + 0.2;
        }
      }
      if (radar && Array.isArray(radar.series) && radar.series.length) {
        // v1.7.1：系列数超上限（4）时明确截断并提示，避免引擎侧无声丢系列
        const seriesList = radar.series.slice(0, 4);
        if (radar.series.length > 4) {
          warnings.push(
            `竞品雷达图系列数 ${radar.series.length} 超过渲染上限 4，仅渲染前 4 个系列（我方+竞品A/B/C），其余已截断`,
          );
        }
        const chartData = seriesList.map((s) => ({
          name: s.name,
          labels: radar.dimensions,
          values: Array.isArray(s.scores) ? s.scores : Array.isArray(s.values) ? s.values : [],
        }));
        slide.addChart(pptx.ChartType.radar, chartData, {
          x: 1.2, y: Math.min(y, 1.4), w: 10.9, h: Math.max(4.2, 6.4 - y),
          chartColors: ["1F4E8C", "E07B39", "3A8F5F", "7A4FA3"],
          showLegend: true, showTitle: true, showValue: false,
          title: "竞品多维对比雷达图",
          catAxisLabelColor: THEME.dark,
          valAxisLabelColor: THEME.gray,
        });
        warnings.push("竞品对比页：表格 + 雷达图已直出（雷达数据来自成稿 JSON 块）");
      } else if (!table) {
        slide.addText("竞品参数暂缺 → 标注「待补充」，承诺会后补数据，不给定性空话。", {
          x: 1.2, y: 1.6, w: 10.9, h: 0.8, fontSize: 16, color: THEME.gray,
        });
      }
    } else {
      // 内容页：要点列表
      if (bullets.length) {
        slide.addText(bullets.map((b) => ({ text: b.replace(/^要点：/, ""), options: bulletFont })), {
          x: 1.2, y: 1.3, w: 10.9, h: 5.5, lineSpacing: 22, valign: "top",
        });
      }
    }

    // 页脚
    slide.addText(`通用销售路演顾问 · 第 ${page.num} 页`, {
      x: 0.5, y: 7.1, w: 6, h: 0.3, fontSize: 9, color: "AAAAAA",
    });
  }

  // 输出路径：默认成稿同目录 <成稿名>.pptx；否则输出目录 + 同名
  const baseName = input.replace(/\.[^.]+$/, "").split("/").pop();
  let outPath;
  if (outDir) {
    outPath = `${outDir.replace(/\/$/, "")}/${baseName}.pptx`;
  } else {
    outPath = input.replace(/\.[^.]+$/, "") + ".pptx";
  }

  const buf = await pptx.write({ outputType: "nodebuffer" });
  await writeFileBytes(outPath, Buffer.from(buf));
  return { ok: true, path: outPath, warnings };
}

async function main() {
  const args = getArgs();
  const input = args[0];
  const outDir = args[1] ?? null;

  if (!input) {
    console.error(
      "用法：node scripts/roadshow_build_pptx.mjs <路演成稿.md> [输出目录]",
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

  // 合规把关：与大纲导出同一把闸
  const r = validateRoadshow(text);
  if (!r.passed) {
    console.error("❌ 成稿未通过合规校验，拒绝导出 .pptx。请先修复以下问题：");
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

  try {
    const { path, warnings } = await buildPptx(text, input, outDir);
    console.log(`✅ 已技能内直出 .pptx：${path}`);
    console.log(`   页数结构：封面 / 目录 / 八模块 / 竞品对比（含表格·雷达图）/ 结尾`);
    if (warnings.length) {
      console.log("ℹ️ 说明：");
      for (const w of warnings) console.log(`  - ${w}`);
    }
    exit(0);
  } catch (e) {
    console.error(`❌ .pptx 渲染失败：${e.message}`);
    exit(1);
  }
}

// 仅当作为主模块直接运行时才执行 CLI；被 harness import 时不触发
const isMain = isDeno
  ? import.meta.main
  : process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main();
}
