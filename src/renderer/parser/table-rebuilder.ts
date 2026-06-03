/**
 * 表格重建层：将 OCR 带坐标的文字行重建为结构化行列
 *
 * 核心逻辑：
 * 1. 同行聚合 — top 坐标接近的文字归为同一行
 * 2. 列排序 — 同一行内按 left 坐标从左到右排列
 * 3. 跨页拼接 — 多页结果按页序合并，保持行列关系
 */

import type { OcrWord, OcrPageResult } from '../../shared/ocr-types';

/** 重建后的单个文本单元格 */
export interface TableCell {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  pageIndex: number;
}

/** 重建后的一行（包含多个单元格，按 left 排序） */
export interface TableRow {
  cells: TableCell[];
  /** 该行的平均 top 值 */
  avgTop: number;
  pageIndex: number;
}

/** 重建后的完整表格结构 */
export interface RebuiltTable {
  rows: TableRow[];
}

/**
 * 判断两个文字块是否属于同一行
 * 使用较小高度的一半作为容差阈值
 */
function isSameRow(a: OcrWord, b: OcrWord): boolean {
  const tolerance = Math.min(a.location.height, b.location.height) * 0.5;
  return Math.abs(a.location.top - b.location.top) <= tolerance;
}

/** 将单页 OCR 结果按 top 坐标聚合为行 */
function groupIntoRows(words: OcrWord[], pageIndex: number): TableRow[] {
  if (words.length === 0) return [];

  // 按 top 排序，top 相同按 left 排序
  const sorted = [...words].sort((a, b) => {
    const dy = a.location.top - b.location.top;
    return dy !== 0 ? dy : a.location.left - b.location.left;
  });

  const rows: TableRow[] = [];
  let currentGroup: OcrWord[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    if (isSameRow(currentGroup[0], sorted[i])) {
      currentGroup.push(sorted[i]);
    } else {
      rows.push(buildRow(currentGroup, pageIndex));
      currentGroup = [sorted[i]];
    }
  }
  rows.push(buildRow(currentGroup, pageIndex));

  return rows;
}

/** 从一组同行文字块构建 TableRow */
function buildRow(words: OcrWord[], pageIndex: number): TableRow {
  // 按 left 排序确保从左到右
  const sorted = words.sort((a, b) => a.location.left - b.location.left);
  const cells: TableCell[] = sorted.map((w) => ({
    text: w.words,
    left: w.location.left,
    top: w.location.top,
    width: w.location.width,
    height: w.location.height,
    pageIndex,
  }));

  const avgTop =
    words.reduce((sum, w) => sum + w.location.top, 0) / words.length;

  return { cells, avgTop, pageIndex };
}

/**
 * 将多页 OCR 结果重建为结构化表格
 * 各页行按页序拼接，保持全局行顺序
 */
export function rebuildTable(pages: OcrPageResult[]): RebuiltTable {
  const allRows: TableRow[] = [];

  for (const page of pages) {
    const pageRows = groupIntoRows(page.wordsResult, page.pageIndex);
    allRows.push(...pageRows);
  }

  return { rows: allRows };
}

/**
 * 将重建后的表格转为纯文本行（兼容现有解析器）
 * 每行内的单元格用 \t 分隔，保留列归属关系
 */
export function tableToText(table: RebuiltTable): string {
  return table.rows
    .map((row) => row.cells.map((c) => c.text).join('\t'))
    .join('\n');
}

/**
 * 将重建后的表格转为纯文本行（每个单元格独立一行）
 * 兼容现有 block-based 解析器的逐行匹配模式
 */
export function tableToLines(table: RebuiltTable): string {
  return table.rows
    .map((row) => row.cells.map((c) => c.text).join('\n'))
    .join('\n');
}

