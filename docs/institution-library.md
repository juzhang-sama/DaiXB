# 机构库建设现状

本文档基于当前源码调研整理，描述项目内“机构库”的数据结构、调用链路、匹配策略和后续建设建议。

## 一、当前定位

机构库用于修正 OCR 识别出的金融机构名称，并在解析质量页、Excel 导出、Word 报告中留下匹配/复核记录。

它目前不是独立数据库，也没有 UI 维护入口；数据以 TypeScript 静态常量维护在 `src/renderer/data/financial-institutions.ts`。

## 二、数据结构与规模

数据入口：

- `src/renderer/data/financial-institutions.ts`

核心类型：

- `FinancialInstitutionKind`：机构类别枚举。
- `FinancialInstitutionEntry`：标准机构名、类别、别名数组。
- `FINANCIAL_INSTITUTIONS`：静态机构列表。

当前规模：

- 标准机构：69 个。
- 别名：104 个。
- 标准名 + 别名合计可匹配项：173 个。

类别分布：

| 类别 | 数量 |
| --- | ---: |
| 政策性银行 | 3 |
| 国有大行 | 6 |
| 股份制银行 | 12 |
| 城商行 | 12 |
| 农商行 | 5 |
| 民营银行 | 4 |
| 消费金融 | 14 |
| 小额贷款 | 8 |
| 汽车金融 | 5 |

## 三、运行链路

主调用链：

```text
ocr-service.ts
  -> parseCreditReport(...)
  -> normalizeCreditReportInstitutions(parsedReport)
  -> buildDiagnostics(report, ..., corrections)
  -> CreditReportTabs / OcrQualityTab / Excel / Word
```

实际入口在 `src/renderer/services/ocr-service.ts`。解析完成后，系统先调用 `normalizeCreditReportInstitutions()`，再把标准化后的 report 和 corrections 放进诊断结果。

归一化覆盖字段：

- `creditDetail.nonRevolvingLoans[].org`
- `creditDetail.revolvingLoansType1[].org`
- `creditDetail.revolvingLoansType2[].org`
- `creditDetail.creditCards[].org`
- `accountBriefs[].org`
- `repayResponsibilities[].org`
- `creditAgreements[].org`
- `queryRecord.orgQueries[].queryOrg`

未覆盖字段：

- `queryRecord.selfQueries[]`，本人查询通常为“本人”，不走机构库。
- 产品库 `ProductRule.institution`，当前只是用户录入的产品机构名，不参与机构库归一化。

## 四、匹配策略

实现文件：

- `src/renderer/services/institution-normalizer.ts`

构建过程：

1. 将每个标准机构名和 aliases 展开为 `INSTITUTION_ALIASES`。
2. 每个 alias 生成一个 `normalizedAlias`，用于比较。
3. 对 OCR 原文先做 `cleanInstitutionText()`，从多行 OCR 粘连文本里优先选出像机构名的行。
4. 对原文和 alias 同时做 `normalizeComparableName()`，去除公司后缀、标点、“中国”等泛化词，并修正常见 OCR 错字。

匹配优先级：

1. **exact**：规范化后完全相等。
2. **alias**：命中别名，归一到标准机构名。
3. **contains**：一方包含另一方，分数不低于 0.72 时采用。
4. **fuzzy**：Levenshtein + Dice 系数综合相似度，最佳分不低于 0.82 且领先第二名至少 0.05 时采用。
5. **review**：有候选但置信不足，保留原文并提示人工复核。
6. **unlisted**：无候选，保留原文并标记未收录。

匹配结果字段：

- `original`：OCR 原文。
- `normalized`：标准机构名或建议机构名。
- `confidence`：置信度。
- `matched`：是否命中机构库。
- `applied`：是否已将标准名写回 report。
- `status`：`matched` / `review` / `unlisted`。
- `matchType`：`exact` / `alias` / `contains` / `fuzzy` / `none`。
- `candidates`：最多保留 5 个候选。

## 五、展示与导出

解析质量页：

- `src/renderer/components/tabs/OcrQualityTab.tsx`
- 展示“机构库匹配状态”，包含 OCR 原文、输出/建议机构名、状态、置信度、是否采用、候选。

Excel 导出：

- `src/renderer/services/excel-export.ts`
- 在 `OCR复核记录` sheet 中追加“机构库匹配记录”。

Word 导出：

- `src/renderer/services/debt-analysis-docx-export.ts`
- 在“OCR 与人工复核记录”章节中追加“机构库匹配记录”。

复核摘要：

- `src/renderer/services/ocr-review-export.ts`
- 将机构库 corrections 转成 Excel/Word 统一行结构。

## 六、测试覆盖

已有测试：

- `src/renderer/services/__tests__/institution-normalizer.test.ts`
- `src/renderer/services/__tests__/ocr-review-export.test.ts`
- `src/renderer/services/__tests__/excel-export.test.ts`
- `src/renderer/services/__tests__/debt-analysis-docx-export.test.ts`

覆盖点：

- 别名命中：如“招行”归一为“招商银行股份有限公司”。
- OCR 异体字修正：如“广發银行股份有限公司”归一为“广发银行股份有限公司”。
- 粘连文本修正：如“小额贷X4403...款有限公司”归一为“小额贷款有限公司”。
- 未收录机构保留原文并进入复核记录。
- Excel/Word 导出包含机构库匹配记录。

## 七、当前不足

1. 机构库是静态 TS 文件，扩库需要改代码并发布版本。
2. `kind` 目前只用于数据分类，归一化输出和 UI 展示没有使用机构类别。
3. 缺少机构唯一 ID、来源、启停状态、适用地区、维护时间等元数据。
4. 对分支机构、村镇银行、地方小贷公司的覆盖有限。
5. 归一化会直接采用高置信匹配，但没有给用户提供“撤销某条机构标准化”的交互。
6. 产品库中的产品机构名尚未和机构库打通，后续产品匹配无法利用标准机构维表。

## 八、建设建议

1. 给机构条目增加稳定 `id`、`source`、`updatedAt`、`enabled` 字段，避免仅用中文标准名做隐式主键。
2. 将 `kind` 输出到诊断和导出，帮助区分银行、消金、小贷、汽车金融等风险类别。
3. 增加机构库导入/导出或本地覆盖层，允许业务人员补充地方机构和新机构别名。
4. 对 `review` / `unlisted` 结果提供人工确认入口，确认后可追加到本地别名库。
5. 将产品库 `ProductRule.institution` 与机构库标准名关联，减少产品匹配中的同名/别名歧义。
6. 扩展测试集：加入分支机构、村镇银行、地方农信社、OCR 断行、多机构粘连等样本。
