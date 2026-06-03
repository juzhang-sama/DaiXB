/**
 * 授信协议信息解析器
 *
 * 从 classified.creditAgreement 桶的 ContextTable[] 提取 CreditAgreement[]
 *
 * 表格形态（两种）：
 * 1. 完整表（rows=3）：
 *    headers: ["管理机构","授信协议标识","生效日期","到期日期","授信额度用途"]
 *    row[0]: [机构名, 协议标识, 生效日期, 到期日期, 用途]
 *    row[1]: ["授信额度","授信限额","授信限额编号","已用额度","币种"]  ← 第二组标签
 *    row[2]: [额度值, "", "", 已用额度值, 币种]                      ← 第二组值
 *
 * 2. 跨页表（表头表 rows=0 + 续表）：
 *    表头表: headers=字段名, rows=[]
 *    续表:   headers=值行（机构名等）, rows=[ [第二组标签], [第二组值] ]
 */

import type { CreditAgreement } from '../../types/credit-report';
import type { ContextTable } from '../doc-table-bridge';
import { parseNum, cleanOrg, cleanNumStr } from './loan-table-utils';

/** 判断是否为授信协议表头（headers 含"管理机构"+"授信额度用途"） */
function isHeaderTable(ct: ContextTable): boolean {
  const h = ct.table.headers.join('');
  return h.includes('管理机构') && h.includes('授信额度用途');
}

/** 从完整表（rows>=2）提取授信协议 */
function extractFromComplete(ct: ContextTable): CreditAgreement {
  const { rows } = ct.table;
  const valueRow = rows[0] ?? [];
  const labelRow2 = rows[1] ?? [];
  const valueRow2 = rows[2] ?? [];

  const org = cleanOrg(valueRow[0] ?? '');
  const creditPurpose = valueRow[4] ?? '';

  // 第二组：按标签找授信额度和已用额度的列位置
  const creditIdx = labelRow2.findIndex(c => c.includes('授信额度') && !c.includes('用途') && !c.includes('限额'));
  const usedIdx = labelRow2.findIndex(c => c.includes('已用额度'));

  const creditLimit = creditIdx >= 0 ? parseNum(cleanNumStr(valueRow2[creditIdx] ?? '')) : 0;
  const usedAmount = usedIdx >= 0 ? parseNum(cleanNumStr(valueRow2[usedIdx] ?? '')) : 0;

  return {
    org, agreementId: '', effectiveDate: '', expiryDate: '',
    creditPurpose, creditLimit, limitCap: null, limitCapId: null,
    usedAmount, currency: '',
  };
}

/** 从跨页表（表头表 + 续表）提取授信协议 */
function extractFromSplit(dataTable: ContextTable): CreditAgreement {
  // 续表的 headers 就是第一组值行
  const valueRow = dataTable.table.headers;
  const rows = dataTable.table.rows;
  const labelRow2 = rows[0] ?? [];
  const valueRow2 = rows[1] ?? [];

  const org = cleanOrg(valueRow[0] ?? '');
  const creditPurpose = valueRow[4] ?? '';

  const creditIdx = labelRow2.findIndex(c => c.includes('授信额度') && !c.includes('用途') && !c.includes('限额'));
  const usedIdx = labelRow2.findIndex(c => c.includes('已用额度'));

  const creditLimit = creditIdx >= 0 ? parseNum(cleanNumStr(valueRow2[creditIdx] ?? '')) : 0;
  const usedAmount = usedIdx >= 0 ? parseNum(cleanNumStr(valueRow2[usedIdx] ?? '')) : 0;

  return {
    org, agreementId: '', effectiveDate: '', expiryDate: '',
    creditPurpose, creditLimit, limitCap: null, limitCapId: null,
    usedAmount, currency: '',
  };
}

/** 从授信协议桶提取所有授信协议 */
export function parseCreditAgreements(tables: ContextTable[]): CreditAgreement[] {
  const results: CreditAgreement[] = [];
  let i = 0;

  while (i < tables.length) {
    const ct = tables[i];
    if (!isHeaderTable(ct)) { i++; continue; }

    if (ct.table.rows.length >= 2) {
      // 完整表
      results.push(extractFromComplete(ct));
      i++;
    } else {
      // 跨页表头（rows=0），下一张是续表
      const next = tables[i + 1];
      if (next && !isHeaderTable(next)) {
        results.push(extractFromSplit(next));
        i += 2;
      } else {
        i++;
      }
    }
  }

  return results;
}

