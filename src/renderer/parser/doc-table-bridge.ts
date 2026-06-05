/**
 * 文档解析结果桥接层 — 从 DocParserResult 提取所有 Markdown 表格
 *
 * 将百度文档解析 API 返回的结构化数据转为 ParsedTable 数组，
 * 供各 block parser 按关键词搜索表格并提取值
 */

import type { DocParserResult } from '../../shared/doc-parser-types';
import { parseMarkdownTable, type ParsedTable } from './markdown-table-parser';
import { getLevel1Map } from './section-locator';
import { debugLog } from '../utils/debug-log';

/** 带上下文的表格：包含所在页码和前后文本 */
export interface ContextTable {
  table: ParsedTable;
  /** 物理页码（PDF 页） */
  pageNum: number;
  /** 逻辑页码（征信报告页，考虑左右双栏） */
  logicalPage: number;
  /** 表格 y 坐标（用于同一逻辑页内的排序） */
  positionY: number;
  /** 表格在 layouts 中的前一个文本元素（用于定位区块） */
  precedingText: string;
  /** 原始 markdown */
  markdown: string;
}

/**
 * 从文档解析结果中提取所有表格，附带上下文信息
 * 同时初始化章节页码映射缓存（从 layouts 中扫描章节标题）
 */
export function extractTablesFromDoc(doc: DocParserResult): ContextTable[] {
  const result: ContextTable[] = [];

  // 缓存 doc 供溯源时扫描 layouts
  setCachedDocResult(doc);

  // 先扫描 layouts 构建章节页码映射（必须在提取表格前完成）
  buildSectionPageMapFromDoc(doc);

  for (const page of doc.pages) {
    const pageWidth = page.meta?.page_width ?? 842;
    const midX = pageWidth / 2;

    for (let i = 0; i < page.layouts.length; i++) {
      const layout = page.layouts[i];
      if (layout.type !== 'table') continue;

      const tableData = page.tables.find((t) => t.layout_id === layout.layout_id);
      if (!tableData?.markdown) continue;

      const parsed = parseMarkdownTable(tableData.markdown);
      if (parsed.headers.length === 0) continue;

      // 找前一个非表格文本作为上下文
      const preceding = findPrecedingText(page.layouts, i);

      // 计算逻辑页码：物理页 * 2 + (右栏 ? 2 : 1)
      const isRightColumn = layout.position[0] > midX;
      const logicalPage = page.page_num * 2 + (isRightColumn ? 2 : 1);

      result.push({
        table: parsed,
        pageNum: page.page_num,
        logicalPage,
        positionY: layout.position[1],
        precedingText: preceding,
        markdown: tableData.markdown,
      });
    }
  }

  return result;
}

/** 找到当前 layout 之前最近的文本元素 */
function findPrecedingText(
  layouts: DocParserResult['pages'][0]['layouts'], idx: number,
): string {
  for (let i = idx - 1; i >= 0; i--) {
    if (layouts[i].type !== 'table' && layouts[i].text) {
      return layouts[i].text;
    }
  }
  return '';
}

/**
 * 在表格列表中查找包含指定关键词的表格
 * 搜索范围：表头、数据行第一列、前置文本
 */
export function findTableByKeyword(
  tables: ContextTable[], keyword: string,
): ContextTable | undefined {
  // 优先在前置文本中找
  for (const ct of tables) {
    if (ct.precedingText.includes(keyword)) return ct;
  }
  // 其次在表头中找
  for (const ct of tables) {
    if (ct.table.headers.some((h) => h.includes(keyword))) return ct;
  }
  // 最后在数据行第一列找
  for (const ct of tables) {
    for (const row of ct.table.rows) {
      if (row[0]?.includes(keyword)) return ct;
    }
  }
  return undefined;
}

/**
 * 查找所有包含指定关键词的表格
 */
export function findAllTablesByKeyword(
  tables: ContextTable[], keyword: string,
): ContextTable[] {
  return tables.filter((ct) =>
    ct.precedingText.includes(keyword) ||
    ct.table.headers.some((h) => h.includes(keyword)) ||
    ct.markdown.includes(keyword),
  );
}

/** 账户类型键（信贷交易信息明细下的6个二级模块） */
export type AccountCategory =
  | 'nonRevolvingLoan'    // (一) 非循环贷账户
  | 'revolvingLoan1'      // (二) 循环贷账户一
  | 'revolvingLoan2'      // (三) 循环贷账户二
  | 'creditCard'          // (四) 贷记卡账户
  | 'repayResponsibility' // (五) 相关还款责任信息
  | 'creditAgreement';    // (六) 授信协议信息

/** 章节标题关键词 → 账户类型映射 */
const SECTION_KEYWORDS: [string, AccountCategory][] = [
  ['非循环贷账户', 'nonRevolvingLoan'],
  ['循环贷账户一', 'revolvingLoan1'],
  ['循环贷账户二', 'revolvingLoan2'],
  ['贷记卡账户', 'creditCard'],
  ['相关还款责任信息', 'repayResponsibility'],
  ['授信协议信息', 'creditAgreement'],
];

/** 章节位置信息：逻辑页码 + y 坐标 */
interface SectionPosition {
  logicalPage: number;
  positionY: number;
}

/** 缓存：从 DocParserResult 扫描得到的章节位置映射 */
let cachedSectionPageMap: Map<AccountCategory, SectionPosition> | null = null;

/**
 * 从 DocParserResult 的 layouts 中扫描章节标题，提取各章节首次出现的逻辑页码和 y 坐标
 * 必须在 extractTablesFromDoc() 中调用以初始化缓存
 */
export function buildSectionPageMapFromDoc(doc: DocParserResult): Map<AccountCategory, SectionPosition> {
  const map = new Map<AccountCategory, SectionPosition>();

  for (const page of doc.pages) {
    const pageWidth = page.meta?.page_width ?? 842;
    const midX = pageWidth / 2;

    for (const layout of page.layouts) {
      if (layout.type === 'table') continue; // 跳过表格，只看文本
      const text = layout.text?.trim() ?? '';

      for (const [keyword, category] of SECTION_KEYWORDS) {
        if (text.includes(keyword) && !map.has(category)) {
          const isRightColumn = layout.position[0] > midX;
          const logicalPage = page.page_num * 2 + (isRightColumn ? 2 : 1);
          map.set(category, { logicalPage, positionY: layout.position[1] });
        }
      }
    }
  }

  cachedSectionPageMap = map;
  return map;
}

/** 获取缓存的章节位置映射 */
function getSectionPageMap(): Map<AccountCategory, SectionPosition> {
  return cachedSectionPageMap ?? new Map();
}

/**
 * 根据逻辑页码和 y 坐标判断账户所属类别
 * 同一逻辑页内，用 y 坐标区分章节标题前后的表格
 *
 * 排序规则：先按 logicalPage 从大到小，同页再按 positionY 从大到小
 * 这样同页多章节时，y 值大的章节先被检查，避免被 y 值小的章节"截胡"
 */
function categorizeByPosition(
  logicalPage: number, positionY: number,
  sectionPages: Map<AccountCategory, SectionPosition>,
): AccountCategory | null {
  const sorted = Array.from(sectionPages.entries())
    .sort((a, b) =>
      b[1].logicalPage - a[1].logicalPage || b[1].positionY - a[1].positionY,
    );

  for (const [category, pos] of sorted) {
    if (logicalPage === pos.logicalPage) {
      if (positionY >= pos.positionY) return category;
    } else if (logicalPage > pos.logicalPage) {
      return category;
    }
  }

  return null;
}

/** 判断是否为新账户/新条目表格（兼容 OCR 丢字：账户→戶/户） */
const ACCOUNT_PATTERN = /[账戶户]户?\d+/;
/** 扩展模式：匹配 "账户"（无数字）或 "授信协议N" */
const ENTRY_PATTERN = /^账户$|授信协议\d+/;

/** 判断表格是否在右栏 */
function isRightColumn(logicalPage: number): boolean {
  return logicalPage % 2 === 0;
}

/** 判断 x 坐标是否在右栏 */
function isRightColumnByX(x: number, pageWidth: number): boolean {
  return x > pageWidth / 2;
}

/** 判断表格是否超出信贷交易明细范围（已进入查询记录或更后面的章节） */
function isBeyondBoundary(ct: ContextTable, boundaryLp: number, boundaryY: number): boolean {
  if (ct.logicalPage > boundaryLp) return true;
  if (ct.logicalPage === boundaryLp && ct.positionY >= boundaryY) return true;
  return false;
}

/** 判断表格是否在信贷交易明细范围之前（尚未进入 creditDetail） */
function isBeforeCreditDetail(
  ct: ContextTable, sectionPages: Map<AccountCategory, SectionPosition>,
): boolean {
  const first = sectionPages.get('nonRevolvingLoan');
  if (!first) return false;
  if (ct.logicalPage < first.logicalPage) return true;
  if (ct.logicalPage === first.logicalPage && ct.positionY < first.positionY) return true;
  return false;
}


/** 缓存的 DocParserResult，用于溯源时扫描 layouts */
let cachedDocResult: DocParserResult | null = null;

/** 设置缓存的 DocParserResult */
export function setCachedDocResult(doc: DocParserResult): void {
  cachedDocResult = doc;
}

/**
 * 溯源查找续表对应的源账户
 * - 续表在右栏 → 向同一物理页左栏溯源
 * - 续表在左栏 → 向上一物理页右栏溯源
 *
 * 在目标栏位的 layouts 中找 y 最大（最下方）的 "账户N" 文本
 */
function findSourceCategory(
  currentIdx: number,
  tables: ContextTable[],
  sectionPages: Map<AccountCategory, SectionPosition>,
): AccountCategory | null {
  const current = tables[currentIdx];
  const currentInRight = isRightColumn(current.logicalPage);

  // 目标物理页和目标栏位
  const targetPageNum = currentInRight ? current.pageNum : current.pageNum - 1;
  const targetInRight = !currentInRight;

  if (!cachedDocResult) {
    debugLog('[findSourceCategory] cachedDocResult 未初始化');
    return null;
  }

  // 找到目标物理页
  const targetPage = cachedDocResult.pages.find(p => p.page_num === targetPageNum);
  if (!targetPage) {
    debugLog(
      `[findSourceCategory] 溯源失败! 续表 #${currentIdx} page=${current.pageNum} lp=${current.logicalPage} ` +
      `目标物理页 ${targetPageNum} 不存在`
    );
    return null;
  }

  const pageWidth = targetPage.meta?.page_width ?? 842;

  // 在目标栏位的 layouts 中找 y 最大的 "账户N" 文本
  let bestMatch: { y: number; text: string } | null = null;

  for (const layout of targetPage.layouts) {
    const text = layout.text?.trim() ?? '';
    if (!ACCOUNT_PATTERN.test(text) && !ENTRY_PATTERN.test(text)) continue;

    const layoutInRight = isRightColumnByX(layout.position[0], pageWidth);
    if (layoutInRight !== targetInRight) continue;

    const y = layout.position[1];

    if (!bestMatch || y > bestMatch.y) {
      bestMatch = { y, text };
    }
  }

  if (bestMatch) {
    // 用找到的位置计算逻辑页码，然后用位置归类
    const logicalPage = targetPageNum * 2 + (targetInRight ? 2 : 1);
    const category = categorizeByPosition(logicalPage, bestMatch.y, sectionPages);
    return category;
  }

  // 没找到，报错
  debugLog(
    `[findSourceCategory] 溯源失败! 续表 #${currentIdx} page=${current.pageNum} lp=${current.logicalPage} ` +
    `在${currentInRight ? '右栏' : '左栏'}，目标: page=${targetPageNum} ${targetInRight ? '右栏' : '左栏'}，未找到"账户N"文本`
  );
  return null;
}

/**
 * 将 creditAccount 桶中的表格按逻辑页码范围精确分组
 *
 * 策略：
 * 1. 使用从 DocParserResult layouts 中预先扫描的章节页码映射
 * 2. 判断表格是新账户还是续表（通过 precedingText 是否匹配"账户N"）
 * 3. 续表向前溯源，继承源表格的分类
 */
export function groupAccountTables(
  tables: ContextTable[],
): Record<AccountCategory, ContextTable[]> {
  const groups: Record<AccountCategory, ContextTable[]> = {
    nonRevolvingLoan: [],
    revolvingLoan1: [],
    revolvingLoan2: [],
    creditCard: [],
    repayResponsibility: [],
    creditAgreement: [],
  };

  if (tables.length === 0) return groups;

  const sectionPages = getSectionPageMap();

  // 计算信贷交易明细的边界：queryRecord 起始位置之后的表格不属于账户
  const queryRecordSection = getLevel1Map().get('queryRecord');
  const boundaryLp = queryRecordSection?.logicalPageStart ?? Infinity;
  const boundaryY = queryRecordSection?.positionY ?? 0;

  // 第一遍：为所有新条目表格分配分类
  const categoryMap = new Map<number, AccountCategory>();
  for (let idx = 0; idx < tables.length; idx++) {
    const ct = tables[idx];
    // 跳过不在信贷交易明细范围内的表格（上界 + 下界）
    if (isBeforeCreditDetail(ct, sectionPages)) continue;
    if (isBeyondBoundary(ct, boundaryLp, boundaryY)) continue;
    // 匹配 "账户N" 或 "账户"（无数字）或 "授信协议N"
    if (ACCOUNT_PATTERN.test(ct.precedingText) || ENTRY_PATTERN.test(ct.precedingText)) {
      const category = categorizeByPosition(ct.logicalPage, ct.positionY, sectionPages);
      if (category) {
        categoryMap.set(idx, category);
      }
    }
  }

  // 第二遍：为续表溯源分配分类
  let newAccountCount = 0;
  let lastCategory: AccountCategory | null = null;
  for (let idx = 0; idx < tables.length; idx++) {
    const ct = tables[idx];
    // 跳过不在信贷交易明细范围内的表格（上界 + 下界）
    if (isBeforeCreditDetail(ct, sectionPages)) continue;
    if (isBeyondBoundary(ct, boundaryLp, boundaryY)) continue;
    // 判断是否为新条目：匹配 "账户N" 或 "账户"（无数字）或 "授信协议N"
    const isNewEntry = ACCOUNT_PATTERN.test(ct.precedingText) || ENTRY_PATTERN.test(ct.precedingText);

    let category: AccountCategory | null = null;

    if (isNewEntry) {
      category = categoryMap.get(idx) ?? null;
      newAccountCount++;
    } else {
      category = findSourceCategory(idx, tables, sectionPages);
      // 溯源失败时：先尝试用自身位置推断分类，再回退到前一张表
      if (!category) {
        category = categorizeByPosition(ct.logicalPage, ct.positionY, sectionPages);
      }
      if (!category && lastCategory) {
        category = lastCategory;
      }
    }

    if (category) {
      groups[category].push(ct);
      lastCategory = category;
    }
  }

  return groups;
}
