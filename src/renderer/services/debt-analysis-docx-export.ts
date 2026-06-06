import { strToU8, zipSync } from 'fflate';
import type { CreditReport } from '../types/credit-report';
import {
  buildDebtAnalysisReport,
  type DebtAnalysisReport,
  type PaymentReductionPlan,
} from './debt-analysis-report';
import type { LlmDebtAnalysis, LlmPlanComment, LlmPriorityAction } from './debt-analysis-llm-service';
import {
  buildOcrReviewExportSummary,
  type OcrReviewExportSummary,
} from './ocr-review-export';
import type { OcrDiagnosticsReport, OcrReviewState } from '../types/ocr-diagnostics';

type DocxFiles = Record<string, Uint8Array>;
type TableCellValue = string | number;

export function exportDebtAnalysisReportToDocx(
  report: CreditReport,
  fileName: string = buildDefaultFileName(report),
  aiAnalysis?: LlmDebtAnalysis,
  reviewState?: OcrReviewState,
  diagnostics?: OcrDiagnosticsReport,
): void {
  const files = buildDebtAnalysisDocxFiles(report, aiAnalysis, reviewState, diagnostics);
  const blob = new Blob([zipSync(files, { level: 6 })], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.docx') ? fileName : `${fileName}.docx`;
  link.click();
  URL.revokeObjectURL(url);
}

export function buildDebtAnalysisDocxFiles(
  report: CreditReport,
  aiAnalysis?: LlmDebtAnalysis,
  reviewState?: OcrReviewState,
  diagnostics?: OcrDiagnosticsReport,
): DocxFiles {
  const analysis = buildDebtAnalysisReport(report);
  const reviewSummary = buildOcrReviewExportSummary(report, reviewState, diagnostics?.institutionCorrections);
  return {
    '[Content_Types].xml': strToU8(buildContentTypesXml()),
    '_rels/.rels': strToU8(buildRootRelsXml()),
    'docProps/core.xml': strToU8(buildCorePropsXml(analysis)),
    'docProps/app.xml': strToU8(buildAppPropsXml()),
    'word/document.xml': strToU8(buildDebtAnalysisDocumentXml(analysis, aiAnalysis, reviewSummary)),
    'word/styles.xml': strToU8(buildStylesXml()),
    'word/_rels/document.xml.rels': strToU8(buildDocumentRelsXml()),
  };
}

export function buildDebtAnalysisDocumentXml(
  analysis: DebtAnalysisReport,
  aiAnalysis?: LlmDebtAnalysis,
  reviewSummary?: OcrReviewExportSummary,
): string {
  const hasAiAnalysis = Boolean(aiAnalysis);
  const body = [
    paragraph('客户降低月供分析简版报告', { style: 'Title', align: 'center' }),
    paragraph(`客户姓名：${analysis.customerName || '-'}    报告时间：${analysis.reportTime || '-'}    生成时间：${formatDateTime(analysis.generatedAt)}`, { style: 'Small' }),
    paragraph('本报告基于个人征信 OCR 结构化数据自动生成，用于现金流压力分析和合规沟通参考；不构成贷款产品推荐、授信承诺、债务减免承诺或法律意见。', { style: 'Note' }),

    heading('一、客户债务情况'),
    paragraph(analysis.summary.join('')),
    table([
      ['债务类别', '账户数', '余额', '余额占比', '本月应还', '月供占比', '月供密度'],
      ...analysis.debtBreakdown.map((item) => [
        item.label,
        item.count,
        formatYuan(item.balance),
        formatRatio(item.balanceShare),
        formatYuan(item.monthlyPayment),
        formatRatio(item.paymentShare),
        formatRatio(item.paymentRate),
      ]),
      ['合计', analysis.debtCount, formatYuan(analysis.debtTotal), '100%', formatYuan(analysis.originalMonthlyPayment), '100%', formatRatio(analysis.metrics.monthlyPaymentRate)],
    ]),

    heading('二、结构洞察'),
    ...analysis.insights.flatMap((insight) => [
      paragraph(`${insight.title}（${insight.level}）`, { style: 'Heading2' }),
      paragraph(insight.description),
      ...insight.evidence.map((item) => bullet(`依据：${item}`)),
      bullet(`建议：${insight.suggestion}`),
    ]),

    ...(aiAnalysis ? buildAiAnalysisBody(aiAnalysis) : []),

    heading(hasAiAnalysis ? '四、可分期信用卡清单' : '三、可分期信用卡清单'),
    analysis.installmentCards.length > 0
      ? table([
        ['发卡机构', '授信额度', '已用额度', '可用额度', '使用率', '本月应还', '状态', '核查提示'],
        ...analysis.installmentCards.map((card) => [
          card.org,
          formatYuan(card.creditLimit),
          formatYuan(card.usedAmount),
          formatYuan(card.availableLimit),
          formatRatio(card.usageRate),
          formatYuan(card.monthlyPayment),
          card.status || '-',
          card.reason,
        ]),
      ])
      : paragraph('未识别到有已用额度的信用卡账户；如客户另有账单或专项分期信息，应结合发卡机构账单人工复核。'),

    heading(hasAiAnalysis ? '五、降低月供方案对比' : '四、降低月供方案对比'),
    table([
      ['方案', '原月供', '预计月供', '释放现金流', '征信影响', '测算明细', '方案说明', '主要风险'],
      ...analysis.plans.map((plan) => [
        plan.name,
        formatYuan(plan.originalMonthlyPayment),
        formatYuan(plan.targetMonthlyPayment),
        formatYuan(plan.releasedCashFlow),
        plan.impactLevel,
        plan.calculations.map((item) => `${item.label} ${formatYuan(item.amount)}`).join('；'),
        plan.basis,
        plan.risks.join('；'),
      ]),
    ]),

    heading(hasAiAnalysis ? '六、方案说明与风险提示' : '五、方案说明与风险提示'),
    ...analysis.summary.map((line) => bullet(line)),
    ...analysis.riskNotes.map((line) => bullet(line)),
    ...analysis.plans.map((plan) => planNote(plan)),

    ...(reviewSummary ? buildOcrReviewBody(reviewSummary, hasAiAnalysis ? '七' : '六') : []),

    paragraph('报告生成完毕。', { style: 'Small', align: 'right' }),
    sectionProperties(),
  ].join('');

  return xmlDeclaration(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${body}</w:body>
</w:document>`);
}

function buildAiAnalysisBody(aiAnalysis: LlmDebtAnalysis): string[] {
  return [
    heading('三、AI 专业分析'),
    paragraph(aiAnalysis.executiveSummary || 'AI 未返回综合判断。'),
    paragraph('主要压力来源', { style: 'Heading2' }),
    ...nonEmptyList(aiAnalysis.primaryPressureSources).map((item) => bullet(item)),
    paragraph('优先处理动作', { style: 'Heading2' }),
    ...nonEmptyList(aiAnalysis.priorityActions).flatMap(renderPriorityAction),
    paragraph('方案适用性点评', { style: 'Heading2' }),
    ...nonEmptyList(aiAnalysis.planComments).flatMap(renderPlanComment),
    paragraph('执行步骤', { style: 'Heading2' }),
    ...nonEmptyList(aiAnalysis.executionSteps).map((item) => bullet(item)),
    paragraph('补充核验资料', { style: 'Heading2' }),
    ...nonEmptyList(aiAnalysis.requiredMaterials).map((item) => bullet(item)),
    paragraph('AI 风险提示', { style: 'Heading2' }),
    ...nonEmptyList(aiAnalysis.riskWarnings).map((item) => bullet(item)),
  ];
}

function buildOcrReviewBody(summary: OcrReviewExportSummary, sectionNo: string): string[] {
  const body = [
    heading(`${sectionNo}、OCR 与人工复核记录`),
    paragraph(
      `需复核字段 ${summary.totalReviewable} 项，已人工复核 ${summary.reviewedCount} 项，未复核 ${summary.pendingCount} 项。${
        summary.reviewedAt ? `最近复核时间：${formatDateTime(summary.reviewedAt)}。` : ''
      }`,
      { style: 'Note' },
    ),
  ];

  if (summary.rows.length === 0) {
    body.push(paragraph('本次结构化数据未发现需进入人工复核清单的 OCR 字段问题。'));
  } else {
    body.push(table([
      ['级别', '类别', '字段', '复核状态', '问题', '建议'],
      ...summary.rows.map((row) => [
        row.severity,
        row.category,
        row.field,
        row.status,
        row.message,
        row.suggestion,
      ]),
    ]));
  }

  if (summary.institutionRows.length > 0) {
    body.push(paragraph('机构库匹配记录', { style: 'Heading2' }));
    body.push(table([
      ['字段', 'OCR原文', '输出/建议机构名', '状态', '置信度', '是否采用', '候选'],
      ...summary.institutionRows.map((row) => [
        row.field,
        row.original,
        row.normalized,
        row.status,
        row.confidence,
        row.applied,
        row.candidates,
      ]),
    ]));
  }
  return body;
}

function renderPriorityAction(action: LlmPriorityAction): string[] {
  return [
    paragraph(`${action.priority}. ${action.title}`, { style: 'Small' }),
    bullet(`原因：${action.reason}`),
    bullet(`动作：${action.action}`),
    ...action.evidence.map((item) => bullet(`依据：${item}`)),
  ];
}

function renderPlanComment(comment: LlmPlanComment): string[] {
  return [
    paragraph(comment.planName || comment.planKey, { style: 'Small' }),
    bullet(`适用性：${comment.suitability}`),
    ...comment.prerequisites.map((item) => bullet(`前提：${item}`)),
    ...comment.cautions.map((item) => bullet(`注意：${item}`)),
  ];
}

function nonEmptyList<T>(items: T[] | undefined): T[] {
  return Array.isArray(items) && items.length > 0 ? items : [];
}

function planNote(plan: PaymentReductionPlan): string {
  return bullet(`${plan.name}：${plan.complianceNote}`);
}

function buildDefaultFileName(report: CreditReport): string {
  const name = sanitizeFileName(report.header.name || '客户');
  const reportTime = sanitizeFileName(report.header.reportTime || new Date().toISOString().slice(0, 10));
  return `${name}_降低月供分析报告_${reportTime}.docx`;
}

function heading(text: string): string {
  return paragraph(text, { style: 'Heading1' });
}

function bullet(text: string): string {
  return `<w:p>
  <w:pPr><w:pStyle w:val="ListParagraph"/><w:ind w:left="420" w:hanging="180"/></w:pPr>
  <w:r><w:t>${escapeXml(`• ${text}`)}</w:t></w:r>
</w:p>`;
}

function paragraph(
  text: string,
  options: { style?: 'Title' | 'Heading1' | 'Heading2' | 'Note' | 'Small'; align?: 'center' | 'right' } = {},
): string {
  const style = options.style ? `<w:pStyle w:val="${options.style}"/>` : '';
  const align = options.align ? `<w:jc w:val="${options.align}"/>` : '';
  const pPr = style || align ? `<w:pPr>${style}${align}</w:pPr>` : '';
  return `<w:p>${pPr}<w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
}

function table(rows: TableCellValue[][]): string {
  const grid = rows[0]?.map(() => '<w:gridCol w:w="1800"/>').join('') ?? '';
  const body = rows.map((row, rowIndex) => {
    const cells = row.map((value) => tableCell(String(value), rowIndex === 0)).join('');
    return `<w:tr>${cells}</w:tr>`;
  }).join('');

  return `<w:tbl>
  <w:tblPr>
    <w:tblStyle w:val="TableGrid"/>
    <w:tblW w:w="0" w:type="auto"/>
    <w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/>
  </w:tblPr>
  <w:tblGrid>${grid}</w:tblGrid>
  ${body}
</w:tbl>`;
}

function tableCell(text: string, isHeader: boolean): string {
  const shading = isHeader ? '<w:shd w:fill="EAF2F8"/>' : '';
  const bold = isHeader ? '<w:b/>' : '';
  return `<w:tc>
  <w:tcPr><w:tcW w:w="1800" w:type="dxa"/>${shading}</w:tcPr>
  <w:p><w:r><w:rPr>${bold}</w:rPr><w:t>${escapeXml(text)}</w:t></w:r></w:p>
</w:tc>`;
}

function sectionProperties(): string {
  return `<w:sectPr>
  <w:pgSz w:w="11906" w:h="16838"/>
  <w:pgMar w:top="1440" w:right="1080" w:bottom="1440" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/>
</w:sectPr>`;
}

function buildContentTypesXml(): string {
  return xmlDeclaration(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`);
}

function buildRootRelsXml(): string {
  return xmlDeclaration(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);
}

function buildDocumentRelsXml(): string {
  return xmlDeclaration(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`);
}

function buildCorePropsXml(analysis: DebtAnalysisReport): string {
  const now = analysis.generatedAt;
  return xmlDeclaration(`<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>客户降低月供分析简版报告</dc:title>
  <dc:creator>征信贷小帮</dc:creator>
  <cp:lastModifiedBy>征信贷小帮</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${escapeXml(now)}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${escapeXml(now)}</dcterms:modified>
</cp:coreProperties>`);
}

function buildAppPropsXml(): string {
  return xmlDeclaration(`<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>征信贷小帮</Application>
</Properties>`);
}

function buildStylesXml(): string {
  return xmlDeclaration(`<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="SimSun" w:hAnsi="Arial"/><w:sz w:val="21"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:pPr><w:spacing w:after="240"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Microsoft YaHei" w:hAnsi="Arial"/><w:b/><w:sz w:val="34"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:pPr><w:spacing w:before="260" w:after="140"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Microsoft YaHei" w:hAnsi="Arial"/><w:b/><w:sz w:val="26"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:pPr><w:spacing w:before="180" w:after="100"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Microsoft YaHei" w:hAnsi="Arial"/><w:b/><w:sz w:val="22"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Note">
    <w:name w:val="Note"/>
    <w:pPr><w:spacing w:after="160"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="SimSun" w:hAnsi="Arial"/><w:color w:val="666666"/><w:sz w:val="20"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Small">
    <w:name w:val="Small"/>
    <w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="SimSun" w:hAnsi="Arial"/><w:color w:val="666666"/><w:sz w:val="18"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph">
    <w:name w:val="List Paragraph"/>
    <w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="SimSun" w:hAnsi="Arial"/><w:sz w:val="21"/></w:rPr>
  </w:style>
  <w:style w:type="table" w:styleId="TableGrid">
    <w:name w:val="Table Grid"/>
    <w:tblPr><w:tblBorders>
      <w:top w:val="single" w:sz="4" w:color="BFBFBF"/>
      <w:left w:val="single" w:sz="4" w:color="BFBFBF"/>
      <w:bottom w:val="single" w:sz="4" w:color="BFBFBF"/>
      <w:right w:val="single" w:sz="4" w:color="BFBFBF"/>
      <w:insideH w:val="single" w:sz="4" w:color="BFBFBF"/>
      <w:insideV w:val="single" w:sz="4" w:color="BFBFBF"/>
    </w:tblBorders></w:tblPr>
  </w:style>
</w:styles>`);
}

function formatYuan(value: number): string {
  return `${Math.round(value).toLocaleString('zh-CN')} 元`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function formatRatio(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '-';
  return `${Math.round(value * 1000) / 10}%`;
}

function sanitizeFileName(value: string): string {
  return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim() || '客户';
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function xmlDeclaration(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${body}`;
}
