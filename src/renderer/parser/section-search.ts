/**
 * 章节内关键词搜索 — 在已确定的模块范围内搜索关键词并提取数值
 *
 * 核心思路：
 * 1. 利用 section-locator 确定的模块范围（逻辑页码 + y坐标）
 * 2. 在范围内搜索关键词，提取匹配项及其关联数值
 * 3. 支持统计匹配数量、累加数值等操作
 */

import type { DocParserResult, DocLayout } from '../../shared/doc-parser-types';
import { getLevel2CreditMap, type Level2CreditSection, type SectionLocation } from './section-locator';

/** 搜索结果项 */
export interface SearchHit {
  /** 匹配的文本 */
  text: string;
  /** 逻辑页码 */
  logicalPage: number;
  /** y 坐标 */
  positionY: number;
  /** x 坐标 */
  positionX: number;
  /** 物理页码 */
  pageNum: number;
}

/** 计算逻辑页码 */
function calcLogicalPage(pageNum: number, posX: number, pageWidth: number): number {
  const midX = pageWidth / 2;
  const isRightColumn = posX > midX;
  return pageNum * 2 + (isRightColumn ? 2 : 1);
}

/** 判断位置是否在章节范围内 */
function isInSection(
  lp: number,
  y: number,
  section: SectionLocation,
  nextSection?: SectionLocation,
): boolean {
  if (lp < section.logicalPageStart) {
    return false;
  }
  // 同一起始页时，y 坐标必须 >= 章节标题 y 坐标
  if (lp === section.logicalPageStart && y < section.positionY) {
    return false;
  }
  // 如果有下一个章节，需要检查是否超出范围
  if (nextSection) {
    if (lp > nextSection.logicalPageStart) {
      return false;
    }
    // 同一逻辑页时，y 坐标必须 < 下一章节标题 y 坐标
    if (lp === nextSection.logicalPageStart && y >= nextSection.positionY) {
      return false;
    }
  }
  return true;
}

/**
 * 在指定章节范围内搜索关键词
 * @param doc DocParserResult
 * @param section 章节范围
 * @param nextSection 下一个章节（用于确定上边界）
 * @param pattern 搜索模式（字符串或正则）
 * @returns 匹配结果数组
 */
export function searchInSection(
  doc: DocParserResult,
  section: SectionLocation,
  nextSection: SectionLocation | undefined,
  pattern: string | RegExp,
): SearchHit[] {
  const hits: SearchHit[] = [];
  const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

  for (const page of doc.pages) {
    const pageWidth = page.meta?.page_width ?? 842;

    for (const layout of page.layouts) {
      const text = layout.text?.trim() ?? '';
      if (!text) continue;

      const lp = calcLogicalPage(page.page_num, layout.position[0], pageWidth);
      const y = layout.position[1];

      if (!isInSection(lp, y, section, nextSection)) continue;

      if (regex.test(text)) {
        hits.push({
          text,
          logicalPage: lp,
          positionY: y,
          positionX: layout.position[0],
          pageNum: page.page_num,
        });
      }
    }
  }

  return hits;
}

/** 章节顺序 */
const SECTION_ORDER: Level2CreditSection[] = [
  'nonRevolvingLoan',
  'revolvingLoan1',
  'revolvingLoan2',
  'creditCard',
  'repayResponsibility',
  'creditAgreement',
];

/**
 * 统计指定二级模块内的账户数量
 * @param doc DocParserResult
 * @param sectionType 二级模块类型
 * @returns 账户数量
 */
export function countAccountsInSection(
  doc: DocParserResult,
  sectionType: Level2CreditSection,
): number {
  const sectionMap = getLevel2CreditMap();
  const section = sectionMap.get(sectionType);
  if (!section) {
    console.log(`[countAccountsInSection] section ${sectionType} not found`);
    return 0;
  }

  // 找到下一个章节作为上边界
  const currentIndex = SECTION_ORDER.indexOf(sectionType);
  const nextSectionType = SECTION_ORDER[currentIndex + 1];
  const nextSection = nextSectionType ? sectionMap.get(nextSectionType) : undefined;

  // 搜索 "账户" + 数字 的模式
  const hits = searchInSection(doc, section, nextSection, /账户\d+/);

  // 去重：同一个账户可能在多个 layout 中出现
  const uniqueAccounts = new Set(hits.map(h => h.text));

  console.log(`[countAccountsInSection] ${sectionType}: found ${uniqueAccounts.size} accounts`,
    Array.from(uniqueAccounts).join(', '));

  return uniqueAccounts.size;
}

/**
 * 统计所有二级模块的账户数量
 */
export function countAllSectionAccounts(doc: DocParserResult): Record<Level2CreditSection, number> {
  const sections: Level2CreditSection[] = [
    'nonRevolvingLoan',
    'revolvingLoan1', 
    'revolvingLoan2',
    'creditCard',
    'repayResponsibility',
    'creditAgreement',
  ];

  const result = {} as Record<Level2CreditSection, number>;
  for (const s of sections) {
    result[s] = countAccountsInSection(doc, s);
  }

  console.log('[countAllSectionAccounts] result:', result);
  return result;
}

