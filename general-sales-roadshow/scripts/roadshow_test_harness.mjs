#!/usr/bin/env -S deno run --allow-read
/**
 * roadshow_test_harness.mjs — 通用销售路演 skill「输出合规」测试 harness
 *
 * 用途：用一组预置用例（正向 / 负向 / 边界）验证 skill 产出的成稿
 *       是否满足硬性合规规则（八模块 / 12 主题 / 关键字段 / 占位符 / 反编造）。
 *       不仅断言"通过 or 不通过"，还断言"缺了哪些具体项"，防止误判。
 *
 * 运行（Node.js 或 Deno 均可）：
 *   node scripts/roadshow_test_harness.mjs
 *   deno run --allow-read scripts/roadshow_test_harness.mjs
 * 退出码：全部用例通过 0；任一用例失败 1。
 *
 * 用例构成（v1.7.1）：C01-C25 原有 25 例（正向/负向/边界 + 反编造专项含精确率 +
 * 竞品定量化 + 新增品类 + PPT 导出专项 C18-C20 + 雷达图 SVG 直出专项 C21 +
 * .pptx 技能内直出专项 C22 + 复盘纪要模式专项 C23-C24 + 包装材料三子类专项 C25）；
 * C26-C27 无竞品"待补充"专项（v1.7.1 占位符精确化回归）；C28-C29 纯英文成稿专项
 * （英文词表校验 + 大纲/.pptx 导出全链 + 负向拦截）。
 *
 * 校验逻辑全部来自 roadshow_core.mjs（与 CLI 同源，避免漂移）。
 */
import { fileURLToPath } from "node:url";
import { validateMeetingMinutes, validateRoadshow } from "./roadshow_core.mjs";
import {
  buildPptxOutline,
  extractMarkdownTable,
  extractRadarData,
  parseModules,
} from "./roadshow_export_core.mjs";
import { renderRadarSVG } from "./roadshow_radar_svg.mjs";
import { buildPptx } from "./roadshow_build_pptx.mjs";
// ── 双运行时适配层 ─────────────────────────────────────────────
const isDeno = typeof Deno !== "undefined";
async function readTextFile(path) {
  if (isDeno) return await Deno.readTextFile(path);
  const fs = await import("node:fs/promises");
  return await fs.readFile(path, "utf8");
}
async function readBinary(path) {
  if (isDeno) return await Deno.readFile(path);
  const fs = await import("node:fs/promises");
  return await fs.readFile(path);
}
async function writeTextFile(path, content) {
  if (isDeno) {
    await Deno.writeTextFile(path, content);
    return;
  }
  const fs = await import("node:fs/promises");
  await fs.writeFile(path, content, "utf8");
}
function exit(code) {
  if (isDeno) Deno.exit(code);
  process.exit(code);
}
function fileUrlToPath(urlObj) {
  // Deno 对 node:url 的 fileURLToPath 也有兼容实现，统一走它最严谨
  return fileURLToPath(urlObj);
}
/** 逐字节映射为 latin1 字符串，可安全检索二进制中的 ASCII 子串（双运行时）。 */
function bytesToLatin1(buf) {
  let s = "";
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return s;
}
/** 创建临时目录（Node / Deno 双运行时）。
 *  优先用系统临时目录；系统 /tmp 不可写（沙箱 / 受限环境，如 EACCES）时，
 *  自动回退到本技能目录内 .roadshow-tmp，避免「无输出却静默失败」。
 *  v1.7.2 健壮性修复：新增可写回退 + 失败仍抛错。 */
async function makeTempDir(prefix) {
  const fs = await import("node:fs/promises");
  const fallbackBase = fileURLToPath(new URL("../.roadshow-tmp/", import.meta.url));
  if (isDeno) {
    try {
      return await Deno.makeTempDir({ prefix });
    } catch {
      await fs.mkdir(fallbackBase, { recursive: true });
      return await fs.mkdtemp(fallbackBase + prefix);
    }
  }
  const os = await import("node:os");
  try {
    return await fs.mkdtemp(os.tmpdir() + prefix);
  } catch {
    await fs.mkdir(fallbackBase, { recursive: true });
    return await fs.mkdtemp(fallbackBase + prefix);
  }
}
/** 递归删除目录（尽力而为，失败不抛）。 */
async function removeDir(path) {
  try {
    if (isDeno) {
      await Deno.remove(path, { recursive: true });
    } else {
      const fs = await import("node:fs/promises");
      await fs.rm(path, { recursive: true, force: true });
    }
  } catch {
    /* 忽略清理失败 */
  }
}
// ── 用例定义 ───────────────────────────────────────────────────
const CASES = [
  {
    name: "C01 内置7类范例(pitch-example)",
    desc: "正向：已验证的完整范例，必须全过",
    input: null,
    file: "../references/pitch-example.md",
    expectPass: true,
  },
  {
    name: "C02 SaaS自定义品类演示稿",
    desc: "正向：非内置品类、食安映射为数据安全，必须全过",
    input: null,
    file: "../references/saas-pitch-example.md",
    expectPass: true,
  },
  {
    name: "C03 极小合规稿",
    desc: "正向：所有 token 填实的最小成稿，必须全过",
    input: null,
    draft: "minimalOk",
    expectPass: true,
  },
  {
    name: "C04 缺两个模块",
    desc: "负向：缺【路演风险预警】与【路演结束后...】，必须拦下并报具体缺项",
    input: null,
    draft: "missingModules",
    expectPass: false,
    expectMissingSections: [
      "路演风险预警、临场应对方案",
      "路演结束后采购侧跟进动作清单",
    ],
  },
  {
    name: "C05 缺三个问答主题",
    desc: "负向：应答库缺 竞品对比/售后/账期，必须拦下并报具体主题",
    input: null,
    draft: "missingTopics",
    expectPass: false,
    expectMissingTopics: ["竞品对比", "售后", "账期"],
  },
  {
    name: "C06 占位符泄露",
    desc: "负向：价格项残留【需补：报价】，必须拦下且报占位符+未填实字段",
    input: null,
    draft: "placeholderLeak",
    expectPass: false,
    expectPlaceholderLeak: true,
    expectUnfilled: ["价格"],
  },
  {
    name: "C07 缺关键字段(核心卖点)",
    desc: "负向：成稿无'核心卖点'，必须拦下并报未填实字段",
    input: null,
    draft: "missingKeyField",
    expectPass: false,
    expectUnfilled: ["核心卖点"],
  },
  {
    name: "C08 空稿",
    desc: "负向：空字符串，必须全面不通过",
    input: "",
    expectPass: false,
  },
  {
    name: "C09 时长变体(20分钟)",
    desc: "边界：标题含20分钟，frag 容忍，必须仍过",
    input: null,
    draft: "durationVariant",
    expectPass: true,
  },
  {
    name: "C10 非食安品类漏食安token",
    desc:
      "边界/合规：非食安稿只写数据安全却完全不出现'食品安全风险'字面，必须拦下",
    input: null,
    draft: "nonFoodNoFoodSafetyToken",
    expectPass: false,
    expectMissingTopics: ["食品安全风险"],
  },
  {
    name: "C11 虚构示例必须标注",
    desc:
      "反编造·正向：带'虚构/演示'标注的示例稿可合法携带示例数字，必须全过且含标注",
    input: null,
    draft: "labeledDemo",
    expectPass: true,
    expectLabelToken: "虚构",
  },
  {
    name: "C12 编造矛盾(声明缺失却给具体承诺)",
    desc:
      "反编造·负向：声明'以下信息缺失'却给出具体价格/资质/起订量且无【需补】，必须被反编造拦下",
    input: null,
    draft: "fabricatedContradiction",
    expectPass: false,
    expectAntiFabricationFail: true,
  },
  {
    name: "C13 诚实空缺(用【需补】标记)不被反编造误伤",
    desc:
      "反编造·边界：声明缺失但用【需补】标记空缺，应被占位符拦(不发货)，而非被反编造误伤",
    input: null,
    draft: "honestMissing",
    expectPass: false,
    expectAntiFabricationFail: false,
  },
  {
    name: "C14 完整稿含'数据缺失'措辞不误伤(精确率)",
    desc:
      "反编造·精确率：完整合规稿讲稿里自然出现'数据缺失'一词，但非缺数据声明 token，必须整体通过且不被反编造拦",
    input: null,
    draft: "incidentalMissingWord",
    expectPass: true,
    expectAntiFabricationFail: false,
  },
  {
    name: "C15 竞品对比定量(有数字)",
    desc:
      "竞品定量化·正向：竞品对比给出具体数字对比表，软校验必须不出警告，整体通过",
    input: null,
    draft: "competitorQuantified",
    expectPass: true,
    expectCompetitorWarning: false,
  },
  {
    name: "C16 竞品对比定性空话(软警告)",
    desc:
      "竞品定量化·软校验：竞品对比为定性空话（无数字、无'待补充'），软校验必须出警告提示，但不阻断整体通过",
    input: null,
    draft: "competitorVague",
    expectPass: true,
    expectCompetitorWarning: true,
  },
  {
    name: "C17 工业设备新品类playbook(内置扩充)",
    desc:
      "正向：新增内置品类'工业设备'成稿（按 category-playbook 扩充后），必须全过",
    input: null,
    draft: "industrialEquipment",
    expectPass: true,
  },
  {
    name: "C18 PPT导出·合规稿生成完整大纲",
    desc:
      "PPT外接·正向：合规稿导出 PPT 渲染大纲，须含封面/目录/结尾与竞品对比页",
    input: null,
    draft: "minimalOk",
    export: true,
    expectExportOk: true,
    expectPages: [
      "第 1 页 · 封面",
      "第 2 页 · 目录",
      "第 11 页 · 结尾",
      "竞品对比定量分析",
    ],
  },
  {
    name: "C19 PPT导出·缺模块稿拒绝",
    desc:
      "PPT外接·负向：缺模块稿 buildPptxOutline 必须 ok=false 且 warnings 指出缺失模块",
    input: null,
    draft: "missingModules",
    export: true,
    expectExportOk: false,
    expectWarnMissing: "路演风险预警",
  },
  {
    name: "C20 PPT导出·SaaS范例含竞品表+雷达图",
    desc:
      "PPT外接·正向：SaaS 范例导出大纲须提取到竞品定量表与雷达图 JSON 数据块",
    input: null,
    file: "../references/saas-pitch-example.md",
    export: true,
    expectExportOk: true,
    expectTable: true,
    expectRadar: true,
  },
  {
    name: "C21 雷达图SVG直出（v1.4）",
    desc:
      "v1.4·正向：SaaS 范例渲染出合法 SVG 雷达图（含根标签/网格/维度标签），且大纲内嵌 SVG 代码块",
    input: null,
    file: "../references/saas-pitch-example.md",
    export: true,
    expectExportOk: true,
    expectRadarSvg: true,
  },
  {
    name: "C22 .pptx 技能内直出（v1.5）",
    desc:
      "v1.5·正向：合规稿技能内直出 .pptx，须为合法 zip、≥10 页、含竞品雷达图",
    input: null,
    file: "../references/saas-pitch-example.md",
    buildPptx: true,
    expectPptxOk: true,
  },
  {
    name: "C23 复盘纪要模式·转写稿产出三部分结构",
    desc:
      "复盘纪要·正向：输入线上路演（Teams/Zoom）转写稿后整理出的复盘纪要，须含结构化会议纪要/内容落点对照/行动项清单三部分，且决策/未决/分歧+事实/待确认、负责人/时限/优先级、落点对照八模块全部到位",
    input: null,
    draft: "meetingMinutesOk",
    minutes: true,
    expectPass: true,
    expectMinutesParts: ["结构化会议纪要", "内容落点对照", "行动项清单"],
  },
  {
    name: "C24 复盘纪要模式·缺行动项清单被拦",
    desc:
      "复盘纪要·负向：缺【行动项清单】部分（连带缺负责人/时限/优先级），必须拦下并报具体缺失部分",
    input: null,
    draft: "meetingMinutesMissingActions",
    minutes: true,
    expectPass: false,
    expectMissingMinutesParts: ["行动项清单"],
  },
  {
    name: "C25 包装材料三子类(玻璃/塑料/金属)侧重点输出",
    desc:
      "正向：包装材料成稿按玻璃/塑料/金属三子类展开侧重点（玻璃易碎/瓶型/丝印/磨砂/食品级玻璃；塑料PET/PP/HDPE/迁移检测/禁塑令/可降解；金属马口铁/铝/密封性/保质期/防腐涂层/易拉盖/二维码），必须全过且含全部子类关键词",
    input: null,
    draft: "packagingSubclasses",
    expectPass: true,
    expectMarkers: [
      "易碎",
      "瓶型",
      "丝印",
      "磨砂",
      "食品级玻璃",
      "PET",
      "PP",
      "HDPE",
      "迁移检测",
      "禁塑令",
      "可降解",
      "马口铁",
      "铝",
      "密封性",
      "保质期",
      "防腐涂层",
      "易拉盖",
      "二维码",
    ],
  },
  {
    name: "C26 无竞品'待补充'合规通过（v1.7.1）",
    desc:
      "待补充·正向：无竞品用户按 Step 5A 把竞品对比标为普通'待补充'（非标记形式），必须通过校验且可导出大纲（导出页含'待补充'占位提示）",
    input: null,
    draft: "noRivalTbd",
    export: true,
    expectPass: true,
    expectCompetitorWarning: false,
    expectExportOk: true,
    expectPages: ["第 1 页 · 封面", "第 11 页 · 结尾", "标注「待补充」"],
  },
  {
    name: "C27 '【待补充】'占位标记仍拦截（v1.7.1）",
    desc:
      "待补充·负向：竞品对比残留标记形式'【待补充】'，必须被占位符检查拦下（不通过）",
    input: null,
    draft: "noRivalMarked",
    expectPass: false,
    expectPlaceholderLeak: true,
  },
  {
    name: "C28 纯英文成稿校验+导出全链（v1.7.1）",
    desc:
      "英文模式·正向：纯英文成稿自动按英文词表校验通过，且大纲导出（含竞品表+雷达图）与 .pptx 技能内直出均成功",
    input: null,
    draft: "englishOk",
    export: true,
    buildPptx: true,
    expectPass: true,
    expectCompetitorWarning: false,
    expectExportOk: true,
    expectTable: true,
    expectRadar: true,
    expectPptxOk: true,
  },
  {
    name: "C29 纯英文稿缺模块/占位符被拦（v1.7.1）",
    desc:
      "英文模式·负向：英文稿缺风险预警与跟进清单两个模块且残留 TODO，必须拦下并报出具体缺失模块与占位符",
    input: null,
    draft: "englishBroken",
    expectPass: false,
    expectMissingSections: [
      "路演风险预警、临场应对方案",
      "路演结束后采购侧跟进动作清单",
    ],
    expectPlaceholderLeak: true,
  },
];
// ── 用例草稿（内联构造，避免大量模板字符串）──────────────────
// 用函数生成，运行时才取，避免定义顺序问题。
function drafts() {
  const MINIMAL_OK = `# 极简合规稿
【本次路演核心目标】拿样
【客户细分品类定位 & 业务侧重点说明】原料；核心卖点：高纯批次稳定
【参会角色关注点拆解】采购总监关注降成本
【15分钟口语化完整路演讲稿】各位总，我们价格优、交期稳
【PPT大纲】第1页封面
【高频&尖锐问题应答库】
价格：100元/kg；交期：15天；最小起订量：1吨；资质合规：ISO9001；样品打样：7天；供货稳定性：安全库存；竞品对比：更纯；售后：24h响应；知识产权保密：签NDA；食品安全风险：每批检测合格；账期：30天；降本量化测算：综合省6%
【路演风险预警、临场应对方案】已备预案
【路演结束后采购侧跟进动作清单】本周发样`;
  return {
    minimalOk: MINIMAL_OK,
    missingModules: `# 缺模块稿
【本次路演核心目标】拿样
【客户细分品类定位 & 业务侧重点说明】原料；核心卖点：高纯稳定
【参会角色关注点拆解】采购总监
【15分钟口语化完整路演讲稿】各位总
【PPT大纲】第1页
【高频&尖锐问题应答库】
价格：100；交期：15天；最小起订量：1吨；资质合规：ISO；样品打样：7天；供货稳定性：库存；竞品对比：更优；售后：24h；知识产权保密：NDA；食品安全风险：合格；账期：30天；降本量化测算：6%
（此处故意缺少风险预警模块与跟进清单模块）`,
    missingTopics: `# 缺主题稿
【本次路演核心目标】拿样
【客户细分品类定位 & 业务侧重点说明】原料；核心卖点：高纯稳定
【参会角色关注点拆解】采购总监
【15分钟口语化完整路演讲稿】各位总
【PPT大纲】第1页
【高频&尖锐问题应答库】
价格：100；交期：15天；最小起订量：1吨；资质合规：ISO；样品打样：7天；供货稳定性：库存；知识产权保密：NDA；食品安全风险：合格；降本量化测算：6%
【路演风险预警、临场应对方案】预案
【路演结束后采购侧跟进动作清单】发样`,
    placeholderLeak: `# 占位符泄露稿
【本次路演核心目标】拿样
【客户细分品类定位 & 业务侧重点说明】原料；核心卖点：高纯稳定
【参会角色关注点拆解】采购总监
【15分钟口语化完整路演讲稿】各位总
【PPT大纲】第1页
【高频&尖锐问题应答库】
价格：【需补：报价】；交期：15天；最小起订量：1吨；资质合规：ISO；样品打样：7天；供货稳定性：库存；竞品对比：更优；售后：24h；知识产权保密：NDA；食品安全风险：合格；账期：30天；降本量化测算：6%
【路演风险预警、临场应对方案】预案
【路演结束后采购侧跟进动作清单】发样`,
    missingKeyField: `# 缺关键字段稿
【本次路演核心目标】拿样
【客户细分品类定位 & 业务侧重点说明】原料
【参会角色关注点拆解】采购总监
【15分钟口语化完整路演讲稿】各位总
【PPT大纲】第1页
【高频&尖锐问题应答库】
价格：100；交期：15天；最小起订量：1吨；资质合规：ISO；样品打样：7天；供货稳定性：库存；竞品对比：更优；售后：24h；知识产权保密：NDA；食品安全风险：合格；账期：30天；降本量化测算：6%
【路演风险预警、临场应对方案】预案
【路演结束后采购侧跟进动作清单】发样`,
    durationVariant: MINIMAL_OK.replace(
      "【15分钟口语化完整路演讲稿】",
      "【20分钟口语化完整路演讲稿】",
    ),
    nonFoodNoFoodSafetyToken: `# SaaS稿（漏掉食安映射 token）
【本次路演核心目标】POC
【客户细分品类定位 & 业务侧重点说明】SaaS；核心卖点：对接快
【参会角色关注点拆解】CIO
【15分钟口语化完整路演讲稿】各位总
【PPT大纲】第1页
【高频&尖锐问题应答库】
价格：年付；交期：4周上线；最小起订量：1厂50席；资质合规：等保三级；样品打样：POC沙箱；供货稳定性：SLA99.9%；竞品对比：更本地化；售后：7x12；知识产权保密：数据归属客户；数据安全：加密不出厂；账期：年付；降本量化测算：ROI<12月
【路演风险预警、临场应对方案】预案
【路演结束后采购侧跟进动作清单】出方案`,
    labeledDemo: `# 演示文档（虚构示例数据）
【本次路演核心目标】拿样
【客户细分品类定位 & 业务侧重点说明】原料；核心卖点：高纯稳定
【参会角色关注点拆解】采购总监
【15分钟口语化完整路演讲稿】各位总
【PPT大纲】第1页
【高频&尖锐问题应答库】
价格：100元/kg；交期：15天；最小起订量：1吨；资质合规：ISO9001；样品打样：7天；供货稳定性：安全库存；竞品对比：更纯；售后：24h；知识产权保密：NDA；食品安全风险：合格；账期：30天；降本量化测算：6%
【路演风险预警、临场应对方案】预案
【路演结束后采购侧跟进动作清单】发样`,
    fabricatedContradiction: `# 路演稿
以下信息缺失：预算、真实资质，但先给框架。
【本次路演核心目标】拿样
【客户细分品类定位 & 业务侧重点说明】原料；核心卖点：高纯稳定
【参会角色关注点拆解】采购总监
【15分钟口语化完整路演讲稿】各位总
【PPT大纲】第1页
【高频&尖锐问题应答库】
价格：128元/kg；交期：15天；最小起订量：500kg；资质合规：已获ISO22000认证；样品打样：7天；供货稳定性：安全库存；竞品对比：更纯；售后：24h；知识产权保密：NDA；食品安全风险：合格；账期：30天；降本量化测算：6%
【路演风险预警、临场应对方案】预案
【路演结束后采购侧跟进动作清单】发样`,
    honestMissing: `# 路演稿
以下信息缺失：预算、资质，按缺数据流程列出。
【本次路演核心目标】拿样
【客户细分品类定位 & 业务侧重点说明】原料；核心卖点：高纯稳定
【参会角色关注点拆解】采购总监
【15分钟口语化完整路演讲稿】各位总
【PPT大纲】第1页
【高频&尖锐问题应答库】
价格：【需补：报价】；交期：15天；最小起订量：【需补：MOQ】；资质合规：【需补：认证】；样品打样：7天；供货稳定性：安全库存；竞品对比：更纯；售后：24h；知识产权保密：NDA；食品安全风险：合格；账期：【需补：账期】；降本量化测算：【需补：测算】
【路演风险预警、临场应对方案】预案
【路演结束后采购侧跟进动作清单】发样`,
    incidentalMissingWord: MINIMAL_OK.replace(
      "各位总，我们价格优、交期稳",
      "各位总，我们价格优、交期稳；若上游数据缺失会影响排产，我们已建安全库存应对",
    ),
    competitorQuantified: `# 竞品定量对比稿
【本次路演核心目标】拿样
【客户细分品类定位 & 业务侧重点说明】原料；核心卖点：高纯稳定
【参会角色关注点拆解】采购总监
【15分钟口语化完整路演讲稿】各位总
【PPT大纲】第1页
【高频&尖锐问题应答库】
价格：108元/kg；交期：15天；最小起订量：1吨；资质合规：ISO9001；样品打样：7天；供货稳定性：2000吨/月；竞品对比：| 维度 | 我方 | 竞品A | 差异化 | 价格108元|交期15天|竞品A交期45天|单价高8%但交期快30天 |；售后：24h；知识产权保密：NDA；食品安全风险：合格；账期：30天；降本量化测算：省9%
【路演风险预警、临场应对方案】预案
【路演结束后采购侧跟进动作清单】发样`,
    competitorVague: `# 竞品空话稿
【本次路演核心目标】拿样
【客户细分品类定位 & 业务侧重点说明】原料；核心卖点：高纯稳定
【参会角色关注点拆解】采购总监
【15分钟口语化完整路演讲稿】各位总
【PPT大纲】第1页
【高频&尖锐问题应答库】
价格：100元/kg；交期：15天；最小起订量：1吨；资质合规：ISO9001；样品打样：7天；供货稳定性：安全库存；竞品对比：我们更专业更稳定更有优势；售后：24h；知识产权保密：NDA；食品安全风险：合格；账期：30天；降本量化测算：省6%
【路演风险预警、临场应对方案】预案
【路演结束后采购侧跟进动作清单】发样`,
    industrialEquipment: `# 工业设备路演稿（虚构示例数据）
【本次路演核心目标】进年度产线改造供应商名录
【客户细分品类定位 & 业务侧重点说明】工业设备；核心卖点：MTBF高、能耗低、交付快
【参会角色关注点拆解】生产负责人关注停机与产能
【15分钟口语化完整路演讲稿】各位总，我们设备故障率低、交期稳、能耗省
【PPT大纲】第1页封面
【高频&尖锐问题应答库】
价格：180万元/台；交期：60天；最小起订量：1台；资质合规：CE认证齐全；样品打样：3个月试机；供货稳定性：备件库存90天；竞品对比：| 维度 | 我方 | 竞品 | 差异化 | MTBF 8000h | 竞品 5000h | 年停机省120h |；售后：24h到场；知识产权保密：签NDA；食品安全风险：运行安全/故障风险已控；账期：3-6-1；降本量化测算：年省电费18万
【路演风险预警、临场应对方案】预案
【路演结束后采购侧跟进动作清单】发技术规格书`,
    meetingMinutesOk: `# 路演复盘纪要（输入：2026-08-24 Teams 转写稿）
> 输入：约40分钟 Teams 线上路演转写稿（6人参会）。转写稿未明确的信息一律标「待确认」，不编造。
## 一、结构化会议纪要
**决策点（事实）**
- 已决策：客户同意进入打样阶段，本周内提供产品规格书（转写稿明确表态）。
- 已决策：报价按三档梯度口径报给采购总监（事实）。
**未决点（待确认）**
- 未决：最小起订量口径，客户说"再看看量"（待确认：客户年用量未给出）。
- 未决：账期是否 30 天，财务未当场表态（待确认：未收到明确答复）。
**分歧点（事实/待确认）**
- 分歧：技术负责人坚持先看迁移检测报告再谈价格（事实）。
- 分歧：采购倾向最低价，与研发"质量优先"存在张力（事实）。
## 二、内容落点对照
- "进入打样阶段" → 对应【高频&尖锐问题应答库】（样品打样主题）。
- "报价三档梯度" → 对应【高频&尖锐问题应答库】（价格主题）与【本次路演核心目标】。
- "运输损耗数据" → 对应【客户细分品类定位 & 业务侧重点说明】。
- "风险预案" → 对应【路演风险预警、临场应对方案】。
## 三、行动项清单
| 负责人 | 时限 | 优先级 | 行动项 | 来源 |
|--------|------|--------|--------|------|
| 我方销售 | 本周五前 | 高 | 发出打样规格书确认函 | 决策点 |
| 我方技术 | 3个工作日内 | 高 | 补发迁移检测报告 | 分歧点 |
| 客户采购 | 下周 | 中 | 确认年用量口径 | 未决点 |`,
    meetingMinutesMissingActions: `# 路演复盘纪要（输入：2026-08-24 Teams 转写稿）
## 一、结构化会议纪要
**决策点（事实）** 客户同意打样
**未决点（待确认）** 年用量未给出
**分歧点（事实）** 技术要先看检测报告
## 二、内容落点对照
- 打样 → 【高频&尖锐问题应答库】
- 报价 → 【本次路演核心目标】
（此稿故意截断，未整理出第三部分待办清单）`,
    packagingSubclasses: `# 包装材料路演稿（虚构示例数据）
【本次路演核心目标】进包装材料合格供应商名录
【客户细分品类定位 & 业务侧重点说明】包装材料；玻璃/塑料/金属三子类并进；核心卖点：三材质全链条合规、损耗低、打样快
【参会角色关注点拆解】采购总监关注降本与供应稳定；生产关注运输损耗与产线适配
【15分钟口语化完整路演讲稿】各位总，咱们按玻璃、塑料、金属三类包材逐项拆：玻璃易碎运输损耗控在1.5%以内、瓶型/丝印/磨砂工艺都能做；塑料PET/PP/HDPE材质齐全、食品接触迁移检测随时给、跟得上禁塑令和可降解趋势；金属马口铁和铝罐密封性好、保质期稳定、防腐涂层合规、易拉盖和二维码可做。交期稳、起订灵活。
【PPT大纲】第1页封面；第2页三子类总览
【高频&尖锐问题应答库】
价格：按材质分档报价；交期：常规12天；最小起订量：塑料1万只起；资质合规：食品级玻璃与GB 4806齐全；样品打样：7天；供货稳定性：安全库存2周；竞品对比：| 维度 | 我方 | 竞品 | 差异化 | 运输损耗1.5% | 行业3% | 损耗省一半 |；售后：48h响应；知识产权保密：签NDA；食品安全风险：迁移检测每批合格；账期：30天；降本量化测算：包材综合省6%
【路演风险预警、临场应对方案】玻璃运输破损预案、塑料禁塑令政策跟进
【路演结束后采购侧跟进动作清单】发三子类样品与检测报告`,
    noRivalTbd: `# 无竞品路演稿（竞品对比按 Step 5A 标"待补充"）
【本次路演核心目标】拿样
【客户细分品类定位 & 业务侧重点说明】原料；核心卖点：高纯批次稳定
【参会角色关注点拆解】采购总监关注降成本
【15分钟口语化完整路演讲稿】各位总，我们价格优、交期稳
【PPT大纲】第1页封面
【高频&尖锐问题应答库】
价格：100元/kg；交期：15天；最小起订量：1吨；资质合规：ISO9001；样品打样：7天；供货稳定性：安全库存；竞品对比：待补充（暂无竞品情报，会后按三通道收口补定量对比表，绝不编数）；售后：24h响应；知识产权保密：签NDA；食品安全风险：每批检测合格；账期：30天；降本量化测算：综合省6%
【路演风险预警、临场应对方案】已备预案
【路演结束后采购侧跟进动作清单】本周发样`,
    noRivalMarked: `# 无竞品路演稿（错误示范：残留标记形式占位符）
【本次路演核心目标】拿样
【客户细分品类定位 & 业务侧重点说明】原料；核心卖点：高纯批次稳定
【参会角色关注点拆解】采购总监关注降成本
【15分钟口语化完整路演讲稿】各位总，我们价格优、交期稳
【PPT大纲】第1页封面
【高频&尖锐问题应答库】
价格：100元/kg；交期：15天；最小起订量：1吨；资质合规：ISO9001；样品打样：7天；供货稳定性：安全库存；竞品对比：【待补充】（会后补）；售后：24h响应；知识产权保密：签NDA；食品安全风险：每批检测合格；账期：30天；降本量化测算：综合省6%
【路演风险预警、临场应对方案】已备预案
【路演结束后采购侧跟进动作清单】本周发样`,
    englishOk: `# English Roadshow Draft (Cosmetics OEM × Retail Chain)
## 【Core Objective of This Session】
Enter ABC Retail's qualified supplier list and win a 50,000-unit trial order (approx. RMB 800,000).
## 【Category Positioning & Key Focus Areas】
- Category: Cosmetics OEM/ODM.
- Core selling point: 100k-grade GMPC workshop, 45-day lead time from sample to mass production, full-batch COA testing.
- Client status: current supplier schedules in 60+ days and often delays in peak season.
## 【Stakeholder Concerns Breakdown】
- Procurement Director: total cost, supply risk, lead time stability, ROI.
- R&D Manager: formula development, compliance, sampling speed.
## 【Full Verbal Script (15 min)】
(Opening) Good morning. Today I will show why we are faster, more stable and more compliant than your current supplier.
(Numbers) We have been doing cosmetics OEM for 12 years with a 100k-grade GMPC workshop and 3,000+ ready formulas; your chosen formula goes from sample to mass production in 45 days — 15 days faster than today.
(Closing) Two actions today: we send 3 candidate formula samples this week, and deliver the formal quotation for the 50,000-unit trial order.
## 【PPT Outline】
1. Cover: OEM partner for your private labels
2. Pain points: slow scheduling, peak-season delays
3. Solution: GMPC workshop + formula library + 45-day delivery
4. Hard metrics: 45-day scheduling, 30% peak redundancy, full-batch testing
5. Next steps: samples + trial order quotation
## 【Hard Question Q&A Bank】
- **Price**: tiered pricing by bottle size and formula; the trial tier is about 8% above the annual-frame tier, offset by 15-day faster delivery.
- **Lead time**: standard 45 days; 30% peak-season capacity redundancy; lock scheduling 60 days ahead.
- **MOQ**: 10,000 units standard; 5,000 units for trial orders.
- **Compliance**: 100k-grade GMPC workshop; full support for general and special cosmetics filing; batch test reports retrievable on request.
- **Sampling**: 15 days per version; 3 formula versions free of charge.
- **Supply stability**: dual filling lines plus 2 months of raw-material safety stock; shortage penalty clause written into the contract.
- **Competitor comparison**: quantitative table below (source: client-side verbal benchmark, to be confirmed):
  | Dimension | Ours | Competitor | Differentiation |
  |-----------|------|------------|-----------------|
  | Scheduling (days) | 45 | 60 | 15 days faster, earlier shelf launch |
  | MOQ (units) | 10,000 (trial 5,000) | 30,000 | 67% lower trial barrier |
  | Sampling (days) | 15 | 25 | 10 days faster iteration |
- **After-sales**: dedicated project manager; 2h response for quality issues; 3-year retention samples.
- **IP protection**: formula belongs to the client; NDA signed; exclusive template lock; no data outflow.
- **Product safety**: full-batch microbial and heavy-metal testing; complete traceability chain.
- **Payment terms**: 30% deposit and balance before shipment for the first order; monthly settlement after 3 stable orders.
- **Cost saving**: 15 days faster × 6 new SKUs/year ≈ one month earlier launch per SKU ≈ RMB 1.2M extra turnover per year.
## 【Risk Alerts & On-the-spot Responses】
- Risk: R&D doubts formula exclusivity → show the exclusive-lock agreement template and promise 15-day targeted sampling.
- Risk: procurement pushes price below the tier → reframe with turnover gains from faster launch, not a flat discount.
## 【Follow-up Action Checklist】
1. Send 3 candidate formula samples and the filing package today.
2. Deliver the formal quotation for the 50,000-unit trial order within 3 business days.
3. Book an online session with R&D within one week on the formula lock-up plan.
4. Push for the qualified-supplier review within two weeks.
**Radar data**:
\`\`\`json
{"type":"competitor_radar","dimensions":["Price","Lead time","MOQ","Compliance","Sampling","Stability","Service","R&D","Capacity","Payment"],"series":[{"name":"Ours","scores":[3,4,5,5,4,4,4,4,4,3]},{"name":"Competitor","scores":[4,2,2,3,2,2,3,3,2,4]}],"note":"Scores derived from the comparison table, demo data"}
\`\`\``,
    englishBroken: `# English Roadshow Draft (broken on purpose)
## 【Core Objective of This Session】
Enter ABC Retail's qualified supplier list and win a 50,000-unit trial order.
## 【Category Positioning & Key Focus Areas】
- Category: Cosmetics OEM/ODM.
- Core selling point: GMPC workshop, 45-day lead time.
## 【Stakeholder Concerns Breakdown】
- Procurement Director: total cost, supply risk.
## 【Full Verbal Script (15 min)】
(Opening) Good morning. We deliver in 45 days.
## 【PPT Outline】
1. Cover 2. Pain points 3. Solution
## 【Hard Question Q&A Bank】
- **Price**: tiered pricing.
- **Lead time**: 45 days.
- **MOQ**: 10,000 units.
- **Compliance**: GMPC workshop.
- **Sampling**: 15 days.
- **Supply stability**: dual filling lines.
- **Competitor comparison**: TODO: confirm competitor data before the session.
- **After-sales**: 2h response.
- **IP protection**: NDA.
- **Product safety**: full-batch testing.
- **Payment terms**: 30 days.
- **Cost saving**: approx. RMB 1.2M per year.
(This draft is truncated on purpose: the last two required sections were dropped.)`,
  };
}
// ── 运行器 ─────────────────────────────────────────────────────
async function readInput(c, d) {
  if (c.input !== null) return { text: c.input, skipped: false };
  if (c.file) {
    try {
      const here = new URL(".", import.meta.url);
      const ref = new URL(c.file, here);
      const p = fileUrlToPath(ref);
      return { text: await readTextFile(p), skipped: false };
    } catch {
      return { text: null, skipped: true };
    }
  }
  if (c.draft && d[c.draft]) return { text: d[c.draft], skipped: false };
  return { text: null, skipped: true };
}
let passCount = 0;
let failCount = 0;
let skipCount = 0;
console.log("══════════════════════════════════════════════════════");
console.log("  通用销售路演 skill · 输出合规测试 harness");
console.log("══════════════════════════════════════════════════════\n");
const D = drafts();
for (const c of CASES) {
  const { text, skipped } = await readInput(c, D);
  if (skipped) {
    console.log(`⏭️  SKIP  ${c.name}\n       （输入缺失，跳过）\n`);
    skipCount++;
    continue;
  }
  const r = c.minutes ? validateMeetingMinutes(text) : validateRoadshow(text);
  const exp = c.export ? buildPptxOutline(text) : null;
  const problems = [];
  if (c.expectPass !== undefined && r.passed !== c.expectPass) {
    problems.push(
      `通过判定不符：期望 ${c.expectPass ? "通过" : "不通过"}，实际 ${
        r.passed ? "通过" : "不通过"
      }`,
    );
  }
  if (c.minutes) {
    if (c.expectMinutesParts) {
      for (const p of c.expectMinutesParts) {
        if (r.parts.missing.includes(p)) {
          problems.push(`期望复盘纪要含「${p}」，实际缺失（缺失：${r.parts.missing.join("、") || "无"}）`);
        }
      }
    }
    if (c.expectMissingMinutesParts) {
      for (const p of c.expectMissingMinutesParts) {
        if (!r.parts.missing.includes(p)) {
          problems.push(
            `期望复盘纪要缺「${p}」未报出（实际缺失：${r.parts.missing.join("、") || "无"}）`,
          );
        }
      }
    }
  }
  if (c.expectMarkers) {
    for (const m of c.expectMarkers) {
      if (!text.includes(m)) {
        problems.push(`期望成稿含子类关键词「${m}」未找到`);
      }
    }
  }
  if (c.expectMissingSections) {
    for (const m of c.expectMissingSections) {
      if (!r.sections.missing.includes(m)) {
        problems.push(
          `期望缺模块「${m}」未报出（实际缺失：${
            r.sections.missing.join("、") || "无"
          }）`,
        );
      }
    }
  }
  if (c.expectMissingTopics) {
    for (const m of c.expectMissingTopics) {
      if (!r.qaTopics.missing.includes(m)) {
        problems.push(
          `期望缺主题「${m}」未报出（实际缺失：${
            r.qaTopics.missing.join("、") || "无"
          }）`,
        );
      }
    }
  }
  if (c.expectUnfilled) {
    for (const u of c.expectUnfilled) {
      if (!r.keyFields.unfilled.some((x) => x.includes(u))) {
        problems.push(
          `期望未填实字段含「${u}」未报出（实际：${
            r.keyFields.unfilled.join("；") || "无"
          }）`,
        );
      }
    }
  }
  if (c.expectPlaceholderLeak !== undefined) {
    const leaked = !r.placeholders.ok;
    if (leaked !== c.expectPlaceholderLeak) {
      problems.push(
        `占位符泄露判定不符：期望 ${c.expectPlaceholderLeak}，实际 ${leaked}`,
      );
    }
  }
  if (c.expectAntiFabricationFail !== undefined) {
    const afFail = !r.antiFabrication.ok;
    if (afFail !== c.expectAntiFabricationFail) {
      problems.push(
        `反编造判定不符：期望 ${
          c.expectAntiFabricationFail ? "拦下" : "不拦"
        }，实际 ${afFail ? "拦下" : "不拦"}${
          afFail ? `（${r.antiFabrication.notes.join("；")}）` : ""
        }`,
      );
    }
  }
  if (c.expectLabelToken) {
    if (!text.includes(c.expectLabelToken)) {
      problems.push(`期望成稿含虚构/演示标注「${c.expectLabelToken}」未找到`);
    }
  }
  if (c.expectCompetitorWarning !== undefined) {
    const cw = !r.competitorQuantified.ok;
    if (cw !== c.expectCompetitorWarning) {
      problems.push(
        `竞品定量化软校验判定不符：期望 ${
          c.expectCompetitorWarning ? "出警告" : "不出警告"
        }，实际 ${cw ? "出警告" : "不出警告"}${
          cw ? `（${r.competitorQuantified.notes.join("；")}）` : ""
        }`,
      );
    }
  }
  // ── PPT 导出（v1.3）专用断言 ─────────────────────────────
  if (c.export && exp) {
    if (
      c.expectExportOk !== undefined &&
      exp.ok !== c.expectExportOk
    ) {
      problems.push(
        `PPT导出ok判定不符：期望 ${c.expectExportOk}，实际 ${exp.ok}${
          exp.warnings.length ? `（${exp.warnings.join("；")}）` : ""
        }`,
      );
    }
    if (c.expectPages) {
      for (const p of c.expectPages) {
        if (!exp.outline.includes(p)) {
          problems.push(`期望大纲含「${p}」未找到`);
        }
      }
    }
    if (c.expectWarnMissing) {
      const w = exp.warnings.join("；");
      if (!w.includes(c.expectWarnMissing)) {
        problems.push(
          `期望 warnings 指出「${c.expectWarnMissing}」，实际：${w || "无"}`,
        );
      }
    }
    if (c.expectTable) {
      if (!extractMarkdownTable(text)) {
        problems.push("期望从成稿提取到竞品定量表，未找到");
      }
      if (
        !exp.outline.includes("维度") &&
        !exp.outline.toLowerCase().includes("dimension")
      ) {
        problems.push("期望大纲含竞品对比表(维度/Dimension)，未找到");
      }
    }
    if (c.expectRadar) {
      if (!extractRadarData(text)) {
        problems.push("期望从成稿提取到雷达图数据块，未找到");
      }
      if (!exp.outline.includes("dimensions")) {
        problems.push("期望大纲含雷达图数据(dimensions)，未找到");
      }
    }
    // ── 雷达图 SVG 直出（v1.4）专用断言 ─────────────────────
    if (c.expectRadarSvg) {
      const radar = extractRadarData(text);
      const svg = radar ? renderRadarSVG(radar) : "";
      if (!svg) {
        problems.push("期望渲染出雷达图 SVG，实际为空");
      } else {
        if (!svg.includes("<svg")) problems.push("期望 SVG 含 <svg 根标签");
        if (!svg.includes("polygon"))
          problems.push("期望 SVG 含 polygon 网格/数据多边形");
        for (const dim of (radar?.dimensions ?? []).slice(0, 3)) {
          if (!svg.includes(dim))
            problems.push(`期望 SVG 含维度标签「${dim}」`);
        }
        for (const s of radar?.series ?? []) {
          if (!svg.includes(s.name))
            problems.push(`期望 SVG 含系列名「${s.name}」（图例）`);
        }
      }
      if (!exp.outline.includes("```svg")) {
        problems.push("期望 PPT 大纲内嵌 SVG 代码块，未找到");
      }
    }
  }
  // ── .pptx 技能内直出（v1.5）专用断言 ─────────────────────
  if (c.buildPptx) {
    const tmpDir = await makeTempDir("roadshow-harness-");
    try {
      const r2 = await buildPptx(text, "references/saas-pitch-example.md", tmpDir);
      if (c.expectPptxOk !== undefined && r2.ok !== c.expectPptxOk) {
        problems.push(
          `期望 buildPptx ok=${c.expectPptxOk}，实际 ${r2.ok}${
            r2.warnings.length ? `（${r2.warnings.join("；")}）` : ""
          }`,
        );
      }
      if (!r2.path) {
        problems.push("buildPptx 未返回输出路径");
      } else {
        const buf = await readBinary(r2.path);
        if (!buf || !buf.length) {
          problems.push(`buildPptx 未产出文件（${r2.path}）`);
        } else {
          const s = bytesToLatin1(buf);
          if (!s.startsWith("PK")) problems.push("期望 .pptx 为合法 zip（PK 头），未命中");
          if (!s.includes("ppt/slides/slide"))
            problems.push("期望 .pptx 含 ppt/slides/slide 条目，未命中");
          if (!s.includes("chart"))
            problems.push("期望 .pptx 含竞品雷达图 chart，未命中");
        }
      }
    } catch (e) {
      problems.push(`buildPptx 执行异常：${e.message}`);
    } finally {
      await removeDir(tmpDir);
    }
  }
  if (problems.length === 0) {
    console.log(`✅ PASS  ${c.name}`);
    console.log(`       ${c.desc}`);
    passCount++;
  } else {
    console.log(`❌ FAIL  ${c.name}`);
    console.log(`       ${c.desc}`);
    for (const p of problems) console.log(`       ↳ ${p}`);
    failCount++;
  }
  console.log("");
}
console.log("────────────────────────────────────────────────────");
console.log(
  `  结果：通过 ${passCount} / 失败 ${failCount} / 跳过 ${skipCount}（共 ${CASES.length} 例）`,
);
console.log("────────────────────────────────────────────────────");
if (failCount > 0) {
  console.log("❌ harness 存在失败用例，skill 输出合规可能不达标。\n");
  exit(1);
}
console.log("✅ 全部用例通过：skill 输出合规校验稳定可靠。\n");
exit(0);
