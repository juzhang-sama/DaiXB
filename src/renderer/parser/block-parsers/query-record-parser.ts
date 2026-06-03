/**
 * 查询记录解析器
 *
 * 数据来源：queryDetail 桶 + unclassified 桶，合并后统一按行内容分类
 * 分类规则：查询机构为"本人" → selfQueries，否则 → orgQueries
 *
 * 表格形态：
 * - 标签表：headers 含"查询日期"等标签，rows 是数据
 * - 续表/数据表：headers 本身也是数据行，无标签
 */

import type { OrgQueryRecord, SelfQueryRecord } from '../../types/credit-report';
import type { ContextTable } from '../doc-table-bridge';

const DATE_PATTERN = /20\d{2}[.:]\d{2}[.:]\d{2}/;
/** 清洗查询原因：去除尾部标点、不可见字符、OCR 杂质 */
const KNOWN_REASONS = ['贷后管理', '贷款审批', '信用卡审批', '担保资格审查', '资信审查', '本人查询', '公积金提取审查'];

/** OCR 常见形近字替换表 */
const OCR_CHAR_FIX: Record<string, string> = {
  '货': '贷',  // 货后管理 → 贷后管理
  '货': '贷',  // 全角
};

function cleanReason(raw: string): string {
  // 1. 清除不可见字符
  let s = raw.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\u00A0\u3000]/g, '')
    .replace(/\s+/g, ' ').trim()
    .replace(/[、，,.:;；。\s]+$/, '').trim();
  // 2. 形近字修正
  for (const [wrong, right] of Object.entries(OCR_CHAR_FIX)) {
    s = s.replace(new RegExp(wrong, 'g'), right);
  }
  // 3. 模糊匹配已知原因
  for (const r of KNOWN_REASONS) {
    if (s.includes(r)) return r;
  }
  return s;
}

/** 清洗日期中 OCR 误识别的冒号 */
function cleanDate(raw: string): string {
  const m = raw.match(/20\d{2}[.:]\d{2}[.:]\d{2}/);
  if (!m) return raw.trim();
  return m[0].replace(/:/g, '.');
}

/** 通用查询记录提取：从一行 cells 中提取日期、机构、原因 */
function extractQueryRow(cells: string[]): { queryDate: string; queryOrg: string; queryReason: string } | null {
  if (cells.length < 3) return null;
  let dateIdx = -1;
  for (let i = 0; i < cells.length; i++) {
    if (DATE_PATTERN.test(cells[i])) { dateIdx = i; break; }
  }
  if (dateIdx < 0) return null;

  const queryOrg = cells[dateIdx + 1]?.trim() ?? '';
  const queryReason = cleanReason(cells[dateIdx + 2] ?? '');
  return { queryDate: cleanDate(cells[dateIdx]), queryOrg, queryReason };
}

/** 判断查询机构是否为"本人" */
function isSelfQuery(org: string): boolean {
  return org === '本人' || org.includes('本人');
}

/** 判断表格是否为查询记录表（含日期格式的行） */
function isQueryTable(ct: ContextTable): boolean {
  const { headers, rows } = ct.table;
  if (headers.length < 3) return false;
  const hasDateInHeaders = headers.some(c => DATE_PATTERN.test(c));
  const hasDateInRow0 = rows.length > 0 && rows[0].some(c => DATE_PATTERN.test(c));
  const isLabelHeader = headers.some(h => h.includes('查询日期'));
  return hasDateInHeaders || hasDateInRow0 || isLabelHeader;
}

/** 从所有行中提取查询记录，按内容分类到 org/self */
function extractAllRows(
  ct: ContextTable,
  orgQueries: OrgQueryRecord[],
  selfQueries: SelfQueryRecord[],
): void {
  const { headers, rows } = ct.table;
  const isLabelHeader = headers.some(h => h.includes('查询日期'));

  const allRows = isLabelHeader ? rows : [headers, ...rows];
  for (const row of allRows) {
    const rec = extractQueryRow(row);
    if (!rec) continue;
    if (isSelfQuery(rec.queryOrg)) {
      selfQueries.push(rec);
    } else {
      orgQueries.push(rec);
    }
  }
}

/** 从 queryDetail 桶 + unclassified 桶解析所有查询记录 */
export function parseQueryRecords(
  queryDetailTables: ContextTable[],
  unclassifiedTables: ContextTable[],
): { orgQueries: OrgQueryRecord[]; selfQueries: SelfQueryRecord[] } {
  const orgQueries: OrgQueryRecord[] = [];
  const selfQueries: SelfQueryRecord[] = [];

  // 合并两个桶，统一按行内容分类
  for (const ct of queryDetailTables) {
    extractAllRows(ct, orgQueries, selfQueries);
  }
  for (const ct of unclassifiedTables) {
    if (!isQueryTable(ct)) continue;
    extractAllRows(ct, orgQueries, selfQueries);
  }

  orgQueries.sort((a, b) => b.queryDate.localeCompare(a.queryDate));
  selfQueries.sort((a, b) => b.queryDate.localeCompare(a.queryDate));

  return { orgQueries, selfQueries };
}

