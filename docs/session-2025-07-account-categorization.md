# 账户表格分类问题修复记录

> 本文档记录 2025年7月 关于账户表格按章节归类的问题分析与修复过程。

---

## 一、问题描述

**现象：** "贷款类账户信息汇总（明细反算）" 表格内容全部错误，所有账户都被归类到 `nonRevolvingLoan`。

**日志证据：**
```
[groupAccountTables] sectionPages: {nonRevolvingLoan: 4}
[groupAccountTables] grouped counts: nonRevolvingLoan=51 revolvingLoan1=0 revolvingLoan2=0 creditCard=0
```

51 张账户表全部被错误归类到 `nonRevolvingLoan`，其他三个类别为空。

---

## 二、根因分析

### 征信报告物理结构

央行二代个人征信报告是**双栏结构**：
- 物理上一页 PDF 包含两个逻辑页（左栏 + 右栏）
- 阅读顺序：同一页先左后右，跨页则第 N 页右栏末尾接第 N+1 页左栏开头
- 页脚标注 "第N页，共XX页" 是逻辑页码

**验证日志：**
```
[Footer] 物理页0 左栏 x=202: "第1页，共29页"
[Footer] 物理页0 右栏 x=604: "第2页。共29页"
[Footer] 物理页1 左栏 x=207: "第3页。共29页"
...
```

### 章节标题位置

```
(一)非循环贷账户 → 物理页1 左栏 = 逻辑第3页
(二)循环贷账户一 → 物理页2 右栏 = 逻辑第6页
(三)循环贷账户二 → 物理页3 右栏 = 逻辑第8页
(四)贷记卡账户   → 物理页6 右栏 = 逻辑第14页
```

### 原代码问题

`buildSectionPageMap()` 函数只在 `creditAccount` 桶的表格中搜索章节标题：

```typescript
// 原代码（错误）
function buildSectionPageMap(tables: ContextTable[]): Map<AccountCategory, number> {
  for (const ct of tables) {
    const text = ct.precedingText + ' ' + ct.table.headers.join(' ');
    // 问题：creditAccount 桶里的表格 precedingText 是 "账户1"、"账户2"
    // 不包含 "(一)非循环贷账户" 等章节标题
    for (const [keyword, category] of SECTION_KEYWORDS) {
      if (text.includes(keyword) && !map.has(category)) {
        map.set(category, ct.logicalPage);
      }
    }
  }
}
```

章节标题在 `layouts` 中是独立的文本元素，不是表格的 `precedingText`。

---

## 三、解决方案

### 核心思路

从 `DocParserResult` 的 `layouts` 数组中直接扫描章节标题（而不是从表格的 `precedingText` 中找）。

### 逻辑页码计算公式

```typescript
const isRightColumn = layout.position[0] > midX;  // midX = pageWidth / 2
const logicalPage = page.page_num * 2 + (isRightColumn ? 2 : 1);
```

### 归类策略

用章节标题的逻辑页码范围来归类账户：
```
循环贷账户一 → 逻辑第6页出现
循环贷账户二 → 逻辑第8页出现
贷记卡账户   → 逻辑第14页出现

账户2 在逻辑第6页 → 6 >= 6 且 6 < 8 → 属于"循环贷账户一"
账户5 在逻辑第9页 → 9 >= 8 且 9 < 14 → 属于"循环贷账户二"
```

---

## 四、代码修改

### 文件：`src/renderer/parser/doc-table-bridge.ts`

**1. `ContextTable` 接口新增 `logicalPage` 字段：**
```typescript
export interface ContextTable {
  table: ParsedTable;
  pageNum: number;        // 物理页码（PDF 页）
  logicalPage: number;    // 逻辑页码（征信报告页，考虑左右双栏）
  precedingText: string;
  markdown: string;
}
```

**2. 新增 `buildSectionPageMapFromDoc()` 函数：**
```typescript
export function buildSectionPageMapFromDoc(doc: DocParserResult): Map<AccountCategory, number> {
  const map = new Map<AccountCategory, number>();
  for (const page of doc.pages) {
    const midX = (page.meta?.page_width ?? 842) / 2;
    for (const layout of page.layouts) {
      if (layout.type === 'table') continue;  // 跳过表格，只看文本
      const text = layout.text?.trim() ?? '';
      for (const [keyword, category] of SECTION_KEYWORDS) {
        if (text.includes(keyword) && !map.has(category)) {
          const isRightColumn = layout.position[0] > midX;
          const logicalPage = page.page_num * 2 + (isRightColumn ? 2 : 1);
          map.set(category, logicalPage);
        }
      }
    }
  }
  cachedSectionPageMap = map;
  return map;
}
```

**3. 修改 `extractTablesFromDoc()` 初始化缓存：**
```typescript
export function extractTablesFromDoc(doc: DocParserResult): ContextTable[] {
  buildSectionPageMapFromDoc(doc);  // 先扫描 layouts 构建章节页码映射
  // ... 提取表格时计算 logicalPage
}
```

**4. 修改 `groupAccountTables()` 使用缓存：**
```typescript
export function groupAccountTables(tables: ContextTable[]) {
  const sectionPages = getSectionPageMap();  // 使用缓存
  for (const ct of tables) {
    const category = categorizeByLogicalPage(ct.logicalPage, sectionPages);
    if (category) groups[category].push(ct);
  }
}
```

---

## 五、预期结果

修复后日志应显示：
```
[groupAccountTables] sectionPages: {nonRevolvingLoan: 3, revolvingLoan1: 6, revolvingLoan2: 8, creditCard: 14}
[groupAccountTables] grouped counts: nonRevolvingLoan=8 revolvingLoan1=4 revolvingLoan2=12 creditCard=12
```

---

## 六、关键技术点

| 概念 | 说明 |
|------|------|
| 物理页码 | PDF 文件的页码（0-14，共15页） |
| 逻辑页码 | 征信报告的页码（1-29，共29页） |
| 页面宽度 | 842px（百度 API 返回的 `page_width`） |
| 左右栏分界 | x = 421（pageWidth / 2） |
| 章节关键词 | 非循环贷账户、循环贷账户一、循环贷账户二、贷记卡账户 |

