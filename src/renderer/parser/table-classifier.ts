/**
 * 表格分类器 — 按征信报告固定结构将 ContextTable[] 分配到各模块桶
 *
 * 央行二代个人征信报告结构固定，每张表格前的章节标题（precedingText）
 * 可作为天然分类标签，避免跨模块关键词误匹配。
 *
 * 分类依据：precedingText > headers 关键词 > 页码位置
 */

import type { ContextTable } from './doc-table-bridge';

/** 按征信报告模块分类后的表格集合 */
export interface ClassifiedTables {
  /** 0. 报告头 */
  header: ContextTable[];
  /** 1. 身份信息 */
  identity: ContextTable[];
  /** 1. 配偶信息 */
  spouse: ContextTable[];
  /** 1. 居住信息 */
  residence: ContextTable[];
  /** 1. 职业信息 */
  job: ContextTable[];
  /** 3. 信贷明细（非循环贷/循环贷/贷记卡/还款责任） */
  creditAccount: ContextTable[];
  /** 3. 授信协议 */
  creditAgreement: ContextTable[];
  /** 4. 查询记录明细 */
  queryDetail: ContextTable[];
  /** 无法分类的表格 */
  unclassified: ContextTable[];
}

/** 分类规则：precedingText 关键词 → 模块桶名 */
const CLASSIFY_RULES: Array<{ test: (pt: string) => boolean; bucket: keyof ClassifiedTables }> = [
  { test: (pt) => pt.includes('本人版') || pt.includes('报告编号'), bucket: 'header' },
  { test: (pt) => pt.includes('身份信息'), bucket: 'identity' },
  { test: (pt) => pt.includes('配偶信息'), bucket: 'spouse' },
  { test: (pt) => pt.includes('居住信息'), bucket: 'residence' },
  { test: (pt) => pt.includes('职业信息'), bucket: 'job' },
  // 信息概要相关表格直接归入 unclassified（已删除该模块）
  { test: (pt) => pt.includes('信贷交易信息提示'), bucket: 'unclassified' },
  { test: (pt) => pt.includes('负债信息概要') || pt.includes('授信及负债'), bucket: 'unclassified' },
  { test: (pt) => pt.includes('查询记录概要'), bucket: 'unclassified' },
  { test: (pt) => pt.includes('非循环贷账户') || pt.includes('循环贷账户'), bucket: 'creditAccount' },
  { test: (pt) => /^账户/.test(pt), bucket: 'creditAccount' },
  { test: (pt) => /^授信协议/.test(pt), bucket: 'creditAgreement' },
  { test: (pt) => pt.includes('查询记录明细'), bucket: 'queryDetail' },
  { test: (pt) => pt.includes('编制说明'), bucket: 'unclassified' },
];

/**
 * 将 ContextTable[] 按征信报告固定结构分类到各模块桶
 */
export function classifyTables(tables: ContextTable[]): ClassifiedTables {
  const result = createEmptyBuckets();
  let lastBucket: keyof ClassifiedTables = 'unclassified';

  for (const ct of tables) {
    const pt = ct.precedingText.trim();
    let bucket: keyof ClassifiedTables = 'unclassified';

    const matchPt = matchByPrecedingText(pt);
    if (matchPt) {
      bucket = matchPt;
    } else {
      const matchCont = matchContinuation(pt, lastBucket);
      if (matchCont) {
        bucket = matchCont;
      } else {
        const matchHead = matchByHeaders(ct);
        if (matchHead) {
          bucket = matchHead;
        }
      }
    }

    result[bucket].push(ct);
    lastBucket = bucket;
  }

  return result;
}

/** 按 precedingText 匹配分类规则 */
function matchByPrecedingText(pt: string): keyof ClassifiedTables | null {
  if (!pt) return null;
  for (const rule of CLASSIFY_RULES) {
    if (rule.test(pt)) return rule.bucket;
  }
  return null;
}

/** 空 precedingText → 跨页续表，归入前一张表的桶 */
function matchContinuation(
  pt: string, lastBucket: keyof ClassifiedTables,
): keyof ClassifiedTables | null {
  if (pt === '') return lastBucket;
  return null;
}

/** 按 headers 关键词兜底分类 */
function matchByHeaders(ct: ContextTable): keyof ClassifiedTables | null {
  const h = ct.table.headers.join(' ');
  if (h.includes('发卡机构')) return 'creditAccount';
  if (h.includes('管理机构')) return 'creditAccount';
  if (h.includes('还款记录') || h.includes('还款状态')) return 'creditAccount';
  if (h.includes('查询日期') || h.includes('查询机构')) return 'queryDetail';
  return null;
}

/** 创建空桶 */
function createEmptyBuckets(): ClassifiedTables {
  return {
    header: [], identity: [], spouse: [], residence: [], job: [],
    creditAccount: [], creditAgreement: [], queryDetail: [],
    unclassified: [],
  };
}

