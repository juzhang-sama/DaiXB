# 保留但未接入主链路的模块

以下模块目前没有被 `App.tsx` 或核心解析链路引用，先归档说明，不直接删除，避免误删仍有参考价值的实现。

## UI 旧组件

- `src/renderer/components/CreditForm.tsx`：早期 13 字段简化表单，当前主界面改为 `CreditReportTabs`。
- `src/renderer/components/tabs/BasicInfoTab.tsx`：早期基础信息 Tab，当前使用 `PersonalInfoTab`。
- `src/renderer/components/tabs/AccountDetailTab.tsx`：早期账户简表 Tab，当前账户展示集中在 `CreditDetailTab`。
- `src/renderer/components/tabs/OverdueTab.tsx`：早期逾期/负债概览 Tab，当前由 `CreditAssessmentTab` 和账户明细承担。

## 旧 OCR/解析路径

- `src/renderer/services/pdf-to-image.ts`：PDF 转图片的旧 OCR 输入路径。
- `src/renderer/services/image-preprocess.ts`：Canvas 图像预处理路径，当前 TextIn 文档解析直接处理 PDF/图片。
- `src/renderer/services/llm-ocr-corrector.ts`：LLM OCR 纠错实验路径，当前默认只使用词典校正。
- `src/renderer/parser/section-splitter.ts`、`extract-utils.ts`、`extractors/`、`cross-validator.ts`：早期纯文本正则解析和交叉验证工具。
- `src/renderer/parser/table-rebuilder.ts`、`table-lookup.ts`：旧坐标重建表格路径，当前主力是 `DocParserResult -> ContextTable[]`。

## 清理建议

1. 先保留一个版本周期，确认真实样本解析、导出、产品匹配都不再依赖这些模块。
2. 若继续保留，需要补单元测试并明确入口。
3. 若删除，应同步清理文档中的历史描述，避免误导后续维护。
