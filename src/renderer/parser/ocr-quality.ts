import type { DocLayout, DocParserResult } from '../../shared/doc-parser-types';
import { parseMarkdownTable } from './markdown-table-parser';

type DetailedProfile = 'pboc-personal-detailed' | 'pboc-personal-fragment' | 'unknown';
type DocumentScopeType = 'complete' | 'fragment' | 'unknown';
type ModuleSource = 'anchor' | 'table' | 'mixed';

export interface OcrRecognizedModule {
  key: string;
  label: string;
  count: number;
  source: ModuleSource;
}

export interface OcrQualityReport {
  profile: DetailedProfile;
  scope: {
    type: DocumentScopeType;
    label: string;
    reason: string;
    recognizedModules: OcrRecognizedModule[];
  };
  score: number;
  pages: number;
  tables: {
    count: number;
    layoutCount: number;
    markdownRows: number;
    emptyMarkdown: number;
  };
  anchors: {
    required: number;
    found: number;
    missing: string[];
    counts: Record<string, number>;
  };
  footers: {
    found: number;
    expectedAtLeast: number;
    totalLogicalPages: number | null;
    logicalPages: number[];
    missingLogicalPages: number[];
    sequential: boolean;
  };
  accountAnchors: {
    count: number;
    byPage: Array<{ pageNum: number; count: number }>;
  };
  fieldCoverage: {
    monthlyPaymentLabels: number;
    actualPaymentLabels: number;
    dueDateLabels: number;
  };
  queryNumbering: {
    orgNumbered: number;
    selfNumbered: number;
    unknownNumbered: number;
    hasGaps: boolean;
    gaps: string[];
  };
  issues: string[];
}

const REQUIRED_ANCHORS = [
  '个人信用报告',
  '报告编号',
  '报告时间',
  '本人版',
  '一 个人基本信息',
  '二 信息概要',
  '三 信贷交易信息明细',
  '四 查询记录',
  '报告说明',
  '身份信息',
  '配偶信息',
  '居住信息',
  '职业信息',
  '信贷交易信息提示',
  '信贷交易授信及负债信息概要',
  '查询记录概要',
  '非循环贷账户',
  '循环贷账户一',
  '循环贷账户二',
  '贷记卡账户',
  '相关还款责任信息',
  '授信协议信息',
  '机构查询记录明细',
  '本人查询记录明细',
];

const ACCOUNT_ANCHOR_PATTERN = /^(账户\d*|授信协议\d+)$/;
const FOOTER_PATTERN = /第\s*(\d+)\s*页\s*[,，\/／、\\]?\s*共\s*(\d+)\s*页/;
const DATE_PATTERN = /20\d{2}[\s.:]\d{2}[\s.:]\d{2}/;

export function evaluateOcrQuality(doc: DocParserResult): OcrQualityReport {
  const joinedText = collectDocumentText(doc);
  const tables = summarizeTables(doc);
  const anchors = summarizeAnchors(joinedText);
  const recognizedModules = summarizeRecognizedModules(doc, joinedText);
  const scope = inferScope(anchors, tables, recognizedModules);
  const footers = summarizeFooters(doc);
  const accountAnchors = summarizeAccountAnchors(doc);
  const fieldCoverage = summarizeFieldCoverage(joinedText);
  const queryNumbering = summarizeQueryNumbering(doc);
  const issues = buildIssues({
    scopeType: scope.type,
    recognizedModules,
    anchors,
    footers,
    tables,
    accountAnchors,
    fieldCoverage,
    queryNumbering,
  });

  return {
    profile: inferProfile(scope.type),
    scope,
    score: scoreQuality(scope.type, issues, anchors, tables, footers, recognizedModules),
    pages: doc.pages.length,
    tables,
    anchors,
    footers,
    accountAnchors,
    fieldCoverage,
    queryNumbering,
    issues,
  };
}

function summarizeRecognizedModules(doc: DocParserResult, text: string): OcrRecognizedModule[] {
  const comparableText = normalizeComparableText(text);
  const tableText = doc.pages
    .flatMap((page) => page.tables.map((table) => table.markdown ?? ''))
    .join('\n');
  const comparableTableText = normalizeComparableText(tableText);

  const definitions: Array<{
    key: string;
    label: string;
    anchor: string[];
    table: string[];
  }> = [
    { key: 'reportHeader', label: '报告头', anchor: ['报告编号', '报告时间', '本人版'], table: ['报告编号'] },
    { key: 'identity', label: '身份信息', anchor: ['身份信息'], table: ['性别', '出生日期', '婚姻状况'] },
    { key: 'spouse', label: '配偶信息', anchor: ['配偶信息'], table: ['配偶姓名', '配偶证件号码'] },
    { key: 'residence', label: '居住信息', anchor: ['居住信息'], table: ['居住地址', '居住状况'] },
    { key: 'job', label: '职业信息', anchor: ['职业信息'], table: ['工作单位', '单位地址', '进入本单位年份'] },
    { key: 'infoSummary', label: '信息概要', anchor: ['二 信息概要', '信贷交易信息提示', '查询记录概要'], table: ['账户数', '管理机构数'] },
    { key: 'creditDetail', label: '信贷交易明细', anchor: ['三 信贷交易信息明细'], table: ['账户状态', '还款记录'] },
    { key: 'nonRevolvingLoan', label: '非循环贷账户', anchor: ['非循环贷账户'], table: ['借款金额', '剩余还款期数'] },
    { key: 'revolvingLoan1', label: '循环贷账户一', anchor: ['循环贷账户一'], table: ['循环贷账户一'] },
    { key: 'revolvingLoan2', label: '循环贷账户二', anchor: ['循环贷账户二'], table: ['账户授信额度', '管理机构'] },
    { key: 'creditCard', label: '贷记卡账户', anchor: ['贷记卡账户'], table: ['发卡机构', '卡机构', '账单日', '已用额度'] },
    { key: 'repayResponsibility', label: '相关还款责任', anchor: ['相关还款责任信息'], table: ['还款责任金额', '责任人类型', '主业务借款人'] },
    { key: 'creditAgreement', label: '授信协议', anchor: ['授信协议信息'], table: ['授信协议标识', '授信额度用途'] },
    { key: 'queryRecord', label: '查询记录', anchor: ['四 查询记录', '机构查询记录明细', '本人查询记录明细'], table: ['查询日期', '查询机构', '查询原因'] },
    { key: 'reportNote', label: '报告说明', anchor: ['报告说明'], table: ['本报告由中国人民银行征信中心出具'] },
  ];

  return definitions.flatMap((definition) => {
    const anchorCount = definition.anchor.reduce(
      (sum, anchor) => sum + countOccurrences(comparableText, normalizeComparableText(anchor)),
      0,
    );
    const tableCount = definition.table.reduce(
      (sum, keyword) => sum + countOccurrences(comparableTableText, normalizeComparableText(keyword)),
      0,
    );
    const count = anchorCount + tableCount;
    if (count === 0) return [];

    const source: ModuleSource = anchorCount > 0 && tableCount > 0 ? 'mixed'
      : anchorCount > 0 ? 'anchor'
        : 'table';

    return [{
      key: definition.key,
      label: definition.label,
      count,
      source,
    }];
  });
}

function inferScope(
  anchors: OcrQualityReport['anchors'],
  tables: OcrQualityReport['tables'],
  recognizedModules: OcrRecognizedModule[],
): OcrQualityReport['scope'] {
  const hasFullHeader = anchors.counts['个人信用报告'] > 0 &&
    anchors.counts['报告编号'] > 0 &&
    anchors.counts['本人版'] > 0;
  const hasFullFlow = anchors.counts['一 个人基本信息'] > 0 &&
    anchors.counts['二 信息概要'] > 0 &&
    anchors.counts['三 信贷交易信息明细'] > 0 &&
    anchors.counts['四 查询记录'] > 0;
  const hasReportEnd = anchors.counts['报告说明'] > 0;

  if (hasFullHeader && hasFullFlow && hasReportEnd) {
    return {
      type: 'complete',
      label: '完整本人详版',
      reason: '检测到报告头、四个主章节与报告说明',
      recognizedModules,
    };
  }

  if (recognizedModules.length > 0 || tables.count > 0) {
    return {
      type: 'fragment',
      label: '征信片段',
      reason: recognizedModules.length > 0
        ? '检测到部分征信模块，按片段模式解析'
        : '检测到结构化表格，按片段模式解析',
      recognizedModules,
    };
  }

  return {
    type: 'unknown',
    label: '未知内容',
    reason: '未检测到可解析的征信模块',
    recognizedModules,
  };
}

function collectDocumentText(doc: DocParserResult): string {
  const chunks: string[] = [];
  for (const page of doc.pages) {
    if (page.text) chunks.push(page.text);
    for (const layout of page.layouts) {
      if (layout.text) chunks.push(layout.text);
    }
    for (const table of page.tables) {
      if (table.markdown) chunks.push(table.markdown);
    }
  }
  return chunks.join('\n');
}

function summarizeTables(doc: DocParserResult): OcrQualityReport['tables'] {
  let count = 0;
  let layoutCount = 0;
  let markdownRows = 0;
  let emptyMarkdown = 0;

  for (const page of doc.pages) {
    layoutCount += page.layouts.length;
    for (const table of page.tables) {
      count++;
      if (!table.markdown.trim()) {
        emptyMarkdown++;
        continue;
      }
      const parsed = parseMarkdownTable(table.markdown);
      markdownRows += parsed.rows.length + (parsed.headers.length > 0 ? 1 : 0);
    }
  }

  return { count, layoutCount, markdownRows, emptyMarkdown };
}

function summarizeAnchors(text: string): OcrQualityReport['anchors'] {
  const comparableText = normalizeComparableText(text);
  const counts: Record<string, number> = {};
  const missing: string[] = [];

  for (const anchor of REQUIRED_ANCHORS) {
    const count = countOccurrences(comparableText, normalizeComparableText(anchor));
    counts[anchor] = count;
    if (count === 0) missing.push(anchor);
  }

  return {
    required: REQUIRED_ANCHORS.length,
    found: REQUIRED_ANCHORS.length - missing.length,
    missing,
    counts,
  };
}

function summarizeFooters(doc: DocParserResult): OcrQualityReport['footers'] {
  const logicalPages = new Set<number>();
  let maxTotal: number | null = null;

  for (const page of doc.pages) {
    for (const layout of page.layouts) {
      const match = layout.text?.match(FOOTER_PATTERN);
      if (!match) continue;
      logicalPages.add(Number(match[1]));
      maxTotal = Math.max(maxTotal ?? 0, Number(match[2]));
    }
  }

  const sorted = [...logicalPages].sort((a, b) => a - b);
  const missingLogicalPages = maxTotal
    ? range(1, maxTotal).filter((pageNo) => !logicalPages.has(pageNo))
    : [];

  return {
    found: sorted.length,
    expectedAtLeast: doc.pages.length,
    totalLogicalPages: maxTotal,
    logicalPages: sorted,
    missingLogicalPages,
    sequential: maxTotal !== null && missingLogicalPages.length === 0,
  };
}

function summarizeAccountAnchors(doc: DocParserResult): OcrQualityReport['accountAnchors'] {
  const byPage: Array<{ pageNum: number; count: number }> = [];
  let total = 0;

  for (const page of doc.pages) {
    const count = page.layouts.filter((layout) => {
      const text = normalizeAnchorText(layout.text);
      return ACCOUNT_ANCHOR_PATTERN.test(text);
    }).length;
    if (count > 0) byPage.push({ pageNum: page.page_num, count });
    total += count;
  }

  return { count: total, byPage };
}

function summarizeFieldCoverage(text: string): OcrQualityReport['fieldCoverage'] {
  return {
    monthlyPaymentLabels: countOccurrences(text, '本月应还款'),
    actualPaymentLabels: countOccurrences(text, '本月实还款'),
    dueDateLabels: countOccurrences(text, '应还款日') + countOccurrences(text, '账单日'),
  };
}

function summarizeQueryNumbering(doc: DocParserResult): OcrQualityReport['queryNumbering'] {
  const orgNumbers: number[] = [];
  const selfNumbers: number[] = [];
  const unknownNumbers: number[] = [];
  let lastQueryTarget: number[] | null = null;

  for (const page of doc.pages) {
    for (let i = 0; i < page.layouts.length; i++) {
      const layout = page.layouts[i];
      if (layout.type !== 'table') continue;
      const table = page.tables.find((item) => item.layout_id === layout.layout_id);
      if (!table?.markdown) continue;

      const parsed = parseMarkdownTable(table.markdown);
      const rows = [parsed.headers, ...parsed.rows].filter((row) => row.length > 0);
      if (!isQueryLike(rows)) continue;

      const preceding = findPrecedingText(page.layouts, i);
      let target: number[];
      if (preceding.includes('本人')) {
        target = selfNumbers;
      } else if (preceding.includes('机构')) {
        target = orgNumbers;
      } else {
        target = lastQueryTarget ?? unknownNumbers;
      }
      lastQueryTarget = target;

      for (const row of rows) {
        const no = parseQueryNo(row);
        if (no !== null) target.push(no);
      }
    }
  }

  const gaps = [
    ...describeNumberGaps('机构查询', orgNumbers),
    ...describeNumberGaps('本人查询', selfNumbers),
    ...describeNumberGaps('未分类查询', unknownNumbers),
  ];

  return {
    orgNumbered: uniqueCount(orgNumbers),
    selfNumbered: uniqueCount(selfNumbers),
    unknownNumbered: uniqueCount(unknownNumbers),
    hasGaps: gaps.length > 0,
    gaps,
  };
}

function buildIssues(input: {
  scopeType: DocumentScopeType;
  recognizedModules: OcrRecognizedModule[];
  anchors: OcrQualityReport['anchors'];
  footers: OcrQualityReport['footers'];
  tables: OcrQualityReport['tables'];
  accountAnchors: OcrQualityReport['accountAnchors'];
  fieldCoverage: OcrQualityReport['fieldCoverage'];
  queryNumbering: OcrQualityReport['queryNumbering'];
}): string[] {
  const issues: string[] = [];
  const hasAccountModule = input.recognizedModules.some((item) =>
    ['creditDetail', 'nonRevolvingLoan', 'revolvingLoan1', 'revolvingLoan2', 'creditCard'].includes(item.key),
  );

  if (input.scopeType === 'complete' && input.anchors.missing.length > 0) {
    issues.push(`缺少本人详版关键锚点：${input.anchors.missing.join('、')}`);
  }
  if (input.tables.count === 0) {
    issues.push('未识别到 Markdown 表格，结构化解析不可用');
  }
  if (input.scopeType === 'unknown') {
    issues.push('未识别到央行个人征信模块，请确认上传内容');
  }
  if (input.tables.emptyMarkdown > 0) {
    issues.push(`存在 ${input.tables.emptyMarkdown} 张空 Markdown 表格`);
  }
  if (input.scopeType === 'complete' && input.footers.found < input.footers.expectedAtLeast) {
    issues.push(`页脚识别不足：识别 ${input.footers.found} 个，物理页 ${input.footers.expectedAtLeast} 页`);
  }
  if (input.scopeType === 'complete' && input.footers.missingLogicalPages.length > 0) {
    issues.push(`页脚逻辑页缺失：${input.footers.missingLogicalPages.join('、')}`);
  }
  if (input.scopeType === 'complete' && input.accountAnchors.count === 0) {
    issues.push('未识别到账户锚点，信贷明细分组可能失败');
  }
  if (hasAccountModule && input.fieldCoverage.monthlyPaymentLabels === 0) {
    issues.push('未识别到“本月应还款”字段，贷款月供合计不可置信');
  }
  if (input.queryNumbering.hasGaps) {
    issues.push(`查询记录编号不连续：${input.queryNumbering.gaps.join('；')}`);
  }

  return issues;
}

function inferProfile(scopeType: DocumentScopeType): DetailedProfile {
  if (scopeType === 'complete') return 'pboc-personal-detailed';
  if (scopeType === 'fragment') return 'pboc-personal-fragment';
  return 'unknown';
}

function scoreQuality(
  scopeType: DocumentScopeType,
  issues: string[],
  anchors: OcrQualityReport['anchors'],
  tables: OcrQualityReport['tables'],
  footers: OcrQualityReport['footers'],
  recognizedModules: OcrRecognizedModule[],
): number {
  if (scopeType === 'fragment') {
    let score = 0.82;
    if (tables.count > 0) score += 0.06;
    if (recognizedModules.length > 0) score += 0.08;
    score -= Math.min(0.12, tables.emptyMarkdown * 0.03);
    if (issues.some((issue) => issue.includes('月供'))) score -= 0.05;
    if (issues.some((issue) => issue.includes('查询记录编号'))) score -= 0.05;
    return Math.max(0, Math.min(0.95, Math.round(score * 100) / 100));
  }

  if (scopeType === 'unknown') {
    let score = tables.count > 0 ? 0.45 : 0.2;
    score -= Math.min(0.15, tables.emptyMarkdown * 0.03);
    return Math.max(0, Math.round(score * 100) / 100);
  }

  let score = 1;
  score -= Math.min(0.35, anchors.missing.length * 0.025);
  if (tables.count === 0) score -= 0.25;
  score -= Math.min(0.15, tables.emptyMarkdown * 0.02);
  if (footers.found < footers.expectedAtLeast) score -= 0.1;
  if (footers.missingLogicalPages.length > 0) score -= 0.08;
  if (issues.some((issue) => issue.includes('月供'))) score -= 0.05;
  if (issues.some((issue) => issue.includes('查询记录编号'))) score -= 0.05;
  return Math.max(0, Math.round(score * 100) / 100);
}

function findPrecedingText(layouts: DocLayout[], idx: number): string {
  for (let i = idx - 1; i >= 0; i--) {
    if (layouts[i].type !== 'table' && layouts[i].text) {
      return layouts[i].text.trim();
    }
  }
  return '';
}

function isQueryLike(rows: string[][]): boolean {
  const flat = rows.flat().join(' ');
  return flat.includes('查询日期') || flat.includes('查询机构') || DATE_PATTERN.test(flat);
}

function parseQueryNo(row: string[]): number | null {
  if (row.length < 2) return null;
  const raw = row[0]?.trim();
  if (!/^\d{1,4}$/.test(raw)) return null;
  if (!row.some((cell) => DATE_PATTERN.test(cell))) return null;
  return Number(raw);
}

function describeNumberGaps(label: string, numbers: number[]): string[] {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  if (sorted.length === 0) return [];

  const gaps: string[] = [];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) continue;
    gaps.push(`${label} ${sorted[i - 1]}-${sorted[i]}`);
  }
  return gaps;
}

function countOccurrences(text: string, needle: string): number {
  const matches = text.match(new RegExp(escapeRegExp(needle), 'g'));
  return matches?.length ?? 0;
}

function normalizeAnchorText(text: string | undefined): string {
  return (text ?? '').replace(/\s+/g, '').trim();
}

function range(start: number, end: number): number[] {
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i);
}

function uniqueCount(values: number[]): number {
  return new Set(values).size;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeComparableText(text: string): string {
  return text
    .replace(/[\s\u3000]/g, '')
    .replace(/[（）()、，,.:：;；]/g, '');
}
