/**
 * 表格查找工具 — 从 RebuiltTable 中按标签定位对应数值
 *
 * 关键约束：
 * - 值行必须在标签行的列范围内（left 位置在标签区间内）
 * - 遇到区块边界标题立即停止扫描
 * - 最多向下扫描 5 行（征信报告值行紧邻标签行）
 */

import type { RebuiltTable, TableRow, TableCell } from './table-rebuilder';

/** 区块边界关键词 — 遇到这些就停止向下扫描 */
const BLOCK_BOUNDARIES = [
  '信息汇总', '账户信息', '信贷交易', '查询记录', '还款责任',
  '还款记录', '信息概要',
];

/** 在表格中查找包含指定标签的行，返回行索引，未找到返回 -1 */
export function findRowByLabel(
  table: RebuiltTable, label: string, startRow = 0,
): number {
  for (let i = startRow; i < table.rows.length; i++) {
    if (table.rows[i].cells.some((c) => c.text.includes(label))) return i;
  }
  return -1;
}

/**
 * 从标签行向下搜索数值行，按列位置匹配标签和值
 *
 * 1. 收集标签行中匹配标签的单元格 left 位置，计算列范围
 * 2. 向下扫描（最多 5 行），遇到区块边界停止
 * 3. 只收集 left 在标签列范围内的数值单元格
 * 4. 将数值按 left 位置与最近的标签配对
 */
export function matchLabelValues(
  table: RebuiltTable, labelRowIdx: number, labels: string[],
): Map<string, number> {
  const result = new Map<string, number>();
  if (labelRowIdx < 0 || labelRowIdx >= table.rows.length) return result;

  const labelPositions = findLabelPositions(table.rows[labelRowIdx], labels);
  if (labelPositions.length === 0) return result;

  const colRange = calcColumnRange(labelPositions);
  const maxScan = Math.min(labelRowIdx + 5, table.rows.length);
  const valueCells = collectValueCells(table, labelRowIdx + 1, maxScan, colRange);

  assignValuesByPosition(labelPositions, valueCells, result);
  return result;
}

interface LabelPos { label: string; left: number; }
interface ColRange { minLeft: number; maxLeft: number; }

/** 从行中找到匹配标签的单元格位置 */
function findLabelPositions(row: TableRow, labels: string[]): LabelPos[] {
  const positions: LabelPos[] = [];
  for (const cell of row.cells) {
    const matched = labels.find((l) => cell.text.includes(l));
    if (matched) {
      positions.push({ label: matched, left: cell.left });
    }
  }
  return positions;
}

/** 计算标签列的 left 范围，加 100px 容差 */
function calcColumnRange(positions: LabelPos[]): ColRange {
  const lefts = positions.map((p) => p.left);
  return {
    minLeft: Math.min(...lefts) - 100,
    maxLeft: Math.max(...lefts) + 100,
  };
}

/** 检查行是否包含区块边界关键词 */
function isBlockBoundary(row: TableRow): boolean {
  return row.cells.some((c) =>
    BLOCK_BOUNDARIES.some((kw) => c.text.includes(kw)),
  );
}

/**
 * 收集数值单元格：只收集标签列范围内的，遇到边界停止，跳过年份
 */
function collectValueCells(
  table: RebuiltTable, start: number, end: number, colRange: ColRange,
): TableCell[] {
  const cells: TableCell[] = [];
  for (let i = start; i < end; i++) {
    const row = table.rows[i];
    if (isBlockBoundary(row)) break;
    for (const cell of row.cells) {
      if (cell.left < colRange.minLeft || cell.left > colRange.maxLeft) continue;
      const cleaned = cell.text.trim().replace(/,/g, '');
      if (!/^[0-9]/.test(cleaned)) continue;
      const num = parseInt(cleaned, 10);
      if (num >= 2020 && num <= 2030) continue;
      cells.push(cell);
    }
  }
  return cells;
}

/** 按列位置将数值分配给最近的标签 */
function assignValuesByPosition(
  labelPositions: LabelPos[],
  valueCells: TableCell[],
  result: Map<string, number>,
): void {
  for (const cell of valueCells) {
    let bestLabel = '';
    let bestDist = Infinity;
    for (const lp of labelPositions) {
      const dist = Math.abs(cell.left - lp.left);
      if (dist < bestDist) {
        bestDist = dist;
        bestLabel = lp.label;
      }
    }
    if (bestLabel && !result.has(bestLabel)) {
      const cleaned = cell.text.trim().replace(/,/g, '');
      const num = parseFloat(cleaned);
      if (!isNaN(num)) result.set(bestLabel, num);
    }
  }
}

