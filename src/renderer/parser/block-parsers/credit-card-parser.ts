/**
 * 贷记卡账户明细解析器
 *
 * 从 DocParser 分组后的 ContextTable[] 提取 CreditCardAccount[]
 *
 * 表格形态（由 OCR 识别结果决定）：
 * - 完整在贷表：22-26列，headers 含"发卡机构"，row[0] 基本信息，row[2]/row[3] 状态+已用额度
 * - 基本信息表：8-14列，仅发卡机构+授信额度，后续数据在续表
 * - 续表：headers 不含"发卡机构"/"卡机构"，跳过
 * - 销户表：row[2] 含"销户日期"，row[3] 值为"销户"
 * - 未激活表：row[1] 含"未激活"
 *
 * 与贷款类的差异：
 * - headers 用"发卡机构"而非"管理机构"（OCR 可能识别为"卡机构"）
 * - 授信额度可能粘连在"开立日期"中（如 "2016.06.21\n10000"）
 * - 账户状态/已用额度在 row[2]/row[3]（不是 row[4]/row[5]）
 */

import type { CreditCardAccount } from '../../types/credit-report';
import type { ContextTable } from '../doc-table-bridge';
import {
  getGroupValue, findLabelGroup, getLabeledValue, parseNum,
  cleanOrg, cleanStatus, cleanNumStr, tryMergeSplitTable,
  parseRepaymentRecords,
} from './loan-table-utils';

const GS = 1;

/** 判断是否为贷记卡账户表（headers 含"发卡机构"或"卡机构"） */
function isCardHeader(ct: ContextTable): boolean {
  return ct.table.headers.some(h => h.includes('发卡机构') || h.includes('卡机构'));
}

/** 判断是否为续表（headers 不含发卡机构相关关键词） */
function isContinuation(ct: ContextTable): boolean {
  return !isCardHeader(ct);
}

/** 判断是否为误分类表格（如相关还款责任混入贷记卡桶） */
function isMisclassified(ct: ContextTable): boolean {
  const h = ct.table.headers;
  return h.some(v => v.includes('主业务借款人') || v.includes('个人经营性贷款'));
}

/** 从 headers 行 row[0] 提取开立日期（兼容粘连格式） */
function extractOpenDate(headers: string[], row0: string[]): string {
  // 粘连格式："开立日期账户授信额度" → 值为 "2016.06.21\n10000"，取日期部分
  const stickyIdx = findLabelGroup(headers, '开立日期账户授信额度', GS);
  if (stickyIdx >= 0) {
    const raw = getGroupValue(row0, stickyIdx, GS);
    const parts = raw.replace(/\\n/g, '\n').split('\n');
    const datePart = parts[0]?.trim() ?? '';
    if (/\d{4}[.\-/]\d{2}[.\-/]\d{2}/.test(datePart)) return datePart;
  }
  // 标准模式
  const idx = findLabelGroup(headers, '开立日期', GS);
  if (idx >= 0) return getGroupValue(row0, idx, GS);
  return '';
}

/** 从 headers 行 row[0] 提取授信额度（兼容粘连在开立日期中的情况） */
function extractCreditLimit(headers: string[], row0: string[]): number {
  // 检查 headers 是否存在"开立日期账户授信额度"粘连
  const hasStickyHeader = headers.some(h =>
    h.includes('开立日期') && h.includes('账户授信额度'),
  );
  if (hasStickyHeader) {
    // 粘连格式：值为 "2016.06.21\n10000"，取换行后的数字部分
    const stickyIdx = findLabelGroup(headers, '开立日期账户授信额度', GS);
    if (stickyIdx >= 0) {
      const raw = getGroupValue(row0, stickyIdx, GS);
      const parts = raw.replace(/\\n/g, '\n').split('\n');
      const numPart = parts.length > 1 ? parts[parts.length - 1] : parts[0];
      return parseNum(numPart);
    }
  }
  // 标准模式：headers 中有独立的"账户授信额度"
  const idx = findLabelGroup(headers, '账户授信额度', GS);
  if (idx >= 0) {
    const raw = getGroupValue(row0, idx, GS);
    return parseNum(cleanNumStr(raw));
  }
  return 0;
}

/** 从 row[2]/row[3] 提取账户状态 */
function extractStatus(rows: string[][]): string {
  const labelRow = rows[2] ?? [];
  const valueRow = rows[3] ?? [];
  // 标准模式：row[2] 含"账户状态"
  const raw = getLabeledValue(labelRow, valueRow, '账户状态', GS);
  if (raw) return cleanStatus(raw);
  // 未激活：row[1] 含"未激活"
  const row1 = (rows[1] ?? []).join('');
  if (row1.includes('未激活')) return '未激活';
  // 销户：row[2] 含"销户日期"或 row[3] 含"销户"
  if (labelRow.some(c => c.includes('销户日期'))) return '销户';
  if (valueRow.some(c => c.includes('销户'))) return '销户';
  return '';
}

/** 从 row[2]/row[3] 提取已用额度 */
function extractUsedAmount(rows: string[][]): number | null {
  const labelRow = rows[2] ?? [];
  const valueRow = rows[3] ?? [];
  const raw = getLabeledValue(labelRow, valueRow, '已用额度', GS);
  if (!raw) return null;
  return parseNum(cleanNumStr(raw));
}

/** 从单张贷记卡账户表格提取 CreditCardAccount */
function extractFromTable(ct: ContextTable): CreditCardAccount {
  const { headers, rows } = ct.table;
  const row0 = rows[0] ?? [];

  const orgRaw = getGroupValue(row0, findLabelGroup(headers, '卡机构', GS), GS);
  const org = cleanOrg(orgRaw);
  const openDate = extractOpenDate(headers, row0);
  const creditLimit = extractCreditLimit(headers, row0);
  const status = extractStatus(rows);
  const isClosed = /结清|销户|未激活/.test(status);
  const usedAmount = isClosed ? null : extractUsedAmount(rows);

  return {
    org,
    accountId: '',
    openDate,
    creditLimit,
    sharedCreditLimit: null,
    currency: '',
    businessType: '',
    guaranteeType: '',
    status,
    balance: null,
    usedAmount,
    unpostedLargeAmount: null,
    remainInstallments: null,
    avgUsed6m: null,
    maxUsed: null,
    billDate: null,
    monthlyPayment: null,
    actualPayment: null,
    lastPaymentDate: null,
    currentOverdueCount: null,
    currentOverdueAmount: null,
    largeInstallmentInfo: null,
    specialTransactions: [],
    repaymentRecords: parseRepaymentRecords(rows),
    dataSource: null,
  };
}

/** 从分组后的贷记卡表格提取所有账户，跳过续表和误分类表格，处理分栏截断 */
export function parseCreditCards(tables: ContextTable[]): CreditCardAccount[] {
  const accounts: CreditCardAccount[] = [];
  let idx = 0;
  while (idx < tables.length) {
    const ct = tables[idx];
    if (isMisclassified(ct)) { idx++; continue; }
    if (isContinuation(ct)) { idx++; continue; }

    const split = tryMergeSplitTable(tables, idx, t => isCardHeader(t), 2);
    if (split) {
      accounts.push(extractFromTable(split.merged));
      idx += split.skip;
    } else {
      accounts.push(extractFromTable(ct));
      idx++;
    }
  }
  return accounts;
}
