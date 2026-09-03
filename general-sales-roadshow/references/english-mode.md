# 英文 / 双语路演模式指南（english-mode）
> 适用对象：B2B 外贸、海外客户演示、国际展会、跨国集团采购等需要**用英文上台**的路演场景。
>
> 核心原则：**延续本技能"拒绝空泛套话、全部务实业务语言"的铁律**——英文话术同样不许"赋能/闭环"式虚词，每个句子都服务于一个具体业务动作（报价、给确定性、拿下一步承诺）。
>
> 两种产出口径：**纯英文版**（整场英文演示）与**中英双语版**（讲稿逐段中英对照，供主讲人口述英文、本地团队/翻译/记录者看中文）。本文件同时覆盖「英文话术模板」与「线上路演（Teams/Zoom）注意事项」两大块。
---
## 一、适用场景（什么时候切英文/双语模式）
| 场景 | 典型形态 | 建议口径 | 关键差异 |
|------|---------|---------|---------|
| B2B 外贸 / 跨境采购 | 海外买家对接、FOB/CIF 报价、出口路演 | 纯英文为主 | 语言是硬门槛，重点讲：港口/物流/关税/认证（CE/FDA/REACH/COC）、交付条款（INCOTERMS） |
| 海外客户远程演示 | 与海外采购团队远程会 | 双语并行 | 客户时差大、未必全员英文母语，节奏放慢，关键数字同时展示在 PPT 上 |
| 国际展会 / 海外峰会 | 线下 Booth 或大会发言 | 纯英文 + 一页双语关键页 | 台下听众杂、时间紧，话术要短句、口语化、高信息密度 |
| 跨国集团 / 外企子公司采购 | 总部流程 + 中国团队参与 | 中英双语 | 常出现"中国同事听中文、总部听英文"双线，需双语成稿与逐段对应 |
| 有翻译配合的正式会 | 交传/同传在场 | 中文主讲 + 英文补充版 | 按"翻译配合"一节控制节奏，给翻译留气口 |
> 判定口诀：**听众以英文为工作语言 → 纯英文；听众中英文混合 / 我方需留中文存档 → 双语；听众全中文但有外籍决策者 → 至少准备英文摘要页与英文 Q&A 要点。**
---
## 二、八模块结构的中英文对照
正式英文/双语成稿仍走八模块，仅标题替换为英文（或中英并列），**顺序与内容完整性不省略**：
| # | 中文模块 | English Module Title | 英文版要特别注意 |
|---|---------|----------------------|-----------------|
| 1 | 本次路演核心目标 | Core Objective of This Session | 用一句话讲清"今天结束时我们要拿到什么"，建议 3 个以内目标 |
| 2 | 客户细分品类定位 & 业务侧重点 | Category Positioning & Key Focus Areas | 先讲清客户所处价值链位置，再讲我方对应优势，避免英文长句绕晕听众 |
| 3 | 参会角色关注点拆解 | Stakeholder Concerns Breakdown | 逐个角色点名回应（Procurement / R&D / Production / Finance），英文版尤其要"点名" |
| 4 | 15分钟口语化完整路演讲稿 | Full Verbal Script (15 min) | 英文口语节奏比中文慢约 20%，**15 分钟对应约 1500–1800 词**，短句为主 |
| 5 | PPT大纲 | PPT Outline | 每页标题用**动词开头的行动句**（如 "Cut Your Lead Time by 30%"），数字前置 |
| 6 | 高频&尖锐问题应答库 | Hard Question Q&A Bank | 仍须覆盖 12 主题，英文版重点备好价格/交期/MOQ/合规/账期五类（见第四节） |
| 7 | 路演风险预警、临场应对方案 | Risk Alerts & On-the-spot Responses | 增加跨文化雷区（直译误伤、数字单位、时区）与线上技术风险（见第五节） |
| 8 | 路演结束后采购侧跟进动作清单 | Follow-up Action Checklist | 明确 next step 与时间点（send quote by / book a sample call on），英文版要写死时间与责任人 |
> 英文版问答库仍强制覆盖 12 个硬性主题（价格/交期/MOQ/资质合规/样品打样/供货稳定性/竞品对比/售后运维/IP保密/产品安全合规风险/账期/降本量化测算），仅语言切换，主题不缺项。
>
> **校验口径（v1.7.1 起，纯英文版走通）**：`scripts/roadshow_check.mjs` 已内置英文词表——纯英文成稿会被**自动识别**（也可 `--lang en` 强制、`--lang zh` 锁定中文），按英文模块标题与 12 主题英文词校验：
> - 八模块英文匹配片段：Core Objective / Category Positioning / Stakeholder Concerns / Verbal Script / PPT Outline / Q&A Bank / Risk Alerts / Follow-up Action Checklist（大小写不敏感、时长后缀不影响）；
> - 12 主题英文匹配词：price / lead time / moq / compliance / sampling / supply stability / competitor comparison / after-sales / ip protection / product safety / payment terms / cost saving；
> - 关键字段英文匹配词：selling point / price / moq / compliance / lead time / supply stability。
>
> 通过校验后可正常导出 PPT 渲染大纲与 .pptx（导出闸同样自动检测语言）。**中英双语版（模块标题中英对照）不受影响**——含中文模块标题即走中文词表。注意：反编造检查（规则⑤）与复盘纪要（`--minutes`）校验目前仅覆盖中文短语口径，英文稿以"英文朗读单测 + 中英数据一致性"两道人工检查兜底。
---
## 三、B2B 外贸高频英文话术模板（可直接口述）
> 用法：每类给"中文语境 → 可直接口述的英文句子（配中文注释）"。正式成稿时把 `[Your Company]`、`[XX days]` 等占位替换为真实数据；**没有真实数据就不许带数字念**，改念 "Let me confirm the exact number and get back to you."（我确认后答复您）。
### 3.1 开场白（Opening）
| 场景 | 英文原句（可直述） | 中文注释 |
|------|-------------------|---------|
| 自我介绍+来意 | "Good morning, everyone. Thank you for the time today. I'm [Name] from [Company], and today I want to walk you through how we can help you [core benefit]." | 早安各位，感谢抽时间。我是[姓名]，来自[公司]，今天想带大家看我们如何帮您[核心收益]。 |
| 说明时长与互动 | "We'll take about 15 minutes, and I'll leave time at the end for questions — please jump in any time." | 大约 15 分钟，最后留提问时间，随时可打断。 |
| 外籍高层在场 | "I know several of you are joining from overseas, so I'll keep the key numbers on every slide and slow down on the technical part." | 我知道有几位从海外接入，我会把关键数字放在每页上，并在技术部分放慢。 |
| 探明听众 | "Before I start — quick check: how many of you are primarily in procurement vs. R&D vs. operations?" | 开始前快速确认：各位主要来自采购、研发还是运营？ |
### 3.2 价值主张（Value Proposition）
| 场景 | 英文原句（可直述） | 中文注释 |
|------|-------------------|---------|
| 一句话定位 | "We are not just a supplier — we are a stability partner for your [category] line." | 我们不只是供应商，而是您[品类]产线的"稳定伙伴"。 |
| 讲收益而非参数 | "The point is not the spec sheet; the point is what the spec means for your line — fewer stoppages, shorter lead time, easier compliance." | 重点不是参数表，而是参数对您产线的意义——更少停机、更短交期、更易合规。 |
| 数字化价值主张 | "In plain numbers: [X]% lower defect rate, [Y] days shorter lead time, and [Z] in total cost savings per year." | 用数字说话：不良率低[X]%、交期缩短[Y]天、年综合降本[Z]。 |
| 可出示证据 | "I have the batch records and test reports here if you'd like to verify that on the spot." | 若需当场验证，批次记录与检测报告我都带来了。 |
### 3.3 竞品对比（Competitor Comparison）
| 场景 | 英文原句（可直述） | 中文注释 |
|------|-------------------|---------|
| 客观开场 | "I won't criticize any specific competitor. Let's compare on facts, side by side." | 我不贬低任何具体竞品，我们用事实逐项对比。 |
| 定量对比 | "On lead time, we deliver in [15] days versus [45] days in the market — that means you free up about [30] days of working capital." | 交期我们[15]天、市场普遍[45]天——意味着您省出约[30]天流动资金。 |
| 承认竞品优势 | "To be fair, [Competitor A] has a strong brand in [area]. What we offer is [differentiator] instead." | 公平地说，[竞品A]在[某方面]品牌很强。我们提供的是[差异点]。 |
| 收口到客户利益 | "So the real question isn't who is cheaper — it's who can keep your line running with less risk." | 所以真正的问题不是谁更便宜，而是谁能更低风险地让您的产线运转。 |
### 3.4 报价（Pricing）
| 场景 | 英文原句（可直述） | 中文注释 |
|------|-------------------|---------|
| 报价格梯度 | "Our pricing is tiered: at [1,000] units it's [price] per unit, and it drops to [price] at [5,000] units." | 我们按量分档：[1,000]个时单价[价格]，到[5,000]个降到[价格]。 |
| 讲综合成本 | "Our unit price may be slightly higher, but the total cost — including loss, freight, and downtime — is lower. Let me walk you through the math." | 我们单价可能略高，但含损耗、运费与停机的总成本更低，我给您算一下。 |
| 报价格不含糊 | "This quote is valid until [date], and it includes [what's included] — no hidden charges." | 该报价有效期至[日期]，包含[包含项]，无隐性费用。 |
| 被压价应对 | "I understand price matters. If you can share your target price and volume, I can see what levers we have — MOQ, payment terms, or packaging." | 我理解价格重要。若您告知目标价与数量，我可以看有哪些空间——起订量、付款条件或包装。 |
### 3.5 异议处理（Objection Handling）
> 高频五类异议：价格太贵 / 交期 / MOQ / 合规 / 账期。每条给"客户原话 → 应答句（中英注释）"。
**① 价格太贵（Too Expensive）**
| 客户原话 | 英文应答句 | 中文注释 |
|---------|-----------|---------|
| "Your price is too high." | "Compared to what — unit price or total cost? Let me show you the total-cost picture, including loss, freight, and rework." | 跟什么比——单价还是总成本？我给您看含损耗、运费、返工的总成本全貌。 |
| "Competitor B is 10% cheaper." | "That 10% can disappear quickly in one quality issue. Here's what a single rejected batch actually costs your line." | 那 10% 在一次质量事故里就没了。我给您算一个批次退货对产线的真实代价。 |
| 给台阶 | "I'm not asking you to decide today. Take the cost model back to your finance team, and we'll refine it together." | 我不要求您今天定。把成本模型带回去给财务，我们再一起优化。 |
**② 交期（Lead Time）**
| 客户原话 | 英文应答句 | 中文注释 |
|---------|-----------|---------|
| "Can you deliver within 30 days?" | "Our standard lead time is [X] days. For a rush order, we can do [Y] days with a confirmed PO and a small buffer stock arrangement." | 标准交期[X]天。加急单凭确认订单可做到[Y]天，并配合备货。 |
| "What if demand spikes?" | "We keep safety stock for key SKUs and have a backup production line — I can show you the inventory plan." | 我们对关键 SKU 备安全库存并有备用产线——我可以给您看库存计划。 |
**③ MOQ（最小起订量）**
| 客户原话 | 英文应答句 | 中文注释 |
|---------|-----------|---------|
| "Your MOQ is too high for a first trial." | "Our standard MOQ is [X]. For your first trial order, we can be flexible at [Y] — so you can validate quality before scaling up." | 标准 MOQ 是[X]。首单试单可放宽到[Y]，让您先验证质量再放量。 |
| "Can we start smaller?" | "Yes — we offer a trial order option. The trial price is slightly higher, but it's fully creditable against your first bulk order." | 可以，我们有试单方案。试单价略高，但可全额抵扣首批大单。 |
**④ 合规（Compliance）**
| 客户原话 | 英文应答句 | 中文注释 |
|---------|-----------|---------|
| "Do you have the certifications?" | "Yes — here's our [CE / FDA / ISO 9001 / REACH] certificate, and I can share the full document package after the call." | 有——这是我们的[CE/FDA/ISO9001/REACH]证书，会后我可发完整文件包。 |
| "Can you prove batch compliance?" | "Every batch ships with a Certificate of Analysis, and we keep samples for [X] months for traceability." | 每批次随货附 COA（分析报告），留样[X]个月供追溯。 |
| 无证不编 | "I don't have that certificate in hand today — let me confirm with our compliance team and get back to you within 2 business days." | 这份证书今天没带，我向合规团队确认后 2 个工作日内答复您。 |
**⑤ 账期（Payment Terms）**
| 客户原话 | 英文应答句 | 中文注释 |
|---------|-----------|---------|
| "Can we pay on 90-day terms?" | "Our standard terms are [X] days after invoice. For 90 days, we'd need a credit check and a confirmed annual volume." | 标准账期是发票后[X]天。90 天账期需做信用评估并确认年采购量。 |
| "Why cash terms on first order?" | "For the first order we typically go cash or 30 days, to build a track record — then we can offer more flexible terms." | 首单通常现结或 30 天以建立合作记录，之后可给更灵活账期。 |
**通用兜底句（任何答不上来的英文异议）**：
- "That's a fair question. Let me confirm the exact details with my team and reply by [date/time]."（问得合理，我和团队确认细节，[时间]前答复您。）
- "I don't want to give you a guess on that. Give me 24 hours and I'll come back with a confirmed answer."（这个我不猜，给我 24 小时确认后答复。）
- "Could you help me understand what's driving that requirement?"（能帮我理解下这个要求背后的原因吗？）——反问定域，避免答错赛道。
### 3.6 行动承诺（Next Steps / Call to Action）
| 场景 | 英文原句（可直述） | 中文注释 |
|------|-------------------|---------|
| 收口行动 | "So here's what I propose: I send you the quote and the sample kit by [Thursday], and we book a follow-up call next week to go through the trial plan." | 我的建议是：[周四]前发您报价与样品包，下周约一次跟进会聊试单方案。 |
| 拿明确承诺 | "What's the one next step you need from us to move this forward?" | 要推进这件事，您需要我们做的下一个动作是什么？ |
| 给时间窗 | "If we can get your PO by [date], we can guarantee delivery before [date]." | 若[日期]前收到您的订单，我们可保证[日期]前交付。 |
| 留文档 | "I'll share the deck, the certificate package, and the cost model — all in one folder — so your team has everything to decide." | 我会把方案、证书包与成本模型放一个文件夹发给您，让团队决策所需齐全。 |
---
## 四、线上路演（Teams / Zoom）特殊注意事项
> 线上路演与线下最大区别：**信任建立在"画面、声音、共享屏、响应速度"上**，且跨国场景叠加时差、网络、语言三重风险。以下为必须纳入【路演风险预警、临场应对方案】模块的内容。
### 4.1 画面与声音（Video & Audio）
| 注意项 | 具体要求 |
|--------|---------|
| 摄像头与光线 | 开摄像头（英文演示尤其要"看得到表情"建立信任）；正对光源、背景整洁，避免逆光黑脸 |
| 画面范围 | 上半身入镜，眼睛看镜头（不要盯屏幕上的自己） |
| 麦克风 | 用独立麦克风/耳机麦；提前测试回声；多人同屋时全员静音，主讲人独占开麦 |
| 语速与停顿 | 英文不是母语听众时，**语速降 20%**，每句后留半秒；重要数字重复一遍 |
| 环境降噪 | 关窗、关通知、关手机铃声；背景用纯色或品牌虚化，不用动态背景 |
### 4.2 共享屏幕（Screen Sharing）
| 注意项 | 具体要求 |
|--------|---------|
| 提前共享材料 | 会前把 PDF/PPT 发到会议群，保证客户断网也能自己打开（见 4.4 预案） |
| 只共享必要窗口 | 只共享演示窗口，**不要共享整个桌面**——避免邮件、聊天、内部标签页泄露 |
| 数字放大 | 英文版 PPT 字号加大、每页要点 ≤5 条；报价表、ROI 表格单独一页放大呈现 |
| 共享前确认 | 开播前问一句："Can everyone see the screen clearly?"（各位能看清屏幕吗？） |
| 批注与指针 | 用平台自带的批注/指针功能圈出关键数字，比口头指"see the table"更有效 |
### 4.3 时差安排（Time Zone Management）
| 注意项 | 具体要求 |
|--------|---------|
| 用客户时区定时间 | 以**客户当地时间**提议时间段，避免"北京时间早上=客户凌晨"的乌龙；用 Doodle/Calendly 等工具让客户选 |
| 明确写出时区 | 会议邀请写清双方时区（如 10:00 AM Beijing / 07:00 PM PDT），防止误读 |
| 避开客户低效时段 | 欧美客户周一上午、周五下午通常低效，优先约周二–周四客户当地上午/午后 |
| 我方提前到场 | 提前 10–15 分钟上线测试音画；不等客户迟到就干等，准备好开场暖场词 |
| 冬令时/夏令时 | 确认客户当前是否夏令时（如美东 EDT vs EST），差 1 小时会毁掉整场会议 |
### 4.4 网络中断预案（Connectivity Contingency）
| 层级 | 预案 |
|------|------|
| 会前 | 双网络（主 WiFi + 手机热点）；本地提前下载所有材料，**不依赖云端打开** |
| 中断时 | 立即切备用网络；若画面卡顿优先保声音（"Let me switch to audio-only."）；客户断线时马上在群里发材料链接与文字纪要 |
| 严重中断 | 备设备用号码/备用平台（Zoom 断则 Teams 接、Teams 断则电话拨入）；明确 "if we drop, let's reconvene in 5 minutes" |
| 录屏兜底 | 若技术事故反复，可建议改用"先录屏演示 + 会后答疑"的异步模式，但**录屏必须先征得客户同意** |
### 4.5 翻译配合（Working with an Interpreter）
| 注意项 | 具体要求 |
|--------|---------|
| 会前给翻译材料 | 提前把双语讲稿/术语表发给翻译（交传或同传），尤其品类行话、认证缩写（CE/FDA/REACH/COA/MOQ） |
| 控制句长 | 每句控制在 15–20 秒内，讲一个完整意思后停，给翻译留气口；不要一口气讲 3 分钟 |
| 数字放慢 | 报价、交期、百分比等数字读慢并重复；让翻译/客户确认："So 30 days, correct?" |
| 确认理解 | 关键承诺后问一句："Did that come across clearly?"（刚才那段传达清楚了吗？） |
| 尊重翻译 | 不打断翻译、不抢话；翻译出错时礼貌复述而非纠正 |
### 4.6 录屏合规（Recording Compliance）
| 注意项 | 具体要求 |
|--------|---------|
| 先问再录 | **录制前必须征得客户同意**——"Would you be comfortable if I record this session so I don't miss any details?" |
| 说明用途 | 明确录制用途（内部记录/跟进纪要），承诺不外传、不用于营销 |
| 客户先录 | 若客户提出录制，我方保留一份副本作为订单依据 |
| 会后纪要 | 无论是否录制，会后 24h 内发文字纪要（英文）+ 待办清单，作为"留痕"与跟进依据 |
| 数据合规 | 涉及 NDA/保密客户时，录制内容按保密要求存储，涉及 GDPR/个保法信息不落非授权存储 |
### 4.7 线上跨文化雷区（补充）
| 雷区 | 说明 |
|------|------|
| 直译误伤 | 中文客套"没问题""好说"直译成 "No problem" 在部分市场显得轻慢，改 "Certainly, we can handle that." |
| 数字单位 | 明确 Metric/Imperial、货币币种与汇率口径（USD/EUR/CNY），报价单上写死币种与有效期 |
| 时区玩笑 | 不要调侃客户时差或"你们那边是半夜吧"，保持专业 |
| 称呼 | 不确定头衔时用 Mr./Ms. + 姓，或直接问 "How would you like me to address you?" |
| 打断习惯 | 部分市场习惯插话提问，不要因被打断而慌乱，先接问题再回主线 |
---
## 五、中英双语版本输出的建议流程
> 适用：客户中英混合 / 需留中文存档 / 有翻译配合。双语版不是"两套材料"，而是**一份主稿 + 逐段英文对照**，保证中英信息完全一致、不出现"中文讲 A 英文讲 B"。
**流程（四步）：**
1. **先出中文成稿**：按 SKILL.md 八模块正常产出中文完整成稿（数据、口径、合规全在中文版把关）。
2. **逐模块英译**：按本文件第二节的模块英文标题逐段翻译，**保持同一编号与同一份数据**——英文版只改语言，不改内容、不增减数据。
3. **嵌入对照格式**：双语版建议用「中文段落 + 英文段落紧邻」的逐段对照，或表格左中右对照（模块 / 中文 / English），避免"前半中文后半英文"的断层。
4. **英文版单测**：交付前跑一次**英文朗读测试**——逐句读一遍，删掉任何"书面语长句"（一句话超过 30 词就拆短句），确保能直接口述。
**双语版输出格式建议（Markdown）：**
```markdown
## 【本次路演核心目标 / Core Objective of This Session】
- 中文：[目标陈述]
- EN: [English version of the same objective]
```
> 每页 PPT 同理：标题中英并列，正文以客户主要语言为主、辅以关键数字双语标注。
**双语版红线**：
- 英文版与中文版**数据必须一致**（价格/交期/MOQ/日期币种），不一致 = 重大事故；
- 英文版**不许新增中文版没有的承诺**，也不许删减风险项；
- 无法确认的英文表达用兜底句（见 3.5 通用兜底句），不硬翻、不编。
---
> 使用说明：本文件是英文/双语模式的**语言与执行层手册**，内容逻辑仍以 SKILL.md 八模块与 `references/` 各手册为准。成稿仍须通过 `scripts/roadshow_check.mjs` 合规校验——校验器自动检测语言：**纯英文稿按英文词表校验**（v1.7.1 起支持校验并导出），双语版按中文词表校验；需要时可用 `--lang en` / `--lang zh` 强制指定。英文版在校验通过后追加"英文朗读单测 + 中英数据一致性"两道人工检查。
