/**
 * roadshow_core.mjs — 销售路演成稿「合规」校验核心
 *
 * 这是通用销售路演 skill 的单一事实来源（single source of truth）：
 * CLI（roadshow_check.mjs）与测试 harness（roadshow_test_harness.mjs）
 * 都复用本文件，避免逻辑漂移。
 *
 * 兼容性：纯 ESM，不依赖任何运行时专属 API（无 Deno、无 Node 专属全局），
 * Node.js（≥18，支持 ESM）与 Deno 均可直接 import，实现双运行时支持。
 *
 * 合规 = 满足以下硬规则（规则编号统一口径，与 SKILL.md 对齐）：
 *   规则① 八模块标题齐全
 *   规则② 高频&尖锐问题应答库覆盖 12 个硬性主题
 *   规则③ 关键业务字段已出现且填了实值（非占位符）
 *   规则④ 成稿不得残留任何未填占位符（【需补】/TODO 等；普通"待补充"为合法标注）
 *   规则⑤ 反编造：声明数据缺失却给具体价格/资质/起订量承诺 → 拦
 *   规则⑥ 竞品对比定量化（软校验，提示不阻断）
 *
 * v1.7.1：内置中/英双词表（REQUIRED_SECTIONS_EN / REQUIRED_QA_TOPICS_EN / KEY_FIELDS_EN）
 *   与 detectLang() 自动检测——纯英文成稿按英文词表校验，双语版（含中文模块标题）
 *   仍走中文词表，互不影响；validateRoadshow(text, { lang }) 可用 --lang 强制指定。
 */

// ── 合规规则常量 ───────────────────────────────────────────────

// 八模块：用"特征片段"匹配，容忍时长变化（如【20分钟口语化完整路演讲稿】）
export const REQUIRED_SECTIONS = [
  ["本次路演核心目标", "【本次路演核心目标】"],
  ["客户细分品类定位&业务侧重点", "【客户细分品类定位"],
  ["参会角色关注点拆解", "【参会角色关注点拆解】"],
  ["口语化完整路演讲稿", "口语化完整路演讲稿"],
  ["PPT大纲", "【PPT大纲"],
  ["高频&尖锐问题应答库", "【高频&尖锐问题应答库】"],
  ["路演风险预警、临场应对方案", "【路演风险预警"],
  ["路演结束后采购侧跟进动作清单", "【路演结束后采购侧跟进动作清单】"],
];

// 12 个硬性必覆盖问答主题（子串匹配，容忍加粗/标点差异）
export const REQUIRED_QA_TOPICS = [
  "价格",
  "交期",
  "最小起订量",
  "资质合规",
  "样品打样",
  "供货稳定性",
  "竞品对比",
  "售后",
  "知识产权保密",
  "食品安全风险",
  "账期",
  "降本量化测算",
];

// ── v1.7.1 英文模式词表 ───────────────────────────────────────
// 模块/主题/字段沿用中文规范名作为 key（missing 列表口径统一，CLI/harness 断言不受语言影响），
// 第二个元素为英文匹配片段；英文匹配一律大小写不敏感。
// 片段取自 references/english-mode.md 第二节「八模块中英文对照」的官方译名，并做容错缩短：
//   如 "Verbal Script" 可命中 "Full Verbal Script (15 min)"，时长变化不影响。
export const REQUIRED_SECTIONS_EN = [
  ["本次路演核心目标", "Core Objective"],
  ["客户细分品类定位&业务侧重点", "Category Positioning"],
  ["参会角色关注点拆解", "Stakeholder Concerns"],
  ["口语化完整路演讲稿", "Verbal Script"],
  ["PPT大纲", "PPT Outline"],
  ["高频&尖锐问题应答库", "Q&A Bank"],
  ["路演风险预警、临场应对方案", "Risk Alerts"],
  ["路演结束后采购侧跟进动作清单", "Follow-up Action Checklist"],
];

export const REQUIRED_QA_TOPICS_EN = [
  ["价格", "price"],
  ["交期", "lead time"],
  ["最小起订量", "moq"],
  ["资质合规", "compliance"],
  ["样品打样", "sampling"],
  ["供货稳定性", "supply stability"],
  ["竞品对比", "competitor comparison"],
  ["售后", "after-sales"],
  ["知识产权保密", "ip protection"],
  ["食品安全风险", "product safety"],
  ["账期", "payment terms"],
  ["降本量化测算", "cost saving"],
];

export const KEY_FIELDS_EN = [
  ["核心卖点", "selling point"],
  ["价格", "price"],
  ["最小起订量", "moq"],
  ["资质合规", "compliance"],
  ["交期", "lead time"],
  ["供货稳定性", "supply stability"],
];

/**
 * 语言检测（v1.7.1）：explicit（--lang en/zh）优先；否则自动判定——
 * 中文模块片段命中数 >= 英文命中数 → zh（双语版含中文标题，恒走中文词表）；
 * 仅当英文片段明显占优（纯英文成稿）才切 en。空文本/无法判定 → zh（按原口径报缺失）。
 */
export function detectLang(text, explicit) {
  if (explicit === "en" || explicit === "zh") return explicit;
  let zhHits = 0;
  for (const [, frag] of REQUIRED_SECTIONS) {
    if (text.includes(frag)) zhHits++;
  }
  let enHits = 0;
  const lower = text.toLowerCase();
  for (const [, frag] of REQUIRED_SECTIONS_EN) {
    if (lower.includes(frag.toLowerCase())) enHits++;
  }
  return enHits > zhHits ? "en" : "zh";
}

// 关键业务字段防漏填：必须"已在成稿中体现且填了实值"
export const KEY_FIELDS = [
  "核心卖点",
  "价格",
  "最小起订量",
  "资质合规",
  "交期",
  "供货稳定性",
];

// 未填实值的占位符标记（成稿中不应残留）
// 用开括号形式 "【需补" 以同时命中 【需补】 与 【需补：xxx】
// v1.7.1 精确化两处（避免死循环/误伤）：
//  - 裸 "待补" → "【待补"：普通"待补充"是 Step 5A 认可的诚实标注（竞品数据拿不到
//    就填"待补充"，绝不编数），必须合法放行；只有"【待补充】"这类标记形式才拦截。
//  - 裸 "XXX" → "【XXX" / "XX公司"：避免误伤 "XXX-2000" 这类正常型号/编号写法。
export const PLACEHOLDER_TOKENS = [
  "【需补",
  "【缺失",
  "【待填",
  "【待补",
  "未提供",
  "未填写",
  "TODO",
  "【XXX",
  "XX公司",
];

// ── 反编造（规则⑤）相关常量 ───────────────────────────────────
// 缺失数据的"自我声明"短语（严格集合，避免误命中正例/标注示例）。
// 不用 "缺数据"（会命中正例里的"缺数据流程"），也不用含"未提供"的短语
// （会与上方占位符 token 重叠），以免误伤。
export const MISSING_DECL_TOKENS = [
  "以下信息缺失",
  "信息待补充",
  "信息缺失待补",
  "数据尚缺",
  "信息不全，禁止编造",
];

// 具体承诺信号：价格金额 / 资质断言 / 起订量数量
const PRICE_RE = /[¥￥]\s?\d|\d+\s?(?:元|元\/|元每|\/kg|\/吨|\/件|\/套|\/台)/;
const CERT_RE =
  /已获|持有|取得|通过.*(?:认证|许可|资质)|(?:认证|许可|资质)齐全/;
const MOQ_RE = /\d+\s?(?:kg|吨|件|套|席|个|台|瓶|箱)\b/;

// ── 校验函数 ───────────────────────────────────────────────────

export function checkSections(text, lang = "zh") {
  const missing = [];
  const set = lang === "en" ? REQUIRED_SECTIONS_EN : REQUIRED_SECTIONS;
  const lower = lang === "en" ? text.toLowerCase() : null;
  for (const [name, frag] of set) {
    const hit = lang === "en"
      ? lower.includes(frag.toLowerCase())
      : text.includes(frag);
    if (!hit) missing.push(name);
  }
  return { ok: missing.length === 0, missing };
}

export function checkQaTopics(text, lang = "zh") {
  const missing = [];
  if (lang === "en") {
    const lower = text.toLowerCase();
    for (const [name, frag] of REQUIRED_QA_TOPICS_EN) {
      if (!lower.includes(frag)) missing.push(name);
    }
    return { ok: missing.length === 0, missing };
  }
  for (const t of REQUIRED_QA_TOPICS) {
    if (!text.includes(t)) missing.push(t);
  }
  return { ok: missing.length === 0, missing };
}

// 关键业务字段防漏填：字段必须出现，且其首次出现后的一小段内没有占位符
export function checkKeyFields(text, lang = "zh") {
  const unfilled = [];
  if (lang === "en") {
    const lower = text.toLowerCase();
    const tokens = PLACEHOLDER_TOKENS.map((t) => t.toLowerCase());
    for (const [name, frag] of KEY_FIELDS_EN) {
      const idx = lower.indexOf(frag);
      if (idx < 0) {
        unfilled.push(`${name}（成稿中未出现）`);
        continue;
      }
      const window = lower.slice(idx, idx + 80);
      const leaked = tokens.some((tok) => window.includes(tok));
      if (leaked) unfilled.push(`${name}（出现但仍是占位符，未填实值）`);
    }
    return { ok: unfilled.length === 0, unfilled };
  }
  for (const f of KEY_FIELDS) {
    const idx = text.indexOf(f);
    if (idx < 0) {
      unfilled.push(`${f}（成稿中未出现）`);
      continue;
    }
    // 检查命中位置之后 80 字符内是否仍残留占位符 → 视为"未填实值"
    const window = text.slice(idx, idx + 80);
    const leaked = PLACEHOLDER_TOKENS.some((tok) => window.includes(tok));
    if (leaked) unfilled.push(`${f}（出现但仍是占位符，未填实值）`);
  }
  return { ok: unfilled.length === 0, unfilled };
}

// 成稿不应残留任何未填占位符（英文模式按大小写不敏感匹配）
export function checkPlaceholders(text, lang = "zh") {
  const hits = [];
  if (lang === "en") {
    const lower = text.toLowerCase();
    for (const tok of PLACEHOLDER_TOKENS) {
      if (lower.includes(tok.toLowerCase())) hits.push(tok);
    }
    return { ok: hits.length === 0, hits };
  }
  for (const tok of PLACEHOLDER_TOKENS) {
    if (text.includes(tok)) hits.push(tok);
  }
  return { ok: hits.length === 0, hits };
}

/**
 * 反编造检查（规则⑤）。检测"编造矛盾"：成稿自我声明数据缺失，
 * 却又给出具体价格/资质/起订量承诺、且未用【需补】标记空缺。
 * 仅当三者同时成立才判违规，避免误伤正常成稿与已标注的虚构示例。
 * 注意：缺失声明短语目前仅覆盖中文口径（MISSING_DECL_TOKENS），
 * 英文稿由"英文朗读单测 + 中英数据一致性"人工检查兜底（见 english-mode.md）。
 */
export function checkAntiFabrication(text) {
  const notes = [];
  const declaredMissing = MISSING_DECL_TOKENS.some((t) => text.includes(t));
  if (!declaredMissing) return { ok: true, notes };
  const hasCommitment = PRICE_RE.test(text) || CERT_RE.test(text) ||
    MOQ_RE.test(text);
  const hasPlaceholder = PLACEHOLDER_TOKENS.some((t) => text.includes(t));
  if (hasCommitment && !hasPlaceholder) {
    notes.push(
      "声明数据缺失，却给出具体价格/资质/起订量且无【需补】标记（疑似编造）",
    );
  }
  return { ok: notes.length === 0, notes };
}

// ── 竞品对比定量化（规则⑥，v1.1 软校验）────────────────────────
// 目的：拦截"竞品对比"主题的定性空话（无数字、无"待补充"标注），
// 提示按 competitor-comparison.md 补数据。软校验不阻断发货。
const COMPETITOR_MARK = "竞品对比";
// 竞品对比段落到下一个主题关键词为止（避免把"售后：24h"的数字误算进竞品段）
const NEXT_TOPIC_RE = /售后|知识产权|食品安全|账期|降本/;
// 数字信号：阿拉伯数字 / 百分号 / 常用量词（避免过宽字符如"价/人/级"误判）
const QUANT_SIGNAL_RE =
  /\d|%|％|元|公斤|kg|吨|件|套|台|席|瓶|箱|周|月|小时|h|倍|㎡|条产线/;
// 诚实标注信号：明确承认竞品数据缺失
const HONEST_SIGNAL = [
  "待补充",
  "需补充",
  "待核实",
  "待确认",
  "未公开",
  "来源",
];

// v1.7.1 英文口径：竞品对比标记 / 下一主题边界 / 诚实标注信号
const COMPETITOR_MARK_EN = "competitor comparison";
const NEXT_TOPIC_EN_RE =
  /after-sales|after sales|ip protection|product safety|payment terms|cost saving/;
const HONEST_SIGNAL_EN = [
  "to be confirmed",
  "to be added",
  "to be provided",
  "to be updated",
  "tbc",
  "pending",
  "source",
];

/** 竞品对比定量化软校验（规则⑥）：返回警告列表；ok=false 仅表示"有改进建议"。 */
export function checkCompetitorQuantified(text, lang = "zh") {
  const notes = [];
  if (lang === "en") {
    const lower = text.toLowerCase();
    const idx = lower.indexOf(COMPETITOR_MARK_EN);
    if (idx < 0) return { ok: true, notes }; // 主题缺失由 checkQaTopics 硬拦
    const rest = lower.slice(idx);
    const m = NEXT_TOPIC_EN_RE.exec(rest.slice(1));
    const end = m ? 1 + m.index : Math.min(rest.length, 600);
    const window = rest.slice(0, end);
    const hasQuant = /\d|%/.test(window);
    const hasHonest = HONEST_SIGNAL_EN.some((t) => window.includes(t));
    if (!hasQuant && !hasHonest) {
      notes.push(
        "Competitor comparison is qualitative only (no numbers, no 'to be confirmed' marker); add competitor data or mark it honestly (see references/competitor-comparison.md)",
      );
    }
    return { ok: notes.length === 0, notes };
  }
  const idx = text.indexOf(COMPETITOR_MARK);
  if (idx < 0) return { ok: true, notes }; // 主题缺失由 checkQaTopics 硬拦
  const rest = text.slice(idx);
  const m = NEXT_TOPIC_RE.exec(rest.slice(1)); // 从"竞品对比"之后找下一主题
  const end = m ? 1 + m.index : Math.min(rest.length, 500);
  const window = rest.slice(0, end);
  const hasQuant = QUANT_SIGNAL_RE.test(window);
  const hasHonest = HONEST_SIGNAL.some((t) => window.includes(t));
  if (!hasQuant && !hasHonest) {
    notes.push(
      "竞品对比为定性空话（无具体数字且无'待补充'标注），建议补竞品数据或标注待补充（见 references/competitor-comparison.md）",
    );
  }
  return { ok: notes.length === 0, notes };
}

/** 对一份路演成稿做完整合规校验，返回结构化结果（含检测到的语言 lang）。 */
export function validateRoadshow(text, opts = {}) {
  const lang = detectLang(text, opts.lang);
  const sections = checkSections(text, lang);
  const qaTopics = checkQaTopics(text, lang);
  const keyFields = checkKeyFields(text, lang);
  const placeholders = checkPlaceholders(text, lang);
  const antiFabrication = checkAntiFabrication(text);
  const competitorQuantified = checkCompetitorQuantified(text, lang);
  // 注意：competitorQuantified 是软校验（建议），不参与 passed，避免误伤既有合规稿
  const passed = sections.ok &&
    qaTopics.ok &&
    keyFields.ok &&
    placeholders.ok &&
    antiFabrication.ok;
  return {
    lang,
    sections,
    qaTopics,
    keyFields,
    placeholders,
    antiFabrication,
    competitorQuantified,
    passed,
  };
}
// ── 复盘纪要模式（「路演复盘纪要」）合规校验 ─────────────────────
// 输入：线上路演（Teams/Zoom）转写稿文本；输出三部分：
//   ① 结构化会议纪要（决策/未决/分歧点，区分事实与待确认）
//   ② 内容落点对照（每项对应到技能八模块中的哪个模块）
//   ③ 行动项清单（负责人/时限/优先级，可联动跟进清单）
// 铁律：无数据不编造，缺失信息标注「待确认」（不视为占位符泄露）。

// 三部分标题（子串匹配）
export const MEETING_PARTS = [
  ["结构化会议纪要", "结构化会议纪要"],
  ["内容落点对照", "内容落点对照"],
  ["行动项清单", "行动项清单"],
];

// ① 结构化会议纪要：必须出现「决策/未决/分歧」三类点，且区分「事实 / 待确认」
export const MEETING_DECISION_MARKERS = [
  "决策",
  "未决",
  "分歧",
  "事实",
  "待确认",
];

// ③ 行动项清单：必须给出负责人 / 时限 / 优先级
export const MEETING_ACTION_MARKERS = ["负责人", "时限", "优先级"];

// ② 内容落点对照：应映射到八模块（至少命中 1 个模块名）
export const MEETING_MODULE_REFS = [
  "本次路演核心目标",
  "客户细分品类定位",
  "参会角色关注点",
  "路演讲稿",
  "PPT大纲",
  "高频&尖锐问题应答库",
  "路演风险预警",
  "跟进动作清单",
];

export function checkMeetingParts(text) {
  const missing = [];
  for (const [name, frag] of MEETING_PARTS) {
    if (!text.includes(frag)) missing.push(name);
  }
  return { ok: missing.length === 0, missing };
}

export function checkMeetingDecisionMarkers(text) {
  const missing = [];
  for (const m of MEETING_DECISION_MARKERS) {
    if (!text.includes(m)) missing.push(m);
  }
  return { ok: missing.length === 0, missing };
}

export function checkMeetingActionMarkers(text) {
  const missing = [];
  for (const m of MEETING_ACTION_MARKERS) {
    if (!text.includes(m)) missing.push(m);
  }
  return { ok: missing.length === 0, missing };
}

export function checkMeetingModuleRefs(text) {
  const found = MEETING_MODULE_REFS.filter((m) => text.includes(m));
  return { ok: found.length > 0, found, missing: MEETING_MODULE_REFS.filter((m) => !text.includes(m)) };
}

/** 对一份「路演复盘纪要」做合规校验，返回结构化结果。 */
export function validateMeetingMinutes(text) {
  const parts = checkMeetingParts(text);
  const decision = checkMeetingDecisionMarkers(text);
  const actions = checkMeetingActionMarkers(text);
  const moduleRefs = checkMeetingModuleRefs(text);
  const placeholders = checkPlaceholders(text); // 「待确认」不在占位符 token 中，允许
  const passed = parts.ok && decision.ok && actions.ok && moduleRefs.ok && placeholders.ok;
  return { parts, decision, actions, moduleRefs, placeholders, passed };
}
