/**
 * 相关还款责任信息明细解析器
 *
 * 从 DocParser 分组后的 ContextTable[] 提取 RepayResponsibilityAccount[]
 *
 * 表格形态（由 OCR 识别结果决定）：
 * - 表头表：在页尾，只有 headers 没有数据行（rows=0）
 *   headers: ["管理机构-", "=\n业务种类", "开立日期", "到期日期", "责任人类型", "还款责任金额", "币种", "保证合同编号"]
 * - 续表：在下一页左上角，包含实际数据（row[0] 基本信息值，row[2]/row[3] 含主业务借款人/余额等）
 *
 * 与贷款类的差异：
 * - 表头和数据可能分在两张表中（跨页）
 * - headers 中用"管理机构"（可能带 OCR 杂质如"管理机构-"）
 * - row[0] 对应 headers 的值行（管理机构、责任人类型、还款责任金额等）
 * - row[2]/row[3] 为标签行+值行，含"主业务借款人"、"余额"等
 */

import type { RepayResponsibilityAccount } from '../../types/credit-report';
import type { ContextTable } from '../doc-table-bridge';
import {
  getLabeledValue, parseNum,
  cleanOrg, cleanNumStr,
} from './loan-table-utils';

const GS = 1;

/** 判断是否为还款责任表头（headers 含"管理机构"或"责任"相关关键词） */
function isHeaderTable(ct: ContextTable): boolean {
  return ct.table.headers.some(h =>
    h.includes('管理机构') || h.includes('责任人') || h.includes('还款责任'),
  );
}

/**
 * 从续表 headers（实际是值行）中按语义提取字段
 *
 * 表头表和续表列数不对齐（8 vs 10），不能按索引匹配。
 * 续表 headers 的值有明确语义特征，直接按模式识别：
 * - 管理机构：含"银行"|"公司"|"金融"的最长字符串
 * - 责任人类型："保证人"|"共同借款人"等固定枚举
 * - 还款责任金额：纯数字（带逗号），取第一个匹配
 */

const RESP_TYPE_KEYWORDS = ['保证人', '共同借款人', '担保人', '抵押人'];
const NUM_PATTERN = /^[0-9,]+$/;

/** 从续表 headers 值行中按语义提取基本信息 */
function extractBasicInfo(values: string[]): {
  org: string; responsibilityType: string; responsibilityAmount: number;
} {
  let org = '';
  let responsibilityType = '';
  const amounts: number[] = [];

  for (const v of values) {
    const trimmed = v.trim();
    // 责任人类型
    if (!responsibilityType && RESP_TYPE_KEYWORDS.some(k => trimmed.includes(k))) {
      responsibilityType = trimmed;
      continue;
    }
    // 管理机构：含机构关键词且比当前更长
    if ((trimmed.includes('银行') || trimmed.includes('公司') || trimmed.includes('金融')) && trimmed.length > org.length) {
      org = trimmed;
      continue;
    }
    // 数值（还款责任金额候选）
    if (NUM_PATTERN.test(trimmed) && trimmed.length > 0) {
      amounts.push(parseNum(cleanNumStr(trimmed)));
    }
  }

  // 还款责任金额取第一个数值（通常是较大的那个）
  const responsibilityAmount = amounts.length > 0 ? amounts[0] : 0;
  return { org: cleanOrg(org), responsibilityType, responsibilityAmount };
}

/** 从续表 rows 提取主业务借款人和余额 */
function extractDetailInfo(rows: string[][]): {
  borrowerName: string | null; balance: number | null;
} {
  const borrowerLabelRow = rows[0] ?? [];
  const borrowerValueRow = rows[1] ?? [];
  const borrowerName = getLabeledValue(borrowerLabelRow, borrowerValueRow, '主业务借款人', GS) || null;

  const balanceLabelRow = rows[3] ?? [];
  const balanceValueRow = rows[4] ?? [];
  const balanceRaw = getLabeledValue(balanceLabelRow, balanceValueRow, '余额', GS);
  const balance = balanceRaw ? parseNum(cleanNumStr(balanceRaw)) : null;

  return { borrowerName, balance };
}

/** 从表头表 + 续表提取单个还款责任账户 */
function extractAccount(
  dataTable: ContextTable,
): RepayResponsibilityAccount {
  const { org, responsibilityType, responsibilityAmount } = extractBasicInfo(dataTable.table.headers);
  const { borrowerName, balance } = extractDetailInfo(dataTable.table.rows);

  return {
    org,
    businessType: '',
    openDate: '',
    endDate: null,
    responsibilityType,
    responsibilityAmount,
    currency: '',
    contractNo: null,
    borrowerName,
    borrowerCertType: null,
    borrowerCertNo: null,
    balance,
    fiveCategory: null,
    repayStatus: null,
    dataSource: null,
  };
}

/** 从分组后的还款责任表格提取所有账户 */
export function parseRepayResponsibilities(
  tables: ContextTable[],
): RepayResponsibilityAccount[] {
  if (tables.length === 0) return [];

  // 找到表头表（headers 含"管理机构"等关键词，rows=0）
  const headerIdx = tables.findIndex(isHeaderTable);
  if (headerIdx < 0) return [];

  const dataTable = tables[headerIdx + 1];
  if (!dataTable) return [];

  const account = extractAccount(dataTable);
  return [account];
}

