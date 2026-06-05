import { debugLog, debugWarn } from '../utils/debug-log';

/**
 * 页面重排器 — 根据页脚中的逻辑页码对乱序页面重新排序
 *
 * 征信报告每页脚注格式："第X页，共Y页" / "第X页/共Y页" / "第X页 共Y页"
 * 策略：
 * 1. 从每页文本中提取逻辑页码
 * 2. 按逻辑页码升序排列
 * 3. 无法提取页码的页面保持相对顺序，追加到末尾
 */

/** 页脚页码正则：匹配 "第X页" 后跟 "共Y页" */
const PAGE_NUMBER_PATTERN = /第(\d+)页[，,。./\s]*共(\d+)页/;

/** 从单页文本中提取逻辑页码，返回 null 表示未找到 */
export function extractPageNumber(pageText: string): number | null {
  const match = pageText.match(PAGE_NUMBER_PATTERN);
  return match ? parseInt(match[1], 10) : null;
}

/** 从单页文本中提取总页数，返回 null 表示未找到 */
export function extractTotalPages(pageText: string): number | null {
  const match = pageText.match(PAGE_NUMBER_PATTERN);
  return match ? parseInt(match[2], 10) : null;
}

/**
 * 对按物理顺序排列的页面文本数组进行重排
 * 返回按逻辑页码排序后的文本数组
 */
export function reorderPages(pages: string[]): string[] {
  if (pages.length <= 1) return pages;

  const withIndex = pages.map((text, physicalIdx) => ({
    text,
    physicalIdx,
    logicalPage: extractPageNumber(text),
  }));

  // 分为有页码和无页码两组
  const numbered = withIndex.filter((p) => p.logicalPage !== null);
  const unnumbered = withIndex.filter((p) => p.logicalPage === null);

  // 检查是否需要重排：有页码的页面不足一半，放弃重排
  if (numbered.length < pages.length / 2) {
    debugLog('[PageReorder] too few pages with page numbers, skipping reorder');
    return pages;
  }

  // 检查是否已经有序
  const isOrdered = numbered.every((p, i) => {
    if (i === 0) return true;
    return p.logicalPage! >= numbered[i - 1].logicalPage!;
  });

  if (isOrdered) {
    debugLog('[PageReorder] pages already in order');
    return pages;
  }

  // 按逻辑页码排序
  numbered.sort((a, b) => a.logicalPage! - b.logicalPage!);

  // 检测重复页码
  const seen = new Set<number>();
  for (const p of numbered) {
    if (seen.has(p.logicalPage!)) {
      debugWarn(`[PageReorder] duplicate logical page ${p.logicalPage}`);
    }
    seen.add(p.logicalPage!);
  }

  const reordered = [...numbered, ...unnumbered].map((p) => p.text);

  debugLog(
    '[PageReorder] reordered %d pages, physical→logical: %s',
    pages.length,
    numbered.map((p) => `${p.physicalIdx}→${p.logicalPage}`).join(', '),
  );

  return reordered;
}

/**
 * 对 DocParserResult 的 pages 数组进行重排
 * 利用每页 layouts 中的页脚文本提取逻辑页码
 */
export function reorderDocPages<T extends { layouts: Array<{ text: string; type: string; sub_type?: string }> }>(
  pages: T[],
): T[] {
  if (pages.length <= 1) return pages;

  const withIndex = pages.map((page, physicalIdx) => ({
    page,
    physicalIdx,
    logicalPage: extractLogicalPageFromLayouts(page.layouts),
  }));

  const numbered = withIndex.filter((p) => p.logicalPage !== null);
  const unnumbered = withIndex.filter((p) => p.logicalPage === null);

  if (numbered.length < pages.length / 2) {
    debugLog('[PageReorder] doc pages: too few with page numbers, skipping');
    return pages;
  }

  const isOrdered = numbered.every((p, i) => {
    if (i === 0) return true;
    return p.logicalPage! >= numbered[i - 1].logicalPage!;
  });

  if (isOrdered) {
    debugLog('[PageReorder] doc pages already in order');
    return pages;
  }

  numbered.sort((a, b) => a.logicalPage! - b.logicalPage!);

  debugLog(
    '[PageReorder] doc pages reordered: %s',
    numbered.map((p) => `phys${p.physicalIdx}→lp${p.logicalPage}`).join(', '),
  );

  return [...numbered, ...unnumbered].map((p) => p.page);
}

/** 从 layouts 数组中查找页脚文本并提取逻辑页码 */
function extractLogicalPageFromLayouts(
  layouts: Array<{ text: string; type: string; sub_type?: string }>,
): number | null {
  for (const layout of layouts) {
    const isFooter = layout.type === 'head_tail' || layout.sub_type === 'footer';
    const hasPageNum = PAGE_NUMBER_PATTERN.test(layout.text);
    if ((isFooter || hasPageNum) && hasPageNum) {
      return extractPageNumber(layout.text);
    }
  }
  // 兜底：扫描所有 layout 文本
  for (const layout of layouts) {
    const num = extractPageNumber(layout.text);
    if (num !== null) return num;
  }
  return null;
}
