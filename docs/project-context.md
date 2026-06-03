# 征信报告解析系统 — 项目上下文文档

> 本文档用于在新对话中快速恢复项目上下文。最后更新时间：2025年7月。

---

## 一、项目概述

**项目名称：** LoanIntelligence Parser（助贷征信解析专家）

**核心功能：** 上传央行二代个人征信报告 PDF（扫描件或电子版），通过 OCR + 结构化解析，自动提取全部字段并填充到表单中。

**技术栈：** Electron 40 + TypeScript 5 + React 19 + Vite 7 + Ant Design 6 + TailwindCSS 4 + pdfjs-dist

**运行方式：** `npm run dev`（concurrently 启动 Vite + Electron）

---

## 二、系统架构

```
渲染进程 (Renderer)                          主进程 (Main)
┌─────────────────────┐                    ┌──────────────────┐
│ PDF 上传             │                    │ Electron Main    │
│   ↓                 │                    │                  │
│ pdf.js 文本直提      │                    │ IPC: ocr:recognize│
│   ↓ (< 50字符?)     │    IPC 调用         │   ↓              │
│ 扫描件 ─────────────┼──────────────────→ │ 百度文档解析 API  │
│                     │ ←─────────────────┼── DocParserResult │
│ extractTextFromDoc  │                    │                  │
│ + extractTablesFrom │                    │ IPC: ocr:parseDoc │
│   ↓                 │                    └──────────────────┘
│ 三模式解析引擎       │
│   ↓                 │
│ ClientProfile       │
│   ↓                 │
│ 表单展示 + 人工校对   │
└─────────────────────┘
```

**关键设计：**
- API 调用放在 Electron 主进程（Node.js），避免 CORS。
- 扫描件走百度文档解析 API（异步提交+轮询），电子版走 pdf.js 直提。
- 渲染进程通过 `window.electronAPI.parseDocument(base64, fileName)` 和 `window.electronAPI.ocrRecognize(base64)` 发起 IPC 调用。

---

## 三、百度 API 配置

- AppID: `122070194`
- API Key: `jPtaPd2ST83RWbG0D1XLldEZ`
- Secret Key: `58Wkn7zEwWz1IAjWiLLTdCuIQzrLC0LJ`
- Token 自动缓存，30天有效期内复用

### 百度文档解析 API（主力，扫描件专用）

- 提交：`POST https://aip.baidubce.com/rest/2.0/brain/online/v2/parser/task`（file_data + file_name）
- 轮询：`POST https://aip.baidubce.com/rest/2.0/brain/online/v2/parser/task/query`（task_id）
- 结果：下载 `parse_result_url` JSON → `DocParserResult`
- QPS：submit=2, query=10；轮询间隔 3s，最多 40 次（2 分钟超时）
- 百度云控制台需开通：文档解析 + 文档解析-提交请求 + 文档解析-获取结果（在"智能文档分析"下）

### 百度 OCR 高精度版（保留，电子版回退用）

- 接口：通用文字识别（高精度版）accurate

---

## 四、目录结构

```
src/
├── main/                          # Electron 主进程
│   ├── index.ts                   # 主窗口 + IPC handler（ocr:recognize + ocr:parseDocument）(51行)
│   ├── preload.ts                 # contextBridge 暴露 ocrRecognize + parseDocument (14行)
│   ├── baidu-ocr.ts               # 百度 API 客户端（OCR + 文档解析 submit/poll/download）(180行)
│   └── ocr-config.ts              # API Key 配置
│
├── shared/
│   └── doc-parser-types.ts        # 百度文档解析 API 类型定义（DocParserResult/DocPage/DocTable 等）(84行)
│
├── renderer/
│   ├── types/
│   │   ├── credit-report.ts       # 完整征信报告数据模型（537行）
│   │   ├── client-profile.ts      # UI 表单 13 字段简化模型 + OcrResult
│   │   └── electron.d.ts          # window.electronAPI 类型声明
│   │
│   ├── parser/                    # ★ 解析引擎
│   │   ├── index.ts               # 解析入口 + 置信度计算 (158行，含 debug 日志)
│   │   ├── block-types.ts         # 区块类型定义（Level1Block/Level2Block/BlockMap）
│   │   ├── block-recognizer.ts    # 区块识别器（边界切割）
│   │   ├── markdown-table-parser.ts # ★ Markdown 表格解析 + getValueByCol/getValuesBelow (156行)
│   │   ├── doc-table-bridge.ts    # DocParserResult → ContextTable[] 桥接 + findTableByKeyword (102行)
│   │   ├── table-rebuilder.ts     # OCR 坐标 → 结构化表格重建（旧路径）
│   │   ├── table-lookup.ts        # 表格查找工具（列位置匹配，旧路径）
│   │   └── block-parsers/
│   │       ├── header-parser.ts       # 报告头解析 (108行)
│   │       ├── identity-parser.ts     # 身份/配偶/工作单位 (175行)
│   │       ├── summary-parser.ts      # ★ 查询概要+负债概要（三模式）(519行，超限需拆分)
│   │       ├── account-overdue-parser.ts  # 逾期汇总+月供 (248行)
│   │       ├── summary-from-accounts.ts   # 账户明细反算汇总 (210行)
│   │       └── profile-bridge.ts      # → ClientProfile 桥接+交叉验证 (140行)
│   │
│   ├── services/
│   │   ├── ocr-service.ts         # ★ 核心编排：PDF→文档解析→fullText→解析引擎 (154行，含 debug 日志)
│   │   ├── baidu-ocr.ts           # 渲染进程侧 IPC 代理（ocrRecognize + parseDocument）
│   │   └── pdf-to-image.ts        # PDF 逐页转 base64 图片
│   │
│   ├── components/
│   │   ├── CreditForm.tsx         # 征信表单组件
│   │   └── PdfViewer.tsx          # PDF 预览组件
│   │
│   ├── config/ocr-config.ts       # OCR 配置（渲染进程侧）
│   └── App.tsx                    # 主应用组件 (60行)
│
├── package.json                   # main 字段指向 dist/main/main/index.js（注意编译路径）
└── tsconfig.main.json             # rootDir: "src" → 输出到 dist/main/main/ 和 dist/main/shared/
```

---

## 五、核心问题与解决历程

### 问题链

1. **扫描件无文本** → pdf.js 只能提取电子版文本层 → 集成百度 OCR
2. **CORS 拦截** → 浏览器直调百度 API 被拦 → 移到 Electron 主进程 via IPC
3. **正则解析全部失败** → OCR 文本中 label 和 value 不在同一行 → 加跨行扫描
4. **跨行扫描匹配错误** → 多列表格被 OCR 线性化后列间内容交错 → 根本性架构问题
5. **OCR 高精度版精度不足** → 循环贷汇总数值严重偏差 → 战略转向百度文档解析 API
6. **文档解析 API 返回 Markdown 表格** → fullText 含原始 `| col | col |` 语法 → 行模式正则失配 → 全部字段为空
7. **DocParser 表格两行表头结构** → `getRowValues` 找到标签行返回同行其余列（其他标签）而非下一行的值 → 数值全为 0

### 战略决策历程

**第一阶段：区块化结构解析**
放弃"拿关键词在全文中捞值"，改为区块识别 + 区块内解析。

**第二阶段：百度文档解析 API 替代 OCR**
OCR 高精度版对多列表格的线性化输出无法可靠配对 label-value。百度文档解析 API 直接接收 PDF，输出结构化 Markdown 表格（含行列结构），从根本上解决了表格解析问题。

---

## 六、三模式解析架构（当前）

每个 parser 有三条路径，优先级从高到低：

1. **DocParser 模式**（扫描件主力）：从 `ContextTable[]` 按关键词查找表格，用 `getValueByCol` / `getValuesBelow` 按列标签取值
2. **RebuiltTable 模式**（旧路径保留）：OCR 坐标重建表格，`matchLabelValues` 按列位置匹配
3. **行模式**（电子版 PDF 回退）：正则匹配纯文本行

### 百度文档解析 API 表格结构特征

百度 API 返回的 Markdown 表格有特殊的两行表头结构：

**负债汇总表（非循环贷/循环贷/贷记卡）：**
```
headers: [非循环贷账户信息汇总, 非循环贷账户信息汇总, ...]  ← 类别标题（合并单元格，重复）
row[0]:  [管理机构数, 账户数, 授信总额, 余额, 最近6个月平均应还款]  ← 字段标签
row[1]:  [2, 2, 300,000, 201,667, 11,029]  ← 实际值
```

**查询概要表（更复杂的两行表头）：**
```
headers: [最近1个月内的查询机构数, ..., 最近1个月内的查询次数, ..., 最近2年内的查询次数, ...]  ← 8列
row[0]:  [贷款审批, 信用卡审批, 贷款审批, 信用卡审批, 本人查询, 贷后管理, 担保资格审查, 特约商户实名审查]
row[1]:  [0, 0, 0, 0, 1, 70, 10, 0]
```

### 关键工具函数（markdown-table-parser.ts）

| 函数 | 用途 | 适用场景 |
|------|------|----------|
| `getValueByCol(table, colLabel, keyword?)` | 在标签行找列索引，从值行取对应值 | 负债汇总表（标签在 row[0]，值在 row[1]） |
| `getValuesBelow(table, labelKeyword)` | 找到含关键词的行，返回下一行全部值 | 通用的两行表头表格 |
| `getRowValues(table, labelKeyword)` | 找到第一列含关键词的行，返回同行其余列 | 传统 label-in-first-（旧路径） |
| `findLabelAndValueRows(table, keyword?)` | 定位标签行和值行的配对关系 | 内部辅助函数 |

### fullText 转换流程（ocr-service.ts）

```
DocParserResult.pages[].layouts
  → type='table' → 找到对应 tables[].markdown → markdownTableToPlainLines()
  → type!='table' → layout.text → convertTextWithTables()（检测内嵌 Markdown 表格并转换）
  → 拼接为 fullText（每个唯一单元格值一行，去重合并单元格）
```

`markdownTableToPlainLines()` 将 `| 性别 | 性别 | 出生日期 | 婚姻状况 |` 转为：
```
性别
出生日期
婚姻状况
```
这样行模式正则（如 `/^性别$/`）就能正常匹配。

---

## 六、数据模型设计（已完成）

文件：`src/renderer/types/credit-report.ts`（537行）

### 顶层结构 `CreditReport`

| 字段 | 类型 | 说明 |
|------|------|------|
| header | ReportHeader | 报告头（编号、时间、姓名、证件号） |
| personalInfo | PersonalInfo | 个人基本信息（身份/配偶/居住/职业/手机） |
| summary | InfoSummary | 信息概要（信贷提示/违约/授信负债/查询） |
| creditDetail | CreditDetail | 信贷交易明细（5种账户类型） |
| nonCreditDetail | NonCreditDetail \| null | 非信贷交易信息 |
| publicInfo | PublicInfo \| null | 公共信息（公积金/养老） |
| queryRecord | QueryRecord | 查询记录（机构/本人） |
| selfDeclaration | string \| null | 本人声明 |
| disputeAnnotation | string \| null | 异议标注 |
| disputeInfo | DisputeInfo | 异议信息提示 |
| repayResponsibilities | RepayResponsibilityAccount[] | 相关还款责任明细 |
| creditAgreements | CreditAgreement[] | 授信协议信息 |

### 设计原则

- 金额单位：元（人民币），前端展示时再转换
- 日期：原始字符串（如 `"2025.01.20"`），不做 Date 转换
- `null` = 报告中未出现该信息
- `undefined` = 解析失败
- 每个账户包含 `specialTransactions[]`（特殊交易）和 `repaymentRecords[]`（还款记录）
- 预留了准贷记卡、公共信息、异议信息等当前报告中未出现但标准格式中存在的模块

### 关键子类型

- **LoanAccount** — 非循环贷/循环贷账户一（含逾期分段、还款记录）
- **RevolvingLoanAccount** — 循环贷账户二（授信额度型）
- **CreditCardAccount** — 贷记卡（含大额专项分期 LargeInstallment）
- **QuasiCreditCardAccount** — 准贷记卡
- **RepaymentRecord** — 单年还款记录（year + 12个月状态码）
- **SpecialTransaction** — 特殊交易（提前结清等）

---

## 七、区块识别器（已完成，已验证）

文件：`src/renderer/parser/block-types.ts` + `src/renderer/parser/block-recognizer.ts`

### 区块层级

```
Level1Block（一级，6个）
├── REPORT_HEADER        报告头
├── PERSONAL_INFO        个人基本信息
├── INFO_SUMMARY         信息概要
├── CREDIT_DETAIL        信贷交易信息明细
├── QUERY_RECORD         查询记录
└── REPORT_NOTE          报告说明

Level2Block（二级，17个）
├── 个人基本信息下：IDENTITY_INFO / SPOUSE_INFO / RESIDENCE_INFO / JOB_INFO / PHONE_INFO
├── 信息概要下：CREDIT_HINT / DEBT_SUMMARY / QUERY_SUMMARY
├── 信贷明细下：NON_REVOLVING_LOAN / REVOLVING_LOAN_TYPE1 / REVOLVING_LOAN_TYPE2
│               CREDIT_CARD / REPAY_RESPONSIBILITY / CREDIT_AGREEMENT
├── 查询记录下：ORG_QUERY / SELF_QUERY
└── DISPUTE_INFO

AccountBlock（三级，动态）
└── 每个贷款/信用卡账户一个区块，带 parentBlock 标识所属类型
```

### 识别策略

- 逐行扫描，宽松正则匹配标题（自动去除中文数字前缀噪声）
- 页码噪声（`第N页，共N页`）自动跳过
- 遇到新标题 → 关闭上一个区块 → 开启新区块
- 输出 `BlockMap`：`{ level1, level2, accounts }`
- 工具函数：`getBlockLines()` / `getLevel1Lines()` / `getLevel2Lines()`

### 防误匹配机制（v2 修复）

1. **短行约束** — 标题行长度 ≤ 30 字符，超过的视为正文跳过（排除报告说明中的长句误匹配）
2. **层级约束** — 二级标题规则带 `parentL1` 字段，只在对应一级区块内生效（如 `身份信息` 只在 `PERSONAL_INFO` 内匹配）
3. **报告说明截断** — 进入 `REPORT_NOTE` 后停止所有标题匹配（报告说明和编制说明中包含大量关键词）
4. **账户标题不受长度限制** — 带授信协议标识的账户标题可能很长

### 验证结果（2025年7月，真实 OCR 文本 4741 行）

一级区块（6/6 正确）：
```
REPORT_HEADER    行   0-  61   (62行)
PERSONAL_INFO    行  62- 198  (137行)
INFO_SUMMARY     行 199- 471  (273行)
CREDIT_DETAIL    行 472-4102 (3631行)
QUERY_RECORD     行4103-4606  (504行)
REPORT_NOTE      行4607-4740  (134行)
```

二级区块（15/17 正确识别）：
- ✅ CREDIT_HINT / DEBT_SUMMARY / QUERY_SUMMARY
- ✅ NON_REVOLVING_LOAN / REVOLVING_LOAN_TYPE1 / REVOLVING_LOAN_TYPE2
- ✅ CREDIT_CARD / REPAY_RESPONSIBILITY / CREDIT_AGREEMENT
- ✅ ORG_QUERY / SELF_QUERY / IDENTITY_INFO / SPOUSE_INFO / DISPUTE_INFO
- ⚠️ JOB_INFO 只有1行（OCR 乱序：职业信息标题紧接身份信息标题）
- ⚠️ RESIDENCE_INFO 未识别（OCR 将其排到报告头区域，parentL1 约束正确拦截）
-  PHONE_INFO 无对应标题规则（待补充）

账户区块：共识别 35 个（6 非循环贷 + 3 循环贷一 + 13 循环贷二 + 13 贷记卡）

### 已知 OCR 乱序问题

OCR 将多页 PDF 线性化时，不同区域的内容可能交错排列：
- 居住信息标题出现在行7（报告头区域内），实际内容在 PERSONAL_INFO 区块中
- 职业信息标题(行63)紧接身份信息标题(行64)，导致 JOB_INFO 只有1行
- 这些是 OCR 输出特征，不是识别器 bug，后续区块解析器需要处理

---

## 八、区块解析器（三模式，开发中）

### 解析管线

```
PDF → analyzeCreditReport()
  → 电子版: pdf.js 直提 fullText
  → 扫描件: 百度文档解析 API → DocParserResult
      → extractTextFromDocParser() → fullText（Markdown 表格转纯文本行）
      → extractTablesFromDoc() → ContextTable[]（91张结构化表格）

fullText → lines → recognizeBlocks(lines) → BlockMap
  → parseHeader(headerLines)                          → ReportHeader
  → parseIdentity(personalLines)                      → IdentityInfo
  → parseLatestCompany(personalLines)                 → string
  → parseQuerySummary(queryLines, table?, docTables)  → QuerySummary
  → parseDebtSummary(debtLines, table?, docTables)    → DebtSummary
  → aggregateAccountOverdue(lines, accounts, table?, docTables)
  → computeSummaryFromAccounts(lines, accounts, table?, docTables)
  → buildClientProfile(...)                           → ClientProfile（UI表单用）
```

### 解析器文件（当前行数）

| 文件 | 职责 | 行数 |
|------|------|------|
| `block-parsers/header-parser.ts` | 报告头（姓名/证件号/查询机构/原因） | 108 |
| `block-parsers/identity-parser.ts` | 身份信息/配偶/最新工作单位 | 175 |
| `block-parsers/summary-parser.ts` | ★ 查询概要+负债概要（三模式） | 519 ⚠️超限 |
| `block-parsers/account-overdue-parser.ts` | 逾期汇总+月供合计 | 230 |
| `block-parsers/summary-from-accounts.ts` | 从账户明细反算汇总值 | 202 |
| `block-parsers/profile-bridge.ts` | → ClientProfile 桥接+交叉验证 | 136 |
| `parser/index.ts` | 解析入口+置信度计算 | 158（含 debug） |
| `parser/markdown-table-parser.ts` | ★ Markdown 表格解析工具 | 156 |
| `parser/doc-table-bridge.ts` | DocParserResult → ContextTable[] | 102 |
| `parser/table-lookup.ts` | 表格查找（列位置匹配，旧路径） | ~130 |
| `parser/table-rebuilder.ts` | OCR 坐标→结构化表格重建（旧路径） | ~124 |
| `services/ocr-service.ts` | ★ 核心编排+fullText 转换 | 154（含 debug） |

### DocParser 模式关键实现

- `parseQueryFromDoc()` — 用 `sumByHeaderRange(headers, values, keyword)` 按 headers 列范围汇总查询次数
- `parseLoanFromDoc()` — 用 `getValueByCol(t, '管理机构数')` 等按列标签取值
- `parseCardFromDoc()` — 同上，用 `getValueByCol(t, '发卡机构数')` 等

### 当前状态

- ✅ 三模式架构已实现，DocParser 模式代码已写完
- ⚠️ 尚未经过完整测试（fullText 转换 + DocParser 模式函数刚修复，需重启验证）
- ⚠️ `summary-parser.ts` 519 行超过 400 行限制，需拆分

---

## 九、下一步计划

### 最高优先级：测试验证

重启应用，上传真实 PDF，验证以下修复是否生效：
1. `extractTextFromDocParser()` 的 `markdownTableToPlainLines()` 是否正确将 Markdown 表格转为纯文本行
2. `parseQueryFromDoc()` / `parseLoanFromDoc()` / `parseCardFromDoc()` 是否正确从两行表头表格取值
3. 各字段（header/identity/querySummary/debtSummary/accountOverdue）是否不再为空

### 测试通过后

1. **移除 debug 日志** — `ocr-service.ts` 和 `parser/index.ts` 中的 `console.log('[Debug]...')` / `console.log('[DocParser]...')`，以及 `ParseResult.debugBlockMap`
2. **拆分 summary-parser.ts** — 519 行超限，考虑将 DocParser 模式函数抽到独立文件
3. **废弃旧代码** — 删除：`section-splitter.ts`、`extract-utils.ts`、`extractors/`、`types.ts`、`cross-validator.ts`

### 后续优化

1. **q2m/q6m 精确计算** — 当前 q2m=q1m（近似），q6m=last2Year/4（估算），需从查询明细统计
2. **LLM 辅助验证（已批准方案）** — 将文档解析 API 的 Markdown 输出喂给 LLM 提取关键字段，作为交叉验证

---

## 十、编译与运行注意事项

### 编译路径

`tsconfig.main.json` 的 `rootDir: "src"` 导致编译输出为 `dist/main/main/` 和 `dist/main/shared/`（而非 `dist/main/`）。`package.json` 的 `main` 字段必须指向 `dist/main/main/index.js`。

曾因 `dist/main/` 根目录残留旧编译文件导致 Electron 加载旧版 preload 脚本，`parseDocument` 方法不存在。已清理旧文件。

### 启动命令

```bash
npm run dev          # concurrently 启动 Vite + Electron
npm run build:main   # 仅编译主进程（修改 main/ 代码后需手动执行）
```

---

## 十一、编码规范要点

- 单函数 ≤ 40 行，单文件 ≤ 400 行（纯类型定义文件例外）
- 单次改动 ≤ 150 行
- 函数参数 ≤ 5 个
- 嵌套 ≤ 3 层，圈复杂度 ≤ 10
- 公开函数必须有注释，注释说明 WHY 不是 WHAT
- 测试：表驱动优先，核心逻辑覆盖率 ≥ 80%
- Commit: `<type>: <简短描述>`（feat/fix/refactor/docs/test/chore）