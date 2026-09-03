# 豆包工作技能合集

作者：liucaiwei

本仓库收录了基于豆包工作（Doubao Work）平台开发的可复用 Skill，覆盖采购管理与销售路演两大场景。所有技能均经过逻辑验证、自动化测试和健壮性修复，可直接安装使用。

## 技能列表

### 1. 采购多维表格搭建（procurement-bitable-builder）
- **版本**：v2.1.2
- **一句话**：安装后一句话生成覆盖采购全流程的多维表格体系
- **核心能力**：23张标准表、50+飞书原生公式、S/A/B/C/D五级供应商分级、卡拉杰克品类策略矩阵、风险与库存预警、降本量化追踪
- **适用人群**：采购从业者、供应链负责人
- **测试状态**：61 项公式校验全部通过（基线复算 / 边界测试 / 跨文档一致性）

### 2. 通用销售路演（general-sales-roadshow）
- **版本**：v1.7.2
- **一句话**：输入路演需求，10分钟生成8大模块完整输出
- **核心能力**：口语化演讲稿、PPT大纲、12行业主题Q&A应答库、竞品雷达图、.pptx直出、29项合规自动校验、英文/双语模式、路演复盘纪要
- **适用人群**：ToB销售、售前、创业者
- **测试状态**：29 项测试用例全部通过（正向 / 负向 / 边界 / 反编造 / 竞品定量化 / PPT导出 / .pptx直出 / 英文模式）

## 目录结构

```
.
├── README.md
├── procurement-bitable-builder/   # 采购多维表格搭建技能
│   ├── README.md
│   ├── SKILL.md                    # author: liucaiwei
│   ├── references/                 # 11 个参考手册
│   └── scripts/                    # 公式校验脚本 + 测试
└── general-sales-roadshow/        # 通用销售路演技能
    ├── README.md
    ├── SKILL.md                    # author: liucaiwei
    ├── references/                 # 11 个参考手册
    ├── assets/                     # 录入表 + 模板
    └── scripts/                    # 校验 / 导出 / 测试 / vendor 安装
        ├── vendor/                 # 第三方渲染引擎（需一键安装）
        └── install_vendor.sh       # 一键安装 vendor 引擎
```

## 快速开始

### 安装到豆包工作

1. 克隆或下载本仓库
2. 在豆包工作中导入对应 Skill 目录（`procurement-bitable-builder/` 或 `general-sales-roadshow/`）
3. 按技能内 `SKILL.md` 说明使用

### 启用销售路演的 .pptx 直出功能（可选）

销售路演技能的 `.pptx 技能内直出`功能依赖自包含渲染引擎（pptxgenjs，约 708KB）。为保持仓库轻量，该文件不直接提交，需一键安装：

```bash
cd general-sales-roadshow
bash scripts/install_vendor.sh
```

脚本会自动在临时目录 `npm install pptxgenjs esbuild`，用 esbuild 打包为自包含单文件，输出到 `scripts/vendor/pptxgen.standalone.cjs`，完成后自动清理。整个过程约 30 秒，无需全局安装任何工具。

> 不安装 vendor 也不影响其他功能：合规校验、PPT 大纲导出、SVG 雷达图、29 项测试中的 28 项均可正常运行。仅 `.pptx 直出`（测试用例 C22）需要 vendor。

## 测试验证

两个技能均内置自动化测试，可在本地一键回归：

### 采购多维表格搭建

```bash
cd procurement-bitable-builder
bash scripts/test.sh
# 61 项公式校验：基线复算 / 边界测试 / 跨文档一致性
```

### 通用销售路演

```bash
cd general-sales-roadshow
bash scripts/test.sh
# 4 步回归：CLI 体检 → 29 项 harness → PPT 大纲导出 → .pptx 直出（需 vendor）
```

所有测试均支持 Node.js ≥ 18 和 Deno 双运行时，无需额外依赖。

## 修复记录

### v2.1.2（采购包）
1. 预测偏差率公式增加除零保护（IF(实际需求量>0, ..., 0)）
2. 预测准确率钳制为非负（MAX(0, 100-偏差率)）
3. 卡拉杰克象限公式补全前置字段「品类阈值」「风险等级」
4. S/A/B/C/D 等级双重定义冲突修复（统一为分数口径）
5. 谈判达成率底线价语义修正 + >=100 改为 >100
6. 新增 61 项公式自动校验脚本

### v1.7.2（销售包）
1. 临时目录可写回退（系统 /tmp 不可写时自动回退到 .roadshow-tmp，避免 EACCES 静默失败）
2. 回归脚本自愈（test.sh 输出目录统一走 make_tmp_dir）
3. 来源署名：frontmatter `author: liucaiwei`

## 作者

liucaiwei · 明月海藻集团采购部

## 许可证

MIT
