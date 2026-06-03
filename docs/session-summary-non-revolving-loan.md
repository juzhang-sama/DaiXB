[plugin:vite:react-babel] D:\DaiXB_project\src\renderer\App.tsx: Identifier 'FilePdfOutlined' has already been declared. (9:27)
  12 |   const [pdfFile, setPdfFile] = useState<File | null>(null);
D:/DaiXB_project/src/renderer/App.tsx:9:27
7  |  import { analyzeCreditReport } from './services/ocr-service';
8  |  import { exportCreditReportToExcel } from './services/excel-export';
9  |  import { DownloadOutlined, FilePdfOutlined, FileTextOutlined } from '@ant-design/icons';
   |                             ^
10 |  
11 |  const App: React.FC = () => {
    at constructor (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:365:19)
    at TypeScriptParserMixin.raise (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:6599:19)
    at TypeScriptScopeHandler.declareName (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:4866:21)
    at TypeScriptParserMixin.declareNameFromIdentifier (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:7567:16)
    at TypeScriptParserMixin.checkIdentifier (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:7563:12)
    at TypeScriptParserMixin.checkLVal (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:7500:12)
    at TypeScriptParserMixin.finishImportSpecifier (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:14266:10)
    at TypeScriptParserMixin.parseImportSpecifier (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:14419:17)
    at TypeScriptParserMixin.parseImportSpecifier (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:10148:18)
    at TypeScriptParserMixin.parseNamedImportSpecifiers (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:14398:36)
    at TypeScriptParserMixin.parseImportSpecifiersAndAfter (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:14242:37)
    at TypeScriptParserMixin.parseImport (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:14235:17)
    at TypeScriptParserMixin.parseImport (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:9353:26)
    at TypeScriptParserMixin.parseStatementContent (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:12876:27)
    at TypeScriptParserMixin.parseStatementContent (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:9508:18)
    at TypeScriptParserMixin.parseStatementLike (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:12767:17)
    at TypeScriptParserMixin.parseModuleItem (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:12744:17)
    at TypeScriptParserMixin.parseBlockOrModuleBlockBody (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:13316:36)
    at TypeScriptParserMixin.parseBlockBody (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:13309:10)
    at TypeScriptParserMixin.parseProgram (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:12622:10)
    at TypeScriptParserMixin.parseTopLevel (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:12612:25)
    at TypeScriptParserMixin.parse (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:14488:25)
    at TypeScriptParserMixin.parse (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:10126:18)
    at parse (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:14522:38)
    at parser (D:\DaiXB_project\node_modules\@babel\core\lib\parser\index.js:41:34)
    at parser.next (<anonymous>)
    at normalizeFile (D:\DaiXB_project\node_modules\@babel\core\lib\transformation\normalize-file.js:64:37)
    at normalizeFile.next (<anonymous>)
    at run (D:\DaiXB_project\node_modules\@babel\core\lib\transformation\index.js:22:50)
    at run.next (<anonymous>)
    at transform (D:\DaiXB_project\node_modules\@babel\core\lib\transform.js:22:33)
    at transform.next (<anonymous>)
    at step (D:\DaiXB_project\node_modules\gensync\index.js:261:32)
    at D:\DaiXB_project\node_modules\gensync\index.js:273:13
    at async.call.result.err.err (D:\DaiXB_project\node_modules\gensync\index.js:223:11)
    at D:\DaiXB_project\node_modules\gensync\index.js:189:28
    at D:\DaiXB_project\node_modules\@babel\core\lib\gensync-utils\async.js:67:7
    at D:\DaiXB_project\node_modules\gensync\index.js:113:33
    at step (D:\DaiXB_project\node_modules\gensync\index.js:287:14)
    at D:\DaiXB_project\node_modules\gensync\index.js:273:13
    at async.call.result.err.err (D:\DaiXB_project\node_modules\gensync\index.js:223:11)
Click outside, press Esc key, or fix the code to dismiss.
You can also disable this overlay by setting server.hmr.overlay to false in vite.config.ts.[plugin:vite:react-babel] D:\DaiXB_project\src\renderer\App.tsx: Identifier 'FilePdfOutlined' has already been declared. (9:27)
  12 |   const [pdfFile, setPdfFile] = useState<File | null>(null);
D:/DaiXB_project/src/renderer/App.tsx:9:27
7  |  import { analyzeCreditReport } from './services/ocr-service';
8  |  import { exportCreditReportToExcel } from './services/excel-export';
9  |  import { DownloadOutlined, FilePdfOutlined, FileTextOutlined } from '@ant-design/icons';
   |                             ^
10 |  
11 |  const App: React.FC = () => {
    at constructor (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:365:19)
    at TypeScriptParserMixin.raise (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:6599:19)
    at TypeScriptScopeHandler.declareName (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:4866:21)
    at TypeScriptParserMixin.declareNameFromIdentifier (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:7567:16)
    at TypeScriptParserMixin.checkIdentifier (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:7563:12)
    at TypeScriptParserMixin.checkLVal (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:7500:12)
    at TypeScriptParserMixin.finishImportSpecifier (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:14266:10)
    at TypeScriptParserMixin.parseImportSpecifier (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:14419:17)
    at TypeScriptParserMixin.parseImportSpecifier (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:10148:18)
    at TypeScriptParserMixin.parseNamedImportSpecifiers (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:14398:36)
    at TypeScriptParserMixin.parseImportSpecifiersAndAfter (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:14242:37)
    at TypeScriptParserMixin.parseImport (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:14235:17)
    at TypeScriptParserMixin.parseImport (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:9353:26)
    at TypeScriptParserMixin.parseStatementContent (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:12876:27)
    at TypeScriptParserMixin.parseStatementContent (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:9508:18)
    at TypeScriptParserMixin.parseStatementLike (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:12767:17)
    at TypeScriptParserMixin.parseModuleItem (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:12744:17)
    at TypeScriptParserMixin.parseBlockOrModuleBlockBody (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:13316:36)
    at TypeScriptParserMixin.parseBlockBody (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:13309:10)
    at TypeScriptParserMixin.parseProgram (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:12622:10)
    at TypeScriptParserMixin.parseTopLevel (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:12612:25)
    at TypeScriptParserMixin.parse (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:14488:25)
    at TypeScriptParserMixin.parse (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:10126:18)
    at parse (D:\DaiXB_project\node_modules\@babel\parser\lib\index.js:14522:38)
    at parser (D:\DaiXB_project\node_modules\@babel\core\lib\parser\index.js:41:34)
    at parser.next (<anonymous>)
    at normalizeFile (D:\DaiXB_project\node_modules\@babel\core\lib\transformation\normalize-file.js:64:37)
    at normalizeFile.next (<anonymous>)
    at run (D:\DaiXB_project\node_modules\@babel\core\lib\transformation\index.js:22:50)
    at run.next (<anonymous>)
    at transform (D:\DaiXB_project\node_modules\@babel\core\lib\transform.js:22:33)
    at transform.next (<anonymous>)
    at step (D:\DaiXB_project\node_modules\gensync\index.js:261:32)
    at D:\DaiXB_project\node_modules\gensync\index.js:273:13
    at async.call.result.err.err (D:\DaiXB_project\node_modules\gensync\index.js:223:11)
    at D:\DaiXB_project\node_modules\gensync\index.js:189:28
    at D:\DaiXB_project\node_modules\@babel\core\lib\gensync-utils\async.js:67:7
    at D:\DaiXB_project\node_modules\gensync\index.js:113:33
    at step (D:\DaiXB_project\node_modules\gensync\index.js:287:14)
    at D:\DaiXB_project\node_modules\gensync\index.js:273:13
    at async.call.result.err.err (D:\DaiXB_project\node_modules\gensync\index.js:223:11)
Click outside, press Esc key, or fix the code to dismiss.
You can also disable this overlay by setting server.hmr.overlay to false in vite.config.ts.# 征信报告解析项目 — 对话蒸馏摘要

> 最后更新：TextIn OCR 集成完成 + doc-table-bridge 两处 bug 修复（待测试）

## 项目概述

TypeScript/React (Electron) 应用，解析央行二代个人征信报告扫描版 PDF，提取结构化数据在 UI 中展示。

OCR 引擎已从百度文档解析 API 切换至合合信息 TextIn API。

## 核心解析管线

```
扫描PDF → TextIn OCR API → DocParserResult (pages[].layouts + pages[].tables)
→ extractTablesFromDoc → ContextTable[]
→ classifyTables (分桶) → groupAccountTables (按账户类型分组) → 各类型专用parser → UI渲染
```

### 关键概念

- **物理页 vs 逻辑页**：PDF 每物理页有左右两栏，`logicalPage = pageNum * 2 + (右栏 ? 2 : 1)`
- **ContextTable**：`{ table: ParsedTable, pageNum, logicalPage, positionY, precedingText, markdown }`
- **ParsedTable**：`{ headers: string[], rows: string[][] }` — 从 pipe-delimited Markdown 解析
- **续表**：账户表格跨页时，后续页的 `precedingText` 不含"账户N"，需通过 `findSourceCategory` 溯源归类
- **标签行-值行交替结构**：headers 是第一组标签，row[0] 是值；row[1] 是第二组标签，row[2] 是值；以此类推
- **gs=1**：TextIn 的 colspan 处理已重复填充值，所以 groupSize 统一用 1

### 表格分桶流程

1. `extractTablesFromDoc()` → 所有 ContextTable[]
2. `classifyTables()` → 按模块分桶：header, identity, creditHint, debtSummary, creditAccount, creditAgreement 等
3. `groupAccountTables()` → creditAccount 桶内再按章节页码范围分组为 6 个二级模块

### groupAccountTables 两遍算法

- **第一遍**：为所有新条目表格（precedingText 匹配"账户N"）通过 `categorizeByPosition` 分配分类
- **第二遍**：续表通过 `findSourceCategory` 溯源（向前一栏找最下方的"账户N"文本），溯源失败则回退到 `lastCategory`
- **边界截止**：两遍均跳过 logicalPage >= queryRecord 起始位置的表格（避免处理报告说明页的垃圾表格）

## OCR 引擎：TextIn 集成

### 切换原因

百度文档解析 API 的 OCR 质量不足，导致章节标题识别失败（如"循环贷账户一"被识别为"循环资戶ー"），`scanLevel2CreditSections` 无法定位二级模块。TextIn 的识别质量明显更好。

### TextIn API 要点

- 端点：`https://api.textin.com/ai/service/v1/pdf_to_markdown?dpi=144`
- 认证：`x-ti-app-id` + `x-ti-secret-code` headers
- 请求体：PDF 二进制（`application/octet-stream`），需用 `new Uint8Array(fileBuffer)` 包装
- 响应结构：`result.pages[]` 包含 `structured`（blocks 数组）和 `content`（line items）
- `result.detail[]` 是扁平元素数组，不用于表格提取

### TextIn 适配层关键处理

1. **HTML → Markdown 转换**：TextIn 的 `block.text` 返回 HTML `<table>` 格式，`htmlTableToMarkdown()` 转为 pipe-delimited Markdown
2. **`<br>` 转空格**：`<br>` 必须转为空格而非 `\n`，否则 Markdown 行断裂导致字段错位
3. **colspan 重复填充**：`htmlTableToMarkdown` 对 colspan 重复单元格值，匹配百度 API 的合并单元格行为
4. **table layout 占位**：`convertPage()` 为每个 table block 同时生成 `tables[]` 条目和 `layouts[]` 中 `type='table'` 的占位元素（`doc-table-bridge` 靠 `layout_id` 关联两者）
5. **line ID 解析**：表格 cell 的文本通过 `content[]` 中的 line ID 映射获取（`buildLineMap` + `extractCellText`）

### 配置文件

`src/main/textin-config.ts` — appId, secretCode, parseUrl

## 当前修改进度（待测试）

### 刚完成的两处 bug 修复（doc-table-bridge.ts）

**修复1 — 移除 FOOTER_Y_THRESHOLD**
- 问题：循环贷账户一的账户2 被错误划分到非循环贷账户
- 根因：`findSourceCategory` 中 `FOOTER_Y_THRESHOLD = 550` 过滤掉 y > 550 的 layout 文本，但页面高度 1190，循环贷一的"账户1""账户2"文本在 y=730+，全被过滤。溯源只找到非循环贷的账户文本
- 修复：完全移除该阈值。"账户N"模式本身不会出现在页脚

**修复2 — 添加 queryRecord 边界截止**
- 问题：续表 #51-#54 溯源失败，报告说明页的表格被误归类为 creditCard
- 根因：page 13-14 是报告注释页，表格的 `precedingText` 是 OCR 乱码（"PEOPL"、"教"），不匹配账户模式，被当作续表处理，溯源失败后回退到 `lastCategory`
- 修复：新增 `isBeyondBoundary()` 函数，利用 `getLevel1Map()` 的 queryRecord 位置，跳过边界之后的表格

**测试验证点**：
- 循环贷账户一应显示 4 个账户（之前只有 3 个）
- 非循环贷账户应显示 8 个账户（之前有 9 个）
- console 不再出现 #51-#54 的溯源失败报错

## 已完成的模块

| 模块 | Parser 文件 | 数据源 |
|------|------------|--------|
| 报告头 | header-parser.ts | classified.header |
| 身份信息 | identity-parser.ts | classified.identity |
| 信贷交易信息提示 | credit-hint-parser.ts | classified.creditHint |
| 授信及负债信息概要 | summary-parser.ts | classified.debtSummary |
| 查询记录概要 | summary-parser.ts | classified.querySummary |
| 账户数量统计 | section-search.ts | docResult layouts |
| 非循环贷账户明细 | non-revolving-loan-parser.ts | accountGroups.nonRevolvingLoan |
| 循环贷账户一明细 | revolving-loan1-parser.ts | accountGroups.revolvingLoan1 |
| 循环贷账户二明细 | revolving-loan2-parser.ts | accountGroups.revolvingLoan2 |
| 贷记卡账户明细 | credit-card-parser.ts | accountGroups.creditCard |
| 相关还款责任 | repay-responsibility-parser.ts | accountGroups.repayResponsibility |
| 授信协议信息 | credit-agreement-parser.ts | classified.creditAgreement |
| 查询记录明细 | query-record-parser.ts | classified.queryDetail |

## 已解决的关键问题

| 问题 | 根因 | 修复 |
|------|------|------|
| `Buffer` not assignable to `BodyInit` | Electron 的 Buffer 类型不兼容 fetch | `new Uint8Array(fileBuffer)` |
| `detail.structured is not iterable` | TextIn 的 `detail[]` 是扁平元素 | 改读 `pages[].structured` |
| 所有页面 layouts=0 tables=0 | `convertPage` 读错数据源 | 改为接收 `TextInPageInfo` |
| 表格对下游不可见 | 缺少 `type='table'` 的 layout 占位 | `convertPage` 同时生成 layout |
| 字段错位（管理机构显示业务种类） | `<br>` 转 `\n` 导致 Markdown 行断裂 | `<br>` 转空格 |
| 循环贷账户2 被错误归类 | `FOOTER_Y_THRESHOLD=550` 过滤合法文本 | 移除阈值 |
| 续表 #51-#54 溯源失败 | 报告说明页表格被当作账户表格 | queryRecord 边界截止 |

## 待清理

全部解析问题解决后，需移除各文件中的 debug 日志：
- `textin-ocr.ts`：`[TextIn]` 前缀的 debug 日志
- `doc-table-bridge.ts`：`[groupAccountTables]` 详细日志
- `non-revolving-loan-parser.ts`：`[nrl]` 日志
- `parser/index.ts`：`[Debug]` 前缀日志

## 关键文件索引

```
src/main/
├── textin-ocr.ts              # TextIn OCR 引擎（375行）
│   ├── htmlTableToMarkdown()  # HTML table → pipe-delimited Markdown
│   ├── convertTable()         # block → DocTable
│   ├── convertPage()          # page → DocPage（含 table layout 占位）
│   ├── callTextInApi()        # HTTP 调用
│   └── parseDocument()        # 对外接口（与百度版同签名）
├── textin-config.ts           # TextIn API 凭证
├── index.ts                   # IPC handlers，ocr:parseDocument → TextIn
└── doc-parser-cache.ts        # 缓存层

src/renderer/parser/
├── index.ts                   # 解析引擎入口（187行），组装 report 对象
├── doc-table-bridge.ts        # 核心桥接层（411行）
│   ├── extractTablesFromDoc() # DocParserResult → ContextTable[]
│   ├── buildSectionPageMapFromDoc() # 扫描章节位置缓存
│   ├── categorizeByPosition() # 按逻辑页+y坐标判断账户类别
│   ├── findSourceCategory()   # 续表溯源（向前一栏找"账户N"）
│   ├── isBeyondBoundary()     # queryRecord 边界检查（新增）
│   └── groupAccountTables()   # 两遍算法分组
├── table-classifier.ts        # classifyTables 分桶
├── section-locator.ts         # 一级/二级章节标题扫描（192行）
│   ├── scanLevel1Sections()   # 一级模块定位
│   ├── scanLevel2CreditSections() # 二级模块定位
│   ├── getLevel1Map()         # 缓存访问（被 doc-table-bridge 引用）
│   └── getLevel2CreditMap()   # 缓存访问
├── section-search.ts          # 统计各章节账户数量
├── markdown-table-parser.ts   # pipe-delimited Markdown → ParsedTable
├── block-parsers/
│   ├── loan-table-utils.ts    # 共享工具（cleanStatus, cleanOrg, parseNum 等）
│   ├── non-revolving-loan-parser.ts
│   ├── revolving-loan1-parser.ts
│   ├── revolving-loan2-parser.ts
│   ├── credit-card-parser.ts
│   ├── repay-responsibility-parser.ts
│   ├── credit-agreement-parser.ts
│   ├── query-record-parser.ts
│   ├── header-parser.ts
│   ├── identity-parser.ts
│   ├── summary-from-accounts.ts
│   └── account-brief-extractor.ts
└── ...

src/shared/
└── doc-parser-types.ts        # DocParserResult, DocPage, DocTable, DocLayout 等接口

src/renderer/components/tabs/
├── CreditDetailTab.tsx        # 信贷明细 Tab（6个子模块表格）
├── QueryRecordTab.tsx         # 查询记录 Tab
├── BasicInfoTab.tsx
├── PersonalInfoTab.tsx
├── AccountDetailTab.tsx
└── OverdueTab.tsx
```

## 开发新模块的标准流程

1. 在 `parser/index.ts` 加调试日志打印目标表格的 JSON 内容
2. 用户测试后提供 console debug.txt
3. 分析表格结构（列数、标签行-值行模式）
4. 新建 `xxx-parser.ts`，从 ContextTable[] 提取类型化数据
5. 在 `parser/index.ts` 调用 parser 填充 report
6. 修改对应 UI Tab 组件渲染

