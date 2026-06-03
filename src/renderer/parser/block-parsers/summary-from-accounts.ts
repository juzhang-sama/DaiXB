/**
 * 从账户明细反算汇总值 — 绕过 OCR 汇总区的识别错误
 *
 * 三模式解析（优先级从高到低）：
 * 1. DocParser 模式：从 Markdown 表格直接按行列取值（最精确）
 * 2. RebuiltTable 模式：用列位置匹配
 * 3. 行模式：回退到标签后数值搜索（兼容电子版 PDF）
 */

import { AccountBlock, Level2Block } from '../block-types';
import type { RebuiltTable } from '../table-rebuilder';
import type { ContextTable } from '../doc-table-bridge';
import { groupAccountTables } from '../doc-table-bridge';
import { getFieldMapping, type AccountCategory } from '../account-field-mappings';
import type { ParsedTable } from '../markdown-table-parser';

/** 单个账户提取的关键字段 */
interface AccountFields {
  orgName: string;
  creditAmount: number;
  balance: number;
  monthlyPayment: number;
  isClosed: boolean;
}

/** 按类别聚合的汇总结果 */
export interface AccountDerivedSummary {
  orgCount: number;
  accountCount: number;
  totalCredit: number;
  balance: number;
  monthlyPayment: number;
}

/** 从所有账户区块反算各类别汇总值 */
export function computeSummaryFromAccounts(
  allLines: string[], accounts: AccountBlock[],
  table?: RebuiltTable, docTables?: ContextTable[],
): Record<string, AccountDerivedSummary> {
  // DocParser 模式：从 Markdown 表格直接提取
  if (docTables?.length) {
    const result = computeFromDocTables(docTables);
    if (Object.keys(result).length > 0) return result;
  }

  const groups: Record<string, AccountFields[]> = {};

  for (const account of accounts) {
    const key = classifyAccount(account.parentBlock);
    if (!groups[key]) groups[key] = [];

    const lines = allLines.slice(account.range.startLine, account.range.endLine + 1);
    const fields = extractAccountFields(lines, account, table);
    groups[key].push(fields);
  }

  const result: Record<string, AccountDerivedSummary> = {};
  for (const [key, fieldsList] of Object.entries(groups)) {
    result[key] = aggregateFields(fieldsList);
  }
  return result;
}

/** DocParser 模式：从账户明细表格反算汇总 */
function computeFromDocTables(
  docTables: ContextTable[],
): Record<string, AccountDerivedSummary> {
  const result: Record<string, AccountDerivedSummary> = {};

  // 使用精确分类替代关键词匹配，避免子串交叉污染
  const groups = groupAccountTables(docTables);

  const categories: [string, keyof typeof groups][] = [
    ['nonRevolvingLoan', 'nonRevolvingLoan'],
    ['creditCard', 'creditCard'],
    ['revolvingLoan1', 'revolvingLoan1'],
    ['revolvingLoan2', 'revolvingLoan2'],
  ];

  for (const [key, groupKey] of categories) {
    const tables = groups[groupKey];
    if (tables.length === 0) continue;

    const fields = tables.map((ct) => extractFieldsFromDocTable(ct, key as AccountCategory));
    result[key] = aggregateFields(fields);
  }

  return result;
}

/** 从单个 DocParser 表格提取账户字段 */
function extractFieldsFromDocTable(ct: ContextTable, category: AccountCategory): AccountFields {
  const t = ct.table;
  const mapping = getFieldMapping(category);

  // 在整个表格中搜索标签并提取对应值
  const orgName = findLabelValue(t, mapping.org);
  const creditAmount = parseDocNum(findLabelValue(t, mapping.creditAmount));
  const balance = parseDocNum(findLabelValue(t, mapping.balance));
  let monthlyPayment = parseDocNum(findLabelValue(t, mapping.monthlyPayment));
  const statusVal = findLabelValue(t, mapping.accountStatus);

  // 判断是否结清
  const isClosed = /结清|销户/.test(statusVal);
  if (isClosed) monthlyPayment = 0;

  return { orgName, creditAmount, balance, monthlyPayment, isClosed };
}

/**
 * 在表格中查找标签并返回对应的值
 * 支持三种表格结构：
 * 1. headers 包含标签，row[0] 包含值（按列组织）
 * 2. 某行的某个单元格包含标签，下一个单元格是值（标签-值对）
 * 3. 某行第一列包含标签，后续列是值（按行组织）
 */
function findLabelValue(t: ParsedTable, label: string): string {
  if (!label) return '';

  // 方式1：在 headers 中查找标签，返回 row[0] 对应位置的值
  for (let col = 0; col < t.headers.length; col++) {
    if (t.headers[col].includes(label)) {
      return t.rows[0]?.[col]?.trim() ?? '';
    }
  }

  // 方式2：在所有行的所有单元格中查找标签
  for (let rowIdx = 0; rowIdx < t.rows.length; rowIdx++) {
    const row = t.rows[rowIdx];
    for (let colIdx = 0; colIdx < row.length; colIdx++) {
      const cell = row[colIdx] ?? '';
      if (cell.includes(label)) {
        // 找到标签后，返回下一个单元格的值（同行右侧）
        if (colIdx + 1 < row.length) {
          const nextVal = row[colIdx + 1]?.trim() ?? '';
          if (nextVal && !isLabelCell(nextVal)) {
            return nextVal;
          }
        }
        // 或者返回下一行同列的值
        if (rowIdx + 1 < t.rows.length) {
          const belowVal = t.rows[rowIdx + 1]?.[colIdx]?.trim() ?? '';
          if (belowVal && !isLabelCell(belowVal)) {
            return belowVal;
          }
        }
      }
    }
  }

  return '';
}

/** 判断单元格是否是标签（而非数值） */
function isLabelCell(val: string): boolean {
  // 如果包含中文且不是纯数字，可能是标签
  const hasChineseLabel = /[机构种类方式状态额度余额日期]/.test(val);
  const isNumeric = /^[\d,.\-]+$/.test(val.replace(/\s/g, ''));
  return hasChineseLabel && !isNumeric;
}

/** 解析文档解析返回的数值字符串 */
function parseDocNum(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.trim().replace(/,/g, '').replace(/--/g, '0');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/** 将 parentBlock 映射为汇总分类键 */
function classifyAccount(parent: Level2Block): string {
  switch (parent) {
    case Level2Block.NON_REVOLVING_LOAN: return 'nonRevolvingLoan';
    case Level2Block.REVOLVING_LOAN_TYPE1: return 'revolvingLoan1';
    case Level2Block.REVOLVING_LOAN_TYPE2: return 'revolvingLoan2';
    case Level2Block.CREDIT_CARD: return 'creditCard';
    default: return 'other';
  }
}

/** 从单个账户区块提取关键字段 */
function extractAccountFields(
  lines: string[], account: AccountBlock, table?: RebuiltTable,
): AccountFields {
  const isClosed = lines.some((l) =>
    /^[√✓]?(结清|提前结清|销户|呆账)$/.test(l.trim()),
  );

  const category = classifyAccount(account.parentBlock) as AccountCategory;
  const mapping = getFieldMapping(category);

  const orgName = findOrgName(lines, mapping.org);
  const creditAmount = findLabeledNumber(lines, mapping.creditAmount);
  const balance = findLabeledNumber(lines, mapping.balance);
  const monthlyPayment = isClosed ? 0 : findLabeledNumber(lines, mapping.monthlyPayment);

  return { orgName, creditAmount, balance, monthlyPayment, isClosed };
}

/** 聚合一组账户字段为汇总值 */
function aggregateFields(fieldsList: AccountFields[]): AccountDerivedSummary {
  const orgs = new Set<string>();
  let totalCredit = 0;
  let balance = 0;
  let monthlyPayment = 0;

  for (const f of fieldsList) {
    if (f.orgName) orgs.add(f.orgName);
    totalCredit += f.creditAmount;
    if (!f.isClosed) {
      balance += f.balance;
      monthlyPayment += f.monthlyPayment;
    }
  }

  return {
    orgCount: orgs.size,
    accountCount: fieldsList.length,
    totalCredit,
    balance,
    monthlyPayment,
  };
}

/** 找管理机构/发卡机构名称 — 取标签后的第一个中文行 */
function findOrgName(lines: string[], orgLabel: string): string {
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().startsWith(orgLabel)) continue;
    // 标签行本身可能包含"管理机构："后跟机构名
    const colonMatch = lines[i].match(/[：:]\s*(.+)/);
    if (colonMatch) return normalizeOrgName(colonMatch[1]);
    // 否则向下找第一个中文行
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      const t = lines[j].trim();
      if (/[\u4e00-\u9fa5]{2,}/.test(t) && !/^(账户|开立|到期|借款|授信|币种)/.test(t)) {
        return normalizeOrgName(t);
      }
    }
  }
  return '';
}

/** 规范化机构名：去掉常见后缀碎片 */
function normalizeOrgName(name: string): string {
  return name.replace(/股份有限$/, '股份有限公司')
    .replace(/有限$/, '有限公司')
    .trim();
}

/** 找标签后的第一个数值 */
function findLabeledNumber(lines: string[], label: string): number {
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().includes(label)) continue;
    for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
      const cleaned = lines[j].trim().replace(/,/g, '');
      if (/^[0-9]+(\.[0-9]+)?$/.test(cleaned)) {
        return parseFloat(cleaned);
      }
      // 遇到下一个标签就停
      if (/[\u4e00-\u9fa5]{3,}/.test(lines[j].trim())) break;
    }
  }
  return 0;
}

