/**
 * roadshow_radar_svg.mjs — 竞品对比雷达图 → SVG 渲染（v1.4 新增）
 *
 * 背景：v1.3 成稿只输出雷达图 JSON 数据块，实际可视化依赖对话平台
 *       的图表渲染能力，不同环境体验不一致。v1.4 增加本模块：在技能内
 *       直接把雷达图数据渲染成 SVG 字符串，任何环境（浏览器/飞书/PPT/
 *       本地预览）打开结果一致，不再依赖平台图表能力。
 *
 * 特性：
 *   - 纯字符串拼接 + Math，零依赖、无网络，Node.js / Deno 双运行时可跑；
 *   - 支持任意维度数（不限于 10 维）、1-4 个数据系列（超 4 系列自动截断并在图内标注提示）；
 *   - 输出标准 <svg>，可直接保存为 .svg 文件或用 <img> 嵌入 Markdown。
 *
 * 用法：
 *   import { renderRadarSVG } from "./roadshow_radar_svg.mjs";
 *   const svg = renderRadarSVG(radarData);   // radarData = { dimensions, series, note }
 */

// ── 默认配色（我方深蓝，竞品依次橙/绿/紫）────────────────────────
const SERIES_COLORS = [
  { stroke: "#1f4e8c", fill: "rgba(31,78,140,0.18)" }, // 我方
  { stroke: "#e07b39", fill: "rgba(224,123,57,0.18)" }, // 竞品A
  { stroke: "#3a8f5f", fill: "rgba(58,143,95,0.18)" },  // 竞品B
  { stroke: "#7a4fa3", fill: "rgba(122,79,163,0.18)" }, // 竞品C
];

/** XML 转义：维度名/系列名/备注可能含 < > & " ' */
function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** 归一化分值：0~max 映射到 0~1，越界截断，非法值按 0 处理。 */
function norm(score, max) {
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n / max));
}

/**
 * 渲染竞品对比雷达图为 SVG 字符串。
 * @param {object} radarData - { dimensions: string[], series: [{name, scores: number[]}], note? }
 * @param {object} [opts]    - { width=680, height=560, max=5, labelFontSize=13 }
 * @returns {string} 完整 SVG 文本
 */
export function renderRadarSVG(radarData, opts = {}) {
  const dims = Array.isArray(radarData?.dimensions) ? radarData.dimensions : [];
  const series = Array.isArray(radarData?.series) ? radarData.series : [];
  if (!dims.length) return "";

  const N = dims.length;
  const max = opts.max ?? 5;
  const W = opts.width ?? 680;
  const H = opts.height ?? 560;
  const labelFont = opts.labelFontSize ?? 13;

  // 布局：留右侧图例区（>=3 系列）与四周标签空间
  const hasLegend = series.length > 1;
  const legendW = hasLegend ? 150 : 0;
  const cx = (W - legendW) / 2;
  const cy = H / 2;
  const R = Math.min(cx, cy) - 46;

  const angle = (i) => (-Math.PI / 2 + (2 * Math.PI * i) / N);
  const pt = (i, r) => {
    const a = angle(i);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const fmt = (n) => (Math.round(n * 100) / 100).toString();
  const P = (points) => points.map((p) => p.map(fmt).join(",")).join(" ");

  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="'PingFang SC','Microsoft YaHei',sans-serif">`,
  );
  parts.push(`  <rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>`);
  parts.push(`  <text x="${cx}" y="26" text-anchor="middle" font-size="17" font-weight="bold" fill="#1a1a1a">竞品多维对比雷达图</text>`);
  parts.push(`  <text x="${cx}" y="44" text-anchor="middle" font-size="11" fill="#888888">评分 0-${max} 分 · 越靠近外圈越强 · 数据来自成稿竞品对比表</text>`);

  // ── 1. 网格：4 层正 N 边形 + 轴线 ─────────────────────────────
  const GRID_LEVELS = 4;
  for (let g = 1; g <= GRID_LEVELS; g++) {
    const r = (R * g) / GRID_LEVELS;
    const poly = [];
    for (let i = 0; i < N; i++) poly.push(pt(i, r));
    parts.push(
      `  <polygon points="${P(poly)}" fill="none" stroke="${g === GRID_LEVELS ? "#9aa7b8" : "#d8dee8"}" stroke-width="${g === GRID_LEVELS ? 1.4 : 1}"/>`,
    );
  }
  for (let i = 0; i < N; i++) {
    const [x, y] = pt(i, R);
    parts.push(`  <line x1="${fmt(cx)}" y1="${fmt(cy)}" x2="${fmt(x)}" y2="${fmt(y)}" stroke="#d8dee8" stroke-width="1"/>`);
  }

  // ── 2. 维度标签 ──────────────────────────────────────────────
  for (let i = 0; i < N; i++) {
    const [x, y] = pt(i, R + 24);
    parts.push(
      `  <text x="${fmt(x)}" y="${fmt(y)}" text-anchor="middle" dominant-baseline="middle" font-size="${labelFont}" fill="#333333">${esc(dims[i])}</text>`,
    );
  }

  // ── 3. 数据系列多边形 ─────────────────────────────────────────
  // 兼容两种字段写法：手册定义为 scores，部分示例/用户数据用 values
  series.slice(0, SERIES_COLORS.length).forEach((s, si) => {
    const color = SERIES_COLORS[si];
    const raw = Array.isArray(s.scores) ? s.scores : Array.isArray(s.values) ? s.values : [];
    const scores = [];
    for (let i = 0; i < N; i++) scores[i] = norm(raw[i], max);
    const poly = [];
    for (let i = 0; i < N; i++) poly.push(pt(i, R * scores[i]));
    parts.push(
      `  <polygon points="${P(poly)}" fill="${color.fill}" stroke="${color.stroke}" stroke-width="2" stroke-linejoin="round"/>`,
    );
    // 顶点圆点
    for (let i = 0; i < N; i++) {
      const [x, y] = pt(i, R * scores[i]);
      parts.push(
        `  <circle cx="${fmt(x)}" cy="${fmt(y)}" r="3" fill="${color.stroke}"/>`,
      );
    }
  });

  // ── 4. 图例（多系列时右上）────────────────────────────────────
  if (hasLegend) {
    const lx = W - legendW + 16;
    let ly = 70;
    parts.push(`  <text x="${lx}" y="${ly - 8}" font-size="12" font-weight="bold" fill="#333333">图例</text>`);
    series.slice(0, SERIES_COLORS.length).forEach((s, si) => {
      const c = SERIES_COLORS[si];
      parts.push(`  <rect x="${lx}" y="${ly - 10}" width="14" height="14" fill="${c.fill}" stroke="${c.stroke}" stroke-width="2"/>`);
      parts.push(`  <text x="${lx + 22}" y="${ly + 1}" font-size="12" fill="#333333">${esc(s.name)}</text>`);
      ly += 24;
    });
    if (radarData?.note) {
      parts.push(`  <text x="${lx}" y="${ly + 6}" font-size="10" fill="#999999">${esc(String(radarData.note).slice(0, 60))}</text>`);
    }
  } else if (radarData?.note) {
    parts.push(`  <text x="${cx}" y="${H - 12}" text-anchor="middle" font-size="10" fill="#999999">${esc(String(radarData.note).slice(0, 90))}</text>`);
  }

  // ── 5. 系列超限截断提示（v1.7.1）──────────────────────────────
  // 仅渲染前 4 个系列（配色上限），超出时在图内明确标注，避免"系列丢失"无声发生
  if (series.length > SERIES_COLORS.length) {
    parts.push(
      `  <text x="${fmt(cx)}" y="${fmt(H - 12)}" text-anchor="middle" font-size="11" font-weight="bold" fill="#c0392b">注：系列数 ${series.length} 超过渲染上限 4，仅渲染前 4 个系列（我方+竞品A/B/C），其余已截断</text>`,
    );
  }

  parts.push(`</svg>`);
  return parts.join("\n");
}
