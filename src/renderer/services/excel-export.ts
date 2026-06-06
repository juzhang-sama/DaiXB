import { strToU8, zipSync } from 'fflate';
import type { CreditReport } from '../types/credit-report';
import { buildCreditProfile } from './credit-profile-builder';
import { assessCredit } from './credit-assessment';
import { getAssessmentConfig } from './assessment-config-store';
import { buildOcrReviewExportSummary } from './ocr-review-export';
import type { OcrDiagnosticsReport, OcrReviewState } from '../types/ocr-diagnostics';

type CellValue = string | number | boolean | null | undefined;

export interface WorkbookSheet {
  name: string;
  rows: CellValue[][];
}

/**
 * 将结构化的征信报告数据导出为 Excel 文件。
 * 这里直接生成最小 XLSX 包，避免引入存在已知漏洞的通用解析库。
 */
export function exportCreditReportToExcel(
  report: CreditReport,
  fileName: string = '征信报告数据.xlsx',
  reviewState?: OcrReviewState,
  diagnostics?: OcrDiagnosticsReport,
) {
  downloadWorkbook(buildCreditReportWorkbookSheets(report, reviewState, diagnostics), fileName);
}

export function buildCreditReportWorkbookSheets(
  report: CreditReport,
  reviewState?: OcrReviewState,
  diagnostics?: OcrDiagnosticsReport,
): WorkbookSheet[] {
  const sheets: WorkbookSheet[] = [];

  appendSheet(sheets, '基本信息', [
    ['报告编号', report.header.reportNo],
    ['报告时间', report.header.reportTime],
    ['姓名', report.header.name],
    ['证件类型', report.header.certType],
    ['证件号码', report.header.certNo],
    ['查询机构', report.header.queryOrg],
    ['查询原因', report.header.queryReason],
    ['', ''],
    ['身份信息', ''],
    ['性别', report.personalInfo.identity.gender],
    ['出生日期', report.personalInfo.identity.birthDate],
    ['婚姻状况', report.personalInfo.identity.maritalStatus],
    ['手机号码', ''],
    ['单位名称', ''],
    ['居住地址', report.personalInfo.identity.commAddress || ''],
    ['', ''],
    ['信用汇总', ''],
    ['非循环贷账户数', report.accountDerived.nonRevolvingLoan?.accountCount || 0],
    ['循环贷账户数', (report.accountDerived.revolvingLoan1?.accountCount || 0) + (report.accountDerived.revolvingLoan2?.accountCount || 0)],
    ['信用卡账户数', report.accountDerived.creditCard?.accountCount || 0],
    ['逾期账户数', report.summary.overdueSummary?.overdueAccountCount || 0],
  ]);

  if (report.creditDetail.nonRevolvingLoans.length > 0) {
    appendSheet(sheets, '非循环贷明细', [
      ['机构名称', '业务种类', '开立日期', '到期日期', '借款金额', '余额', '五级分类', '账户状态', '当前逾期金额'],
      ...report.creditDetail.nonRevolvingLoans.map(loan => [
        loan.org,
        loan.businessType,
        loan.openDate,
        loan.endDate || '',
        loan.loanAmount,
        loan.balance || 0,
        loan.fiveCategory || '',
        loan.status,
        loan.currentOverdueAmount || 0,
      ]),
    ]);
  }

  const revolvingLoans = [
    ...report.creditDetail.revolvingLoansType1,
    ...report.creditDetail.revolvingLoansType2,
  ];
  if (revolvingLoans.length > 0) {
    appendSheet(sheets, '循环贷明细', [
      ['机构名称', '业务种类', '开立日期', '到期日期', '授信/借款金额', '余额/已用', '五级分类', '账户状态', '当前逾期金额'],
      ...revolvingLoans.map(loan => {
        const amount = 'loanAmount' in loan ? loan.loanAmount : loan.creditLimit;
        return [
          loan.org,
          loan.businessType,
          loan.openDate,
          loan.endDate || '',
          amount,
          loan.balance || 0,
          loan.fiveCategory || '',
          loan.status,
          loan.currentOverdueAmount || 0,
        ];
      }),
    ]);
  }

  if (report.creditDetail.creditCards.length > 0) {
    appendSheet(sheets, '贷记卡明细', [
      ['发卡机构', '业务种类', '开立日期', '授信额度', '已用额度', '最近6个月平均使用', '最大使用额度', '账户状态', '当前逾期金额'],
      ...report.creditDetail.creditCards.map(card => [
        card.org,
        card.businessType,
        card.openDate,
        card.creditLimit,
        card.usedAmount || 0,
        card.avgUsed6m || 0,
        card.maxUsed || 0,
        card.status,
        card.currentOverdueAmount || 0,
      ]),
    ]);
  }

  const queries = [
    ...report.queryRecord.orgQueries.map(q => ({ ...q, type: '机构查询' })),
    ...report.queryRecord.selfQueries.map(q => ({ ...q, type: '本人查询' })),
  ];
  if (queries.length > 0) {
    appendSheet(sheets, '查询记录', [
      ['查询日期', '查询类型', '查询机构', '查询原因'],
      ...queries.map(q => [
        q.queryDate,
        q.type,
        q.queryOrg,
        q.queryReason,
      ]),
    ]);
  }

  if (report.repayResponsibilities.length > 0) {
    appendSheet(sheets, '相关还款责任', [
      ['管理机构', '责任人类型', '还款责任金额', '主业务借款人', '余额', '还款状态'],
      ...report.repayResponsibilities.map(r => [
        r.org,
        r.responsibilityType,
        r.responsibilityAmount,
        r.borrowerName || '',
        r.balance || 0,
        r.repayStatus || '',
      ]),
    ]);
  }

  if (report.creditAgreements.length > 0) {
    appendSheet(sheets, '授信协议', [
      ['管理机构', '授信额度用途', '授信额度', '已用额度', '币种'],
      ...report.creditAgreements.map(a => [
        a.org,
        a.creditPurpose,
        a.creditLimit,
        a.usedAmount,
        a.currency,
      ]),
    ]);
  }

  const assessment = assessCredit(buildCreditProfile(report), getAssessmentConfig());
  appendSheet(sheets, '征信评估', [
    ['维度', '整体风险', '指标', '指标值', '指标风险', '标签'],
    ...Object.values(assessment.dimensions).flatMap(dim =>
      dim.indicators.map(ind => [
        dim.label,
        dim.level,
        ind.label,
        ind.display,
        ind.level,
        dim.tags.join('、'),
      ]),
    ),
  ]);

  const provenanceRows: CellValue[][] = [
    ['字段', '来源', '标签', '物理页', '逻辑页', '前置文本', '置信度'],
    ...Object.values(report.provenance ?? {}).map(p => [
      p.field,
      p.source,
      p.label,
      p.pageNum ?? '',
      p.logicalPage ?? '',
      p.precedingText ?? '',
      p.confidence ?? '',
    ]),
  ];
  if (provenanceRows.length > 1) {
    appendSheet(sheets, '字段溯源', provenanceRows);
  }

  const reviewSummary = buildOcrReviewExportSummary(report, reviewState, diagnostics?.institutionCorrections);
  appendSheet(sheets, 'OCR复核记录', [
    ['生成时间', reviewSummary.generatedAt],
    ['最近复核时间', reviewSummary.reviewedAt || ''],
    ['需复核字段数', reviewSummary.totalReviewable],
    ['已人工复核数', reviewSummary.reviewedCount],
    ['未复核数', reviewSummary.pendingCount],
    ['', ''],
    ['级别', '类别', '字段', '复核状态', '问题', '建议'],
    ...reviewSummary.rows.map((row) => [
      row.severity,
      row.category,
      row.field,
      row.status,
      row.message,
      row.suggestion,
    ]),
    ['', ''],
    ['机构库匹配记录', ''],
    ['字段', 'OCR原文', '输出/建议机构名', '状态', '置信度', '是否采用', '候选'],
    ...reviewSummary.institutionRows.map((row) => [
      row.field,
      row.original,
      row.normalized,
      row.status,
      row.confidence,
      row.applied,
      row.candidates,
    ]),
  ]);

  return sheets;
}

function appendSheet(sheets: WorkbookSheet[], name: string, rows: CellValue[][]) {
  sheets.push({ name: makeUniqueSheetName(sheets, name), rows });
}

function downloadWorkbook(sheets: WorkbookSheet[], fileName: string) {
  const workbookSheets = sheets.length > 0 ? sheets : [{ name: '空数据', rows: [['暂无数据']] }];
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(buildContentTypesXml(workbookSheets.length)),
    '_rels/.rels': strToU8(buildRootRelsXml()),
    'xl/workbook.xml': strToU8(buildWorkbookXml(workbookSheets)),
    'xl/_rels/workbook.xml.rels': strToU8(buildWorkbookRelsXml(workbookSheets.length)),
    'xl/styles.xml': strToU8(buildStylesXml()),
  };

  workbookSheets.forEach((sheet, index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(buildWorksheetXml(sheet.rows));
  });

  const blob = new Blob([zipSync(files, { level: 6 })], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

function buildWorksheetXml(rows: CellValue[][]) {
  const sheetData = rows.map((row, rowIndex) => {
    const rowNumber = rowIndex + 1;
    const cells = row.map((value, columnIndex) => buildCellXml(value, rowNumber, columnIndex)).join('');
    return `<row r="${rowNumber}">${cells}</row>`;
  }).join('');

  return xmlDeclaration(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <sheetData>${sheetData}</sheetData>
</worksheet>`);
}

function buildCellXml(value: CellValue, rowNumber: number, columnIndex: number) {
  if (value === null || value === undefined) return '';
  const ref = `${columnName(columnIndex)}${rowNumber}`;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }
  if (typeof value === 'boolean') {
    return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
  }

  const text = String(value);
  const preserveSpace = text.trim() === text ? '' : ' xml:space="preserve"';
  return `<c r="${ref}" t="inlineStr"><is><t${preserveSpace}>${escapeXml(text)}</t></is></c>`;
}

function buildWorkbookXml(sheets: WorkbookSheet[]) {
  const sheetEntries = sheets.map((sheet, index) =>
    `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
  ).join('');

  return xmlDeclaration(`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheetEntries}</sheets>
</workbook>`);
}

function buildWorkbookRelsXml(sheetCount: number) {
  const worksheetRels = Array.from({ length: sheetCount }, (_, index) =>
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
  ).join('');

  return xmlDeclaration(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${worksheetRels}
  <Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
}

function buildRootRelsXml() {
  return xmlDeclaration(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
}

function buildContentTypesXml(sheetCount: number) {
  const worksheetTypes = Array.from({ length: sheetCount }, (_, index) =>
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join('');

  return xmlDeclaration(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${worksheetTypes}
</Types>`);
}

function buildStylesXml() {
  return xmlDeclaration(`<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`);
}

function makeUniqueSheetName(sheets: WorkbookSheet[], name: string) {
  const usedNames = new Set(sheets.map(sheet => sheet.name));
  const baseName = sanitizeSheetName(name);
  let candidate = baseName;
  let index = 1;
  while (usedNames.has(candidate)) {
    const suffix = `_${index}`;
    candidate = `${baseName.slice(0, 31 - suffix.length)}${suffix}`;
    index += 1;
  }
  return candidate;
}

function sanitizeSheetName(name: string) {
  return (name.replace(/[\[\]:*?/\\]/g, ' ').trim() || 'Sheet').slice(0, 31);
}

function columnName(columnIndex: number) {
  let name = '';
  let index = columnIndex + 1;
  while (index > 0) {
    const remainder = (index - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    index = Math.floor((index - 1) / 26);
  }
  return name;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function xmlDeclaration(body: string) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${body}`;
}
