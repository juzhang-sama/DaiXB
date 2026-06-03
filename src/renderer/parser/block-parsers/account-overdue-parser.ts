/**
 * 账户级逾期/还款解析器 — 从账户区块提取逾期和月供信息
 *
 * 三模式解析（优先级从高到低）：
 * 1. DocParser 模式：从 Markdown 表格直接按行列取值（最精确）
 * 2. RebuiltTable 模式：用列位置匹配"本月应还款"标签和值
 * 3. 行模式：回退到索引计数（兼容电子版 PDF）
 * - OCR 常将"逾期"误识别为"途期"
 * - 已结清/销户账户不计入月供
 */

import { AccountBlock } from '../block-types';
import type { RebuiltTable } from '../table-rebuilder';
import { findRowByLabel, matchLabelValues } from '../table-lookup';
import type { ContextTable } from '../doc-table-bridge';
import { findAllTablesByKeyword } from '../doc-table-bridge';
import { getRowValues } from '../markdown-table-parser';

/** 账户级逾期摘要 */
export interface AccountOverdueSummary {
  hasCurrentOverdue: boolean;
  maxOverduePeriods: number;
  totalMonthlyRepayment: number;
}

/** 从所有账户区块汇总逾期和月供信息 */
export function aggregateAccountOverdue(
  allLines: string[], accounts: AccountBlock[],
  table?: RebuiltTable, docTables?: ContextTable[],
): AccountOverdueSummary {
  let hasCurrentOverdue = false;
  let maxOverduePeriods = 0;
  let totalMonthlyRepayment = 0;

  // DocParser 模式：从账户明细表格直接提取
  if (docTables?.length) {
    const docResult = aggregateFromDocTables(docTables);
    if (docResult) return docResult;
  }

  for (const account of accounts) {
    const lines = allLines.slice(account.range.startLine, account.range.endLine + 1);

    const overdue = parseCurrentOverdue(lines);
    if (overdue > 0) hasCurrentOverdue = true;

    const maxHistory = parseMaxOverdueFromRepayment(lines);
    if (maxHistory > maxOverduePeriods) maxOverduePeriods = maxHistory;

    if (!isClosedAccount(lines)) {
      totalMonthlyRepayment += parseMonthlyPayment(lines, account, table);
    }
  }

  return { hasCurrentOverdue, maxOverduePeriods, totalMonthlyRepayment };
}

/** DocParser 模式：从所有账户表格汇总逾期和月供 */
function aggregateFromDocTables(docTables: ContextTable[]): AccountOverdueSummary | null {
  const accountTables = findAllTablesByKeyword(docTables, '本月应还款');
  if (accountTables.length === 0) return null;

  let hasCurrentOverdue = false;
  let maxOverduePeriods = 0;
  let totalMonthlyRepayment = 0;

  for (const ct of accountTables) {
    const t = ct.table;
    const overdueVals = getRowValues(t, '当前逾期期数');
    const overdueNum = parseDocNum(overdueVals[0]);
    if (overdueNum > 0) hasCurrentOverdue = true;

    // 还款记录中的逾期数字（1-7）
    const repayVals = getRowValues(t, '还款记录');
    for (const v of repayVals) {
      const n = parseInt(v, 10);
      if (n >= 1 && n <= 7 && n > maxOverduePeriods) maxOverduePeriods = n;
    }

    // 跳过已结清账户
    const statusVals = getRowValues(t, '账户状态');
    const isClosed = statusVals.some((s) => /结清|销户/.test(s));
    if (!isClosed) {
      const payVals = getRowValues(t, '本月应还款');
      totalMonthlyRepayment += parseDocNum(payVals[0]);
    }
  }

  return { hasCurrentOverdue, maxOverduePeriods, totalMonthlyRepayment };
}

/** 解析文档解析返回的数值字符串 */
function parseDocNum(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.trim().replace(/,/g, '').replace(/--/g, '0');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/** 判断账户是否已结清/销户 */
function isClosedAccount(lines: string[]): boolean {
  return lines.some((l) => /^(结清|提前结清|销户)$/.test(l.trim()));
}

/** 提取当前逾期期数 */
function parseCurrentOverdue(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    if (!/当前[途逾]期期数/.test(lines[i].trim())) continue;
    return findFirstNumber(lines, i + 1, 5);
  }
  return 0;
}

/** 从还款记录中提取最大逾期期数 */
function parseMaxOverdueFromRepayment(lines: string[]): number {
  let max = 0;
  let inRepay = false;
  for (const line of lines) {
    const t = line.trim();
    if (/还款记录/.test(t)) { inRepay = true; continue; }
    if (!inRepay) continue;
    if (/^[1-7]$/.test(t)) {
      const v = parseInt(t, 10);
      if (v > max) max = v;
    }
  }
  return max;
}

/**
 * 提取本月应还款金额 — 优先表格模式，回退行模式
 */
function parseMonthlyPayment(
  lines: string[], account: AccountBlock, table?: RebuiltTable,
): number {
  // 表格模式：用列位置直接匹配"本月应还款"
  if (table) {
    const result = parsePaymentFromTable(table, account);
    if (result > 0) return result;
  }

  // 行模式回退
  const isCreditCard = account.parentBlock === 'CREDIT_CARD';
  return isCreditCard
    ? parseCreditCardPayment(lines)
    : parseLoanPayment(lines);
}

/** 贷款账户标签列表 */
const LOAN_PAYMENT_LABELS = [
  '账户状态', '五级分类', '余额', '剩余还款期数',
  '本月应还款', '应还款日', '本月实还款',
];

/** 贷记卡账户标签列表 */
const CARD_PAYMENT_LABELS = [
  '账单日', '本月应还款', '本月实还款',
  '最近一次还款日期', '当前逾期期数', '当前逾期总额',
];

/** 表格模式：在账户行范围内找"本月应还款"标签行，按列位置取值 */
function parsePaymentFromTable(
  table: RebuiltTable, account: AccountBlock,
): number {
  // 在全局表格中定位账户标题行
  const accountTitleRow = findRowByLabel(table, account.label);
  if (accountTitleRow < 0) return 0;

  // 从账户标题行开始找"本月应还款"标签行
  const isCreditCard = account.parentBlock === 'CREDIT_CARD';
  const labels = isCreditCard ? CARD_PAYMENT_LABELS : LOAN_PAYMENT_LABELS;

  const labelRow = findRowByLabel(table, '本月应还款', accountTitleRow);
  if (labelRow < 0) return 0;

  const values = matchLabelValues(table, labelRow, labels);
  return values.get('本月应还款') ?? 0;
}

/** 贷记卡：账单日/本月应还款/... → 值区第2个 */
function parseCreditCardPayment(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    if (!/^本月应还款$/.test(lines[i].trim())) continue;
    // 找到标签组结束（当前逾期总额/当前途期总额之后）
    let labelEnd = i;
    for (let j = i; j < Math.min(i + 8, lines.length); j++) {
      if (/当前[途逾]期总额/.test(lines[j].trim())) { labelEnd = j; break; }
    }
    // 值区：账单日值, 本月应还款值, ...
    // 本月应还款是标签组第2个，所以值区第2个
    const values = collectAmountValues(lines, labelEnd + 1, 6);
    return values[1] ?? 0; // 索引1 = 本月应还款
  }
  return 0;
}

/** 贷款：账户状态/.../本月应还款/应还款日/本月实还款 → 值区第5个 */
function parseLoanPayment(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    if (!/^本月应还款$/.test(lines[i].trim())) continue;
    // 向前找"账户状态"标签确定标签组起始
    let labelStart = i;
    for (let j = i - 1; j >= Math.max(i - 10, 0); j--) {
      if (/^账户状态$/.test(lines[j].trim())) { labelStart = j; break; }
    }
    // 找标签组结束（本月实还款之后）
    let labelEnd = i;
    for (let j = i; j < Math.min(i + 5, lines.length); j++) {
      if (/^本月实还款$/.test(lines[j].trim())) { labelEnd = j; break; }
    }
    // 值区：状态值/分类值/余额值/剩余期数值/本月应还款值/应还款日值/本月实还款值
    const values = collectAmountValues(lines, labelEnd + 1, 7);
    return values[4] ?? 0; // 索引4 = 本月应还款
  }
  return 0;
}

/** 收集值区的数值/日期（跳过标签行和噪声） */
function collectAmountValues(
  lines: string[], start: number, count: number,
): number[] {
  const values: number[] = [];
  for (let i = start; i < lines.length && values.length < count; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;
    // 跳过明显的标签行
    if (/[\u4e00-\u9fa5]{2,}/.test(raw) && !/^\d/.test(raw)) continue;
    // 解析数值（支持逗号分隔）
    const cleaned = raw.replace(/,/g, '');
    if (/^\d+(\.\d+)?$/.test(cleaned)) {
      values.push(parseFloat(cleaned));
    }
  }
  return values;
}

/** 在指定范围内找第一个整数 */
function findFirstNumber(
  lines: string[], start: number, maxScan: number,
): number {
  for (let j = start; j < Math.min(start + maxScan, lines.length); j++) {
    const t = lines[j].trim().replace(/,/g, '');
    if (/^\d+$/.test(t)) return parseInt(t, 10);
  }
  return 0;
}

