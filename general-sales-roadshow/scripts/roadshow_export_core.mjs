/**
 * roadshow_export_core.mjs — 销售路演成稿 → PPT 渲染大纲导出核心（v1.3）
 *
 * 职责：读取一份合规路演成稿(.md)，自动解析八模块内容，生成「PPT 渲染大纲」
 * （pptx_outline.md）——按页组织、带真实内容（含竞品定量表 + 雷达图数据块）
 * 的大纲，可直接交给 PPT 生成技能（如 create-ppt）渲染为 .pptx。
 *
 * 与 roadshow_core.mjs 的关系：
 *   - 模块标记（REQUIRED_SECTIONS）直接 import 自 roadshow_core.mjs，单一事实来源，不重复定义；
 *   - 本文件只做「内容重组」；是否允许导出由调用方用 validateRoadshow() 把关（CLI 默认把关）。
 *
 * 兼容性：纯 ESM，不依赖 Node/Deno 专属全局，双运行时可直接 import。
 */

import {
  REQUIRED_SECTIONS,
  REQUIRED_SECTIONS_EN,
  detectLang,
} from "./roadshow_core.mjs";
import { renderRadarSVG } from "./roadshow_radar_svg.mjs";

// ── 页面类型常量 ───────────────────────────────────────────────
export const PAGE_TYPES = [
  "封面页",
  "目录页",
  "内容页",
  "表格页",
  "图表页",
  "结尾页",
];

// 讲稿要点：优先取加粗强调句（**…**），不足则用首句补齐
const BOLD_RE = /\*\*([^*]+)\*\*/g;
const SENTENCE_SPLIT_RE = /(?<=[。！？；\n])|(?<=\n)/;

// ── 模块解析 ───────────────────────────────────────────────────
/**
 * 按八模块标记切分成稿正文，返回 { title, modules: {name: 内容字符串} }。
 * v1.7.1：自动检测语言——纯英文成稿按英文模块标题切分（key 仍为中文规范名，
 * 保证下游取用与警告口径统一）；双语版/中文稿按中文标记切分，行为不变。
 * 未出现的模块内容为空字符串，不报错（由调用方结合 validate 判定）。
 */
export function parseModules(text) {
  const lang = detectLang(text);
  const sections = lang === "en" ? REQUIRED_SECTIONS_EN : REQUIRED_SECTIONS;
  const lower = lang === "en" ? text.toLowerCase() : null;
  const positions = [];
  for (const [name, frag] of sections) {
    const idx = lang === "en"
      ? lower.indexOf(frag.toLowerCase())
      : text.indexOf(frag);
    if (idx >= 0) positions.push({ name, frag, idx });
  }
  positions.sort((a, b) => a.idx - b.idx);
  const modules = {};
  for (const [name] of sections) modules[name] = "";
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].idx + positions[i].frag.length;
    const end =
      i + 1 < positions.length
        ? positions[i + 1].idx
        : text.length;
    modules[positions[i].name] = text.slice(start, end).trim();
  }
  return { modules };
}

// ── 结构化内容提取 ─────────────────────────────────────────────
/**
 * 提取整篇文本中的 Markdown 表格块（连续以 | 开头的行），返回字符串或 null。
 * v1.7.1：多表场景按优先级选表——① 表头同时含"我方+竞品"两列（兼容英文
 * ours/competitor）；② 含"维度/Dimension"表头的竞品对比表；③ 无命中返回 null。
 */
export function extractMarkdownTable(text) {
  const lines = text.split("\n");
  const tables = [];
  let cur = [];
  for (const line of lines) {
    if (line.trimStart().startsWith("|")) cur.push(line);
    else if (cur.length) {
      tables.push(cur);
      cur = [];
    }
  }
  if (cur.length) tables.push(cur);
  if (!tables.length) return null;
  const rowHit = (tbl, words) =>
    tbl.some((l) =>
      words.some((w) => l.toLowerCase().includes(w.toLowerCase()))
    );
  const bothCols = tables.filter((t) =>
    rowHit(t, ["我方", "ours"]) && rowHit(t, ["竞品", "competitor"])
  );
  if (bothCols.length) return bothCols[0].join("\n");
  const dimTable = tables.filter((t) => rowHit(t, ["维度", "dimension"]));
  if (dimTable.length) return dimTable[0].join("\n");
  return null;
}

/** 提取文本中的 ```json 代码块列表（返回解析后的对象数组，忽略解析失败的）。 */
export function extractJsonBlocks(text) {
  const out = [];
  const re = /```(?:json)?\s*\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    try {
      out.push(JSON.parse(m[1]));
    } catch {
      /* 忽略非 JSON 或损坏块 */
    }
  }
  return out;
}

/** 从 JSON 块中找雷达图数据块（含 dimensions 字段的），返回对象或 null。 */
export function extractRadarData(text) {
  const blocks = extractJsonBlocks(text);
  return blocks.find((b) => Array.isArray(b.dimensions)) ?? null;
}

/**
 * 从一段文本提取「要点」行，优先级：
 *   1. 已是列表 → 逐行取 - / • 开头条目（最常见，模块多为列表）；
 *   2. 段落文本 → 取加粗强调句（**…**）；
 *   3. 仍不足 → 按句（。！？；/换行）拆分补齐。
 */
export function extractBullets(content, max = 5) {
  const clean = (s) => s.replace(/\*\*/g, "").trim();
  const listItems = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[-•*]/.test(l))
    .map((l) => clean(l.replace(/^[-•*]\s+/, "")))
    .filter((s) => s.length >= 3);
  if (listItems.length) return listItems.slice(0, max);

  const bolds = [];
  let m;
  const re = new RegExp(BOLD_RE.source, "g");
  while ((m = re.exec(content)) !== null) {
    const s = clean(m[1]);
    if (s && !bolds.includes(s)) bolds.push(s);
  }
  const result = bolds.slice(0, max);
  if (result.length < Math.min(3, max)) {
    const sentences = content
      .split(SENTENCE_SPLIT_RE)
      .map((s) => clean(s.replace(/^[-*•\s]+/, "")))
      .filter((s) => s.length >= 4 && !s.startsWith("【"));
    for (const s of sentences) {
      if (result.length >= max) break;
      if (!result.includes(s)) result.push(s);
    }
  }
  return result.slice(0, max);
}

/** 取模块内容第一条「有意义的行」：跳过空行、标题、残留的标记头片段，并去掉列表前缀。 */
export function firstMeaningfulLine(content) {
  for (const raw of content.split("\n")) {
    const l = raw.trim();
    if (!l) continue;
    if (/^[#&>|【】]/.test(l)) continue; // 标题/残留头/表格/块引用
    return l
      .replace(/^[-•*]\s+/, "")
      .replace(/\*\*/g, "")
      .trim();
  }
  return "";
}

/** 提取应答库条目行（- **主题**：应答），取前 max 条，并去除 ** 强调符。 */
export function extractQaLines(content, max = 4) {
  return content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("-") && l.includes("**"))
    .map((l) => l.replace(/\*\*/g, ""))
    .slice(0, max);
}

// ── 大纲构建 ───────────────────────────────────────────────────
/**
 * 由成稿正文构建 PPT 渲染大纲。返回 { ok, outline, warnings }：
 *  - ok：八模块是否齐全（用于调用方决定是否放行导出）
 *  - warnings：缺失模块等提示列表
 */
export function buildPptxOutline(text, opts = {}) {
  const { modules } = parseModules(text);
  const get = (name) => modules[name] || "";
  const warnings = [];

  const required = REQUIRED_SECTIONS.map(([name]) => name);
  const missingModules = required.filter((name) => !get(name));
  const ok = missingModules.length === 0;
  if (!ok) {
    warnings.push(`以下模块缺失，导出的大纲不完整：${missingModules.join("、")}`);
  }

  const radar = extractRadarData(text);
  const table = extractMarkdownTable(text);

  // v1.7.1：雷达图系列数超上限时输出明确截断提示（SVG 与图表仅渲染前 4 系列）
  if (radar && Array.isArray(radar.series) && radar.series.length > 4) {
    warnings.push(
      `雷达图数据块含 ${radar.series.length} 个系列，超过渲染上限 4：SVG/图表仅渲染前 4 个系列（我方+竞品A/B/C），其余已截断，建议精简竞品系列`,
    );
  }

  // 主题短标题：取核心目标第一条有意义行截断
  const coreFirst = firstMeaningfulLine(get("本次路演核心目标")) || "销售路演方案";
  const title = coreFirst.length > 24 ? coreFirst.slice(0, 24) + "…" : coreFirst;

  const lines = [];
  const push = (s = "") => lines.push(s);

  push("# PPT 渲染大纲 · 销售路演方案");
  push("");
  push(`> 自动生成自：本技能导出脚本（v1.3） · 生成日期：${new Date().toISOString().slice(0, 10)}`);
  push(`> 用途：交给 PPT 生成技能（如 create-ppt）按页渲染为 .pptx；也可直接作为手做 PPT 的内容骨架。`);
  push(`> 结构：每页含「页面类型 / 标题 / 要点 / 可选表格·图表 / 讲稿备注」。要点每页 ≤5 条，信息来自成稿八模块，不新增内容。`);
  push("");
  push("## 全局设定");
  push("- 主题：" + title);
  push("- 风格建议：商务极简（深蓝 + 白，正式对客户）；若客户偏好可改为对应行业风格。");
  push("- 页面总数：约 11 页（15 分钟路演，可随时长增减）。");
  push("");

  // 1 封面
  push("## 第 1 页 · 封面（封面页）");
  push("- 主标题：" + title);
  push(`- 副标题：${firstMeaningfulLine(get("客户细分品类定位&业务侧重点")) || "面向目标客户的销售路演"}`);
  push("- 附属信息：我方公司名 · 路演日期（占位，成稿未含则补）");
  push("- 备注：开场前 30 秒用于立住主题，见成稿「核心目标」完整表述。");
  push("");

  // 2 目录
  push("## 第 2 页 · 目录（目录页）");
  push("- 01 本次路演核心目标");
  push("- 02 客户细分品类定位 & 业务侧重点");
  push("- 03 参会角色关注点拆解");
  push("- 04 路演讲稿要点");
  push("- 05 竞品对比定量分析");
  push("- 06 高频&尖锐问题应答精选");
  push("- 07 路演风险预警、临场应对方案");
  push("- 08 路演结束后采购侧跟进动作清单");
  push("- 备注：按此顺序讲，时间分配建议 15 分钟版 2/3/2/2/2/2/1/1。");
  push("");

  // 3 核心目标
  push("## 第 3 页 · 本次路演核心目标（内容页）");
  for (const b of extractBullets(get("本次路演核心目标"), 3)) push("- 要点：" + b);
  push("- 备注：向客户高层明确本场要达成的承诺（拿样/试单/进名录/年度框架/战略合作），一句话说清。");
  push("");

  // 4 品类定位
  push("## 第 4 页 · 客户细分品类定位 & 业务侧重点（内容页）");
  for (const b of extractBullets(get("客户细分品类定位&业务侧重点"), 5)) push("- 要点：" + b);
  push("- 备注：说明我方打法贴合该品类采购决策因子（溯源/合规/产能/交付等），来自 category-playbook 或通用推导。");
  push("");

  // 5 参会角色
  push("## 第 5 页 · 参会角色关注点拆解（内容页）");
  for (const b of extractBullets(get("参会角色关注点拆解"), 5)) push("- 要点：" + b);
  push("- 备注：按到场角色分别回应其关注点（采购/技术/财务/高管），口径与成稿一致。");
  push("");

  // 6 讲稿要点
  push("## 第 6 页 · 路演讲稿要点（内容页）");
  for (const b of extractBullets(get("口语化完整路演讲稿"), 5)) {
    push("- 要点：" + b);
  }
  push("- 备注：本页为口头主张的视觉浓缩；完整逐字讲稿见成稿，上台按讲稿讲。");
  push("");

  // 7 竞品对比
  if (table || radar) {
    const t = table ? "表格页" : "图表页";
    push(`## 第 7 页 · 竞品对比定量分析（${t}）`);
    push("- 说明：竞品数据来自用户提供或公开来源，缺数据标「待补充」，绝不编造。");
    if (table) {
      push("- 表格：");
      for (const l of table.split("\n")) push("  " + l);
    }
    if (radar) {
      push("- 雷达图数据（JSON，可直接渲染对比雷达图）：");
      push("```json");
      push(JSON.stringify(radar, null, 2));
      push("```");
      // v1.4：技能内直出 SVG 雷达图，任何环境打开一致，不再依赖平台图表能力
      const radarSvg = renderRadarSVG(radar);
      if (radarSvg) {
        push("- 雷达图（SVG，v1.4 技能内直出）：保存为 `*_radar.svg` 后可直接预览/嵌入文档，无需平台图表能力；也可用 `node scripts/roadshow_export_pptx.mjs` 一键导出该文件。");
        push("```svg");
        push(radarSvg);
        push("```");
      }
    }
    push("- 备注：讲解时用数字差推导差异化（如交期 15 天 vs 45 天 → 备货资金占用省 60 天）。");
  } else {
    push("## 第 7 页 · 竞品对比定量分析（内容页）");
    push("- 要点：竞品参数暂缺 → 标注「待补充」，承诺会后补数据，不给定性空话。");
    push("- 备注：按 competitor-comparison.md 三通道收口竞品参数后回填本页。");
  }
  push("");

  // 8 应答精选
  push("## 第 8 页 · 高频&尖锐问题应答精选（内容页）");
  const qas = extractQaLines(get("高频&尖锐问题应答库"), 4);
  for (const q of qas) push("- " + q.replace(/^-\s*/, ""));
  push("- 备注：完整 12 主题应答见成稿；本页只放客户最可能当场追问的 3-4 条。");
  push("");

  // 9 风险预警
  push("## 第 9 页 · 路演风险预警、临场应对方案（内容页）");
  const risks = get("路演风险预警、临场应对方案")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("-"));
  for (const r of risks.slice(0, 4)) push("- " + r.replace(/^-\s*/, ""));
  push("- 备注：按「风险→应对」成对讲，体现有预案、不回避。");
  push("");

  // 10 跟进动作
  push("## 第 10 页 · 路演结束后采购侧跟进动作清单（内容页）");
  const acts = get("路演结束后采购侧跟进动作清单")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^\d+[.、]|^-/.test(l));
  for (const a of acts.slice(0, 5)) push("- " + a.replace(/^\d+[.、]\s*/, "").replace(/^-\s*/, ""));
  push("- 备注：当场与客户对齐下一步时限（当日/3日/一周），推动采购流程。");
  push("");

  // 11 结尾
  push("## 第 11 页 · 结尾（结尾页）");
  push("- 结束语：感谢聆听，期待下一步合作。");
  push("- 补充：把「行动承诺」（POC/送样/报价/资质文件）放最后一行，呼应第 3 页目标。");
  push("- 备注：留联系方式与对接人，方便采购侧后续联系。");
  push("");

  return { ok, outline: lines.join("\n"), warnings };
}
