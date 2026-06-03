/**
 * 贷款类账户表格解析共享工具函数
 *
 * 被 non-revolving-loan-parser 和 revolving-loan1-parser 共用
 */

import type { ContextTable } from '../doc-table-bridge';

/** 取一组内第一个非空值 */
export function getGroupValue(row: string[], groupStart: number, groupSize: number): string {
  for (let i = groupStart; i < groupStart + groupSize && i < row.length; i++) {
    const v = row[i]?.trim();
    if (v) return v;
  }
  return '';
}

/** 在标签行中模糊匹配关键词，返回所在组的起始索引 */
export function findLabelGroup(labelRow: string[], keyword: string, groupSize: number): number {
  for (let i = 0; i < labelRow.length; i++) {
    if (labelRow[i]?.includes(keyword)) {
      return Math.floor(i / groupSize) * groupSize;
    }
  }
  return -1;
}

/** 从标签行+值行中按关键词提取值 */
export function getLabeledValue(
  labelRow: string[], valueRow: string[], keyword: string, groupSize: number,
): string {
  const group = findLabelGroup(labelRow, keyword, groupSize);
  if (group < 0) return '';
  return getGroupValue(valueRow, group, groupSize);
}

/** 解析数字，先清洗换行粘连再去除千分位分隔符 */
export function parseNum(s: string): number {
  // 先去掉 \n 后面的中文（如 "150,000\n人民币元" → "150,000"）
  let cleaned = cleanNumStr(s);
  cleaned = cleaned.replace(/,/g, '').trim();
  // OCR 可能将千分位逗号识别为小数点，如 "9.000" 实为 9000
  cleaned = cleaned.replace(/\.(\d{3})(?!\d)/g, '$1');
  const n = Number(cleaned);
  return isNaN(n) ? 0 : n;
}

/** 判断是否为续表（非新账户表格），sectionPrefix 用于匹配章节首表 */
export function isContinuationTable(ct: ContextTable, sectionPrefix: RegExp): boolean {
  return !/[账戶户]户?\d+/.test(ct.precedingText) && !sectionPrefix.test(ct.precedingText);
}

/** 判断表格是否有标准贷管理机构） */
export function hasLoanHeader(ct: ContextTable): boolean {
  return ct.table.headers.some(h => h.includes('管理机构'));
}

/**
 * 检测分栏截断表：有标准表头但数据行不足（rows < minRows）
 * 当检测到时，将当前表头与下一张续表合并为完整 ContextTable
 *
 * 续表结构：headers 实际是原表的第一行数据值，rows 是剩余数据行
 * 合并策略：当前表 headers + [续表 headers（作为首行数据）, ...续表 rows]
 */
export function tryMergeSplitTable(
  tables: ContextTable[], idx: number, isHeader: (ct: ContextTable) => boolean, minRows: number,
): { merged: ContextTable; skip: number } | null {
  const ct = tables[idx];
  if (ct.table.rows.length >= minRows) return null;
  const next = tables[idx + 1];
  if (!next || isHeader(next)) return null;
  // 续表的 headers 是被截断的第一行数据，拼回 rows 前面
  const mergedRows = [next.table.headers, ...next.table.rows];
  // 再把原表已有的 rows（如果有的话）也放在最前面
  const allRows = [...ct.table.rows, ...mergedRows];
  const merged: ContextTable = {
    ...ct,
    table: { headers: ct.table.headers, rows: allRows },
  };
  return { merged, skip: 2 };
}

// ── OCR 粘连清洗函数 ──

/** 按真正换行符和字面量 \n 两种模式分割（OCR 结果可能是任一种） */
function splitLines(s: string): string[] {
  return s.replace(/\\n/g, '\n').split('\n');
}

const ORG_SUFFIXES = ['公司', '银行', '中心', '合作社'];

/**
 * 清洗管理机构名称
 * 处理粘连模式：
 * - "N10156530\n重庆美团三快小...贷款有限公司3054..." → "重庆美团三快小额贷款有限公司"
 * - "深圳市中融小额贷X4403...款有限公司2022.09.11..." → "深圳市中融小额贷款有限公司"
 */
export function cleanOrg(raw: string): string {
  if (!raw) return '';
  // 多行时逐行找含机构后缀的行
  const lines = splitLines(raw);
  if (lines.length > 1) {
    for (const line of lines) {
      if (ORG_SUFFIXES.some(s => line.includes(s))) {
        return cleanOrg(line);
      }
    }
  }
  // 单行：截取到最后一个机构后缀
  for (const suffix of ORG_SUFFIXES) {
    const idx = raw.lastIndexOf(suffix);
    if (idx >= 0) {
      let org = raw.slice(0, idx + suffix.length);
      // 去掉混入的数字串（如 "小额贷X4403...款有限公司" 中间的杂质）
      org = org.replace(/[A-Za-z0-9]{6,}/g, '');
      // 去掉残留的标点
      org = org.replace(/[；;，,。.]/g, '');
      return org;
    }
  }
  return raw;
}

/**
 * 清洗账户状态
 * 处理粘连模式：
 * - "正常正常46,200" → "正常"
 * - "结清2025.06.17" → "结清"
 * - "正常" → "正常"
 */
const STATUS_KEYWORDS = ['正常', '结清', '销户', '呆账', '呆帐', '逾期', '冻结', '止付'];

export function cleanStatus(raw: string): string {
  if (!raw) return '';
  // 匹配文本中最早出现的关键词，而非数组顺序
  let bestKw = '';
  let bestIdx = Infinity;
  for (const kw of STATUS_KEYWORDS) {
    const idx = raw.indexOf(kw);
    if (idx >= 0 && idx < bestIdx) {
      bestIdx = idx;
      bestKw = kw;
    }
  }
  return bestKw;
}

/**
 * 清洗含换行的数值字段
 * 处理粘连模式："26,400\n人民币元" → "26,400"
 */
export function cleanNumStr(raw: string): string {
  if (!raw) return '';
  const first = splitLines(raw)[0].trim();
  return first;
}
