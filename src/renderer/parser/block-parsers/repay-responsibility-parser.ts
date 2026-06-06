/**
 * 相关还款责任信息明细解析器
 *
 * 央行本人详版里该模块常见两种 OCR 形态：
 * - 跨页截断：表头在上一栏/上一页，下一张表的 headers 实际是第一行值
 * - 同表完整：headers 是字段名，row[0] 是字段值，后续是借款人/余额等标签值行
 */

import type { RepayResponsibilityAccount } from '../../types/credit-report';
import type { ContextTable } from '../doc-table-bridge';
import {
  getLabeledValue, parseNum,
  cleanOrg, cleanNumStr,
} from './loan-table-utils';

const GS = 1;
const RESP_TYPE_KEYWORDS = ['保证人', '共同借款人', '担保人', '抵押人'];
const NUM_PATTERN = /^[0-9,]+(?:\.\d+)?$/;

interface BasicInfo {
  org: string;
  businessType: string;
  openDate: string;
  endDate: string | null;
  responsibilityType: string;
  responsibilityAmount: number;
  currency: string;
  contractNo: string | null;
}

interface DetailInfo {
  borrowerName: string | null;
  borrowerCertType: string | null;
  borrowerCertNo: string | null;
  balance: number | null;
  fiveCategory: string | null;
  repayStatus: string | null;
}

function isHeaderTable(ct: ContextTable): boolean {
  return ct.table.headers.some(h =>
    h.includes('管理机构') || h.includes('责任人') || h.includes('还款责任'),
  );
}

function extractBasicInfo(labelRow: string[], valueRow: string[]): BasicInfo {
  const semantic = extractSemanticBasicInfo(valueRow);
  const amountRaw = getByLabel(labelRow, valueRow, '还款责任金额');

  return {
    org: cleanOrg(getByLabel(labelRow, valueRow, '管理机构') || semantic.org),
    businessType: getByLabel(labelRow, valueRow, '业务种类'),
    openDate: getByLabel(labelRow, valueRow, '开立日期'),
    endDate: nullable(getByLabel(labelRow, valueRow, '到期日期')),
    responsibilityType: getByLabel(labelRow, valueRow, '责任人类型') || semantic.responsibilityType,
    responsibilityAmount: amountRaw ? parseNum(cleanNumStr(amountRaw)) : semantic.responsibilityAmount,
    currency: getByLabel(labelRow, valueRow, '币种'),
    contractNo: nullable(getByLabel(labelRow, valueRow, '保证合同编号')),
  };
}

function extractSemanticBasicInfo(values: string[]): {
  org: string;
  responsibilityType: string;
  responsibilityAmount: number;
} {
  let org = '';
  let responsibilityType = '';
  const amounts: number[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!responsibilityType && RESP_TYPE_KEYWORDS.some(k => trimmed.includes(k))) {
      responsibilityType = trimmed;
      continue;
    }
    if (isOrgLike(trimmed) && trimmed.length > org.length) {
      org = trimmed;
      continue;
    }
    if (NUM_PATTERN.test(trimmed)) {
      amounts.push(parseNum(cleanNumStr(trimmed)));
    }
  }

  return {
    org: cleanOrg(org),
    responsibilityType,
    responsibilityAmount: amounts[0] ?? 0,
  };
}

function extractDetailInfo(rows: string[][]): DetailInfo {
  const borrowerPair = findLabelValuePair(rows, '主业务借款人');
  const statusPair = findLabelValuePair(rows, '余额') ?? findLabelValuePair(rows, '五级分类');

  const borrowerName = borrowerPair
    ? nullable(getByLabel(borrowerPair.labelRow, borrowerPair.valueRow, '主业务借款人'))
    : null;
  const borrowerCertType = borrowerPair
    ? nullable(getByLabel(borrowerPair.labelRow, borrowerPair.valueRow, '主业务借款人证件类型'))
    : null;
  const borrowerCertNo = borrowerPair
    ? nullable(getByLabel(borrowerPair.labelRow, borrowerPair.valueRow, '主业务借款人证件号码'))
    : null;

  const balanceRaw = statusPair
    ? getByLabel(statusPair.labelRow, statusPair.valueRow, '余额')
    : '';

  return {
    borrowerName,
    borrowerCertType,
    borrowerCertNo,
    balance: balanceRaw ? parseNum(cleanNumStr(balanceRaw)) : null,
    fiveCategory: statusPair
      ? nullable(getByLabel(statusPair.labelRow, statusPair.valueRow, '五级分类'))
      : null,
    repayStatus: statusPair
      ? nullable(getByLabel(statusPair.labelRow, statusPair.valueRow, '还款状态'))
      : null,
  };
}

function extractAccount(dataTable: ContextTable, headerLabels?: string[]): RepayResponsibilityAccount | null {
  const valueRow = headerLabels ? dataTable.table.headers : dataTable.table.rows[0];
  if (!valueRow) return null;

  const basic = extractBasicInfo(headerLabels ?? dataTable.table.headers, valueRow);
  const detailRows = headerLabels ? dataTable.table.rows : dataTable.table.rows.slice(1);
  const detail = extractDetailInfo(detailRows);

  return {
    ...basic,
    ...detail,
    dataSource: null,
  };
}

export function parseRepayResponsibilities(
  tables: ContextTable[],
): RepayResponsibilityAccount[] {
  const accounts: RepayResponsibilityAccount[] = [];

  for (let i = 0; i < tables.length; i++) {
    const current = tables[i];
    if (!isHeaderTable(current)) continue;

    if (current.table.rows.length > 0) {
      const account = extractAccount(current);
      if (account) accounts.push(account);
      continue;
    }

    const next = tables[i + 1];
    if (!next) continue;
    const account = extractAccount(next, current.table.headers);
    if (account) accounts.push(account);
    i++;
  }

  return accounts;
}

function getByLabel(labelRow: string[], valueRow: string[], keyword: string): string {
  return getLabeledValue(labelRow, valueRow, keyword, GS).trim();
}

function findLabelValuePair(rows: string[][], keyword: string): {
  labelRow: string[];
  valueRow: string[];
} | null {
  for (let i = 0; i < rows.length - 1; i++) {
    if (rows[i].some((cell) => cell.includes(keyword))) {
      return { labelRow: rows[i], valueRow: rows[i + 1] };
    }
  }
  return null;
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isOrgLike(value: string): boolean {
  return value.includes('银行') || value.includes('公司') || value.includes('金融');
}
