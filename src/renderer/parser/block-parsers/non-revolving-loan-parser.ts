/**
 * 非循环贷账户明细解析器
 *
 * 从 DocParser 分组后的 ContextTable[] 提取 LoanAccount[]
 *
 * OCR 合并单元格导致列数不固定（24/23/20/18/16/14/6 列均有出现），
 * 不再依赖列数判断账户状态，而是扫描行内容判断。
 */

import type { LoanAccount } from '../../types/credit-report';
import type { ContextTable } from '../doc-table-bridge';
import {
  getGroupValue, findLabelGroup, getLabeledValue, parseNum,
  isContinuationTable, hasLoanHeader, cleanStatus, tryMergeSplitTable,
  parseRepaymentRecords,
} from './loan-table-utils';
import { debugLog } from '../../utils/debug-log';

/** 在 headers 中查找借款金额（兼容 OCR 变体） */
const AMOUNT_VARIANTS = ['借款金额', '僧款金额', '款金'];

function findAmountGroup(headers: string[], gs: number): number {
  for (const kw of AMOUNT_VARIANTS) {
    const idx = findLabelGroup(headers, kw, gs);
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * 扫描 rows 找到含"账户状态"标签的行对，返回 { status, labelRow, valueRow }
 * 不依赖列数或 gs，适配所有 OCR 列数变体
 */
function findStatusInRows(rows: string[][]): { status: string; statusRowIdx: number } {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (row.some(c => c.includes('状态'))) {
      const valueRow = rows[i + 1] ?? [];
      const idx = row.findIndex(c => c.includes('状态'));
      // 标签和值可能粘连（如 "账户状态结清"），先从值行取，取不到则从标签本身提取
      const fromValue = valueRow[idx] ?? valueRow[0] ?? '';
      const raw = fromValue || (row[idx] ?? '');
      return { status: cleanStatus(raw) || '结清', statusRowIdx: i };
    }
  }
  return { status: '结清', statusRowIdx: -1 };
}

/** 从单张完整账户表格提取 LoanAccount */
function extractLoanFromTable(ct: ContextTable, tableIdx?: number): LoanAccount {
  const { headers, rows } = ct.table;
  // 统一用 gs=1，因为合并单元格值已重复填充
  const gs = 1;

  // Debug: 打印表格结构
  debugLog(`[NonRevolvingLoan] 表格${tableIdx ?? '?'} precedingText: "${ct.precedingText}"`);
  debugLog(`[NonRevolvingLoan] headers(${headers.length}):`, headers.slice(0, 10).join(' | '));
  debugLog(`[NonRevolvingLoan] rows count: ${rows.length}`);
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    debugLog(`[NonRevolvingLoan] row[${i}](${rows[i]?.length ?? 0}):`, (rows[i] ?? []).slice(0, 10).join(' | '));
  }

  // 第一组：headers(标签) + row[0](值)
  const row0 = rows[0] ?? [];
  const org = getGroupValue(row0, findLabelGroup(headers, '管理机构', gs), gs);
  const openDate = getGroupValue(row0, findLabelGroup(headers, '开立日期', gs), gs);
  const endDate = getGroupValue(row0, findLabelGroup(headers, '到期日期', gs), gs) || null;
  const amountIdx = findAmountGroup(headers, gs);
  const loanAmount = amountIdx >= 0 ? parseNum(getGroupValue(row0, amountIdx, gs)) : 0;
  const currency = getGroupValue(row0, findLabelGroup(headers, '账户币种', gs), gs);

  // 第二组：row[1](标签) + row[2](值)
  const labelRow1 = rows[1] ?? [];
  const valueRow1 = rows[2] ?? [];
  const businessType = getLabeledValue(labelRow1, valueRow1, '业务种类', gs);
  const guaranteeType = getLabeledValue(labelRow1, valueRow1, '保方式', gs);
  const termCount = getLabeledValue(labelRow1, valueRow1, '还款期数', gs);
  const repayMethod = getLabeledValue(labelRow1, valueRow1, '还款方式', gs);

  // Debug: 打印第二组提取结果
  debugLog(`[NonRevolvingLoan] 第二组提取: businessType="${businessType}" guaranteeType="${guaranteeType}" termCount="${termCount}" repayMethod="${repayMethod}"`);

  // 状态与五级分类：扫描所有行找"账户状态"标签
  const { status, statusRowIdx } = findStatusInRows(rows);
  debugLog(`[NonRevolvingLoan] findStatusInRows: status="${status}" statusRowIdx=${statusRowIdx}`);
  const isClosed = /结清|销户/.test(status);
  let fiveCategory: string | null = null;

  let balance: number | null = null;
  let remainTerms: number | null = null;
  let monthlyPayment: number | null = null;
  let paymentDueDate: string | null = null;
  let actualPayment: number | null = null;
  let currentOverdueCount: number | null = null;
  let currentOverdueAmount: number | null = null;

  if (statusRowIdx >= 0) {
    const lr = rows[statusRowIdx] ?? [];
    const vr = rows[statusRowIdx + 1] ?? [];
    fiveCategory = getLabeledValue(lr, vr, '五级分类', gs) || null;

    if (!isClosed) {
      balance = parseNum(getLabeledValue(lr, vr, '余额', gs));
      remainTerms = parseNum(getLabeledValue(lr, vr, '剩余还款期数', gs)) || null;
      monthlyPayment = parseNum(getLabeledValue(lr, vr, '本月应还款', gs));
      paymentDueDate = getLabeledValue(lr, vr, '应还款日', gs) || null;
      actualPayment = parseNum(getLabeledValue(lr, vr, '本月实还款', gs));

      const lr3 = rows[statusRowIdx + 2] ?? [];
      const vr3 = rows[statusRowIdx + 3] ?? [];
      currentOverdueCount = parseNum(getLabeledValue(lr3, vr3, '当前逾期期数', gs)) || null;
      currentOverdueAmount = parseNum(getLabeledValue(lr3, vr3, '当前逾期总额', gs)) || null;
    }
  }

  return {
    org, accountId: '', openDate, endDate,
    loanAmount, currency, businessType, guaranteeType,
    termCount: termCount ? parseInt(termCount, 10) || null : null,
    termFrequency: null, repayMethod: repayMethod || null,
    jointLoanFlag: null,
    status, fiveCategory, closeDate: null,
    balance, remainTerms, monthlyPayment, paymentDueDate,
    actualPayment, currentOverdueCount, currentOverdueAmount,
    overdue31_60: null, overdue61_90: null,
    overdue91_180: null, overdue180plus: null,
    specialTransactions: [], repaymentRecords: parseRepaymentRecords(rows), dataSource: null,
  };
}

/** 非循环贷章节首表匹配：(一)非循环贷账户 */
const SECTION_PREFIX = /^\(一\)/;

/** 从分组后的非循环贷表格提取所有账户，跳过续表，处理分栏截断 */
export function parseNonRevolvingLoans(tables: ContextTable[]): LoanAccount[] {
  const accounts: LoanAccount[] = [];
  let idx = 0;
  while (idx < tables.length) {
    const ct = tables[idx];
    if (isContinuationTable(ct, SECTION_PREFIX) && !hasLoanHeader(ct)) { idx++; continue; }
    if (!hasLoanHeader(ct)) { idx++; continue; }

    // 分栏截断检测：表头完整但数据行不足，尝试与下一张续表合并
    // 完整表格至少需要 3 行：row[0]=第一组值, row[1]=第二组标签, row[2]=第二组值
    const split = tryMergeSplitTable(tables, idx, t => hasLoanHeader(t), 3);
    if (split) {
      accounts.push(extractLoanFromTable(split.merged, idx));
      idx += split.skip;
    } else {
      accounts.push(extractLoanFromTable(ct, idx));
      idx++;
    }
  }
  return accounts;
}
