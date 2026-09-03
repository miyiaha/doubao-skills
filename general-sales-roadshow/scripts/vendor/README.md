# scripts/vendor/ — 自包含 PPT 渲染引擎

本目录存放 `.pptx 技能内直出`功能所需的自包含渲染引擎。

## 文件说明

| 文件 | 大小 | 用途 |
|------|------|------|
| `pptxgen.standalone.cjs` | ~708KB | pptxgenjs 经 esbuild 打包为单文件（含 JSZip 等全部依赖），Node ≥18 / Deno 双运行时零 npm、零网络加载，由 `roadshow_build_pptx.mjs` 用 `createRequire` 引用 |

## 为什么仓库里没有这个文件？

`pptxgen.standalone.cjs` 是第三方库（pptxgenjs）的打包产物，体积约 708KB。为保持仓库轻量，本仓库不直接提交该二进制文件，而是提供一键构建脚本。

## 一键安装（推荐）

在技能根目录运行：

```bash
bash scripts/install_vendor.sh
```

脚本会自动：
1. 检查 Node.js ≥ 18 是否可用
2. 在临时目录 `npm install pptxgenjs esbuild`
3. 用 esbuild 将 pptxgenjs 打包为自包含单文件
4. 输出到 `scripts/vendor/pptxgen.standalone.cjs`
5. 清理临时目录

整个过程约 30 秒，无需全局安装任何工具，不修改项目结构。

## 手动安装（备选）

如果一键脚本失败，可手动执行：

```bash
# 1. 创建临时构建目录
mkdir -p /tmp/pptxgen-build && cd /tmp/pptxgen-build

# 2. 初始化并安装依赖
npm init -y
npm install pptxgenjs esbuild

# 3. 创建入口文件
cat > entry.cjs << 'EOF'
module.exports = require("pptxgenjs");
EOF

# 4. 用 esbuild 打包为自包含 CJS 单文件
npx esbuild entry.cjs --bundle --platform=node --format=cjs --outfile=pptxgen.standalone.cjs

# 5. 复制到技能 vendor 目录
cp pptxgen.standalone.cjs /path/to/general-sales-roadshow/scripts/vendor/
```

## 验证安装

安装完成后，运行测试 harness 验证 `.pptx 直出`功能：

```bash
node scripts/roadshow_test_harness.mjs
# 用例 C22（.pptx 技能内直出）应通过
```

或直接运行：

```bash
node scripts/roadshow_build_pptx.mjs references/saas-pitch-example.md
# 应生成 references/saas-pitch-example.pptx
```

## 未安装时的行为

如果 `pptxgen.standalone.cjs` 不存在：
- `roadshow_check.mjs`（合规校验）— **不受影响**，正常运行
- `roadshow_test_harness.mjs`（测试 harness）— C22 用例会失败，其他 28 个用例正常
- `roadshow_export_pptx.mjs`（PPT 大纲导出）— **不受影响**，正常运行（SVG 雷达图也正常）
- `roadshow_build_pptx.mjs`（.pptx 直出）— 会报 `Cannot find module` 错误，提示安装 vendor

## 版本信息

- pptxgenjs：最新稳定版（安装时自动获取）
- 打包工具：esbuild
- 兼容运行时：Node.js ≥ 18、Deno（支持 `createRequire`）
- 许可证：MIT（pptxgenjs 本身为 MIT 协议）
