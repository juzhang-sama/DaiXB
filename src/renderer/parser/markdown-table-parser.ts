/**
 * Markdown 表格解析器 — 将文档解析 API 返回的 Markdown 表格转为二维数组
 *
 * 征信报告中的表格由文档解析适配层以 Markdown 格式返回，
 * 本模块将其解析为 string[][] 供各 block parser 按行列索引取值
 */

/** 单个已解析的表格 */
export interface ParsedTable {
  /** 表头行（第一行） */
  headers: string[];
  /** 数据行（不含表头和分隔行） */
  rows: string[][];
}

/**
 * 解析单个 Markdown 表格字符串为结构化数据
 * 输入格式：| col1 | col2 | ... |\n| --- | --- | ... |\n| val1 | val2 | ... |
 */
export function parseMarkdownTable(markdown: string): ParsedTable {
  const lines = markdown.split('\n').filter((l) => l.trim().length > 0);
  const result: string[][] = [];

  for (const line of lines) {
    if (isSeparatorLine(line)) continue;
    const cells = splitTableRow(line);
    if (cells.length > 0) {
      result.push(cells);
    }
  }

  if (result.length === 0) {
    return { headers: [], rows: [] };
  }

  return { headers: result[0], rows: result.slice(1) };
}

/** 判断是否为分隔行（| --- | --- |） */
function isSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  return /^\|[\s\-:|]+\|$/.test(trimmed);
}

/** 将 Markdown 表格行拆分为单元格数组 */
function splitTableRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return [];

  // 去掉首尾的 |，按 | 分割，trim 每个单元格
  const inner = trimmed.slice(1, -1);
  return inner.split('|').map((cell) => cell.trim());
}

/**
 * 在已解析的表格中按表头名查找某列的所有值
 * 返回该列所有数据行的值数组
 */
export function getColumnValues(table: ParsedTable, headerName: string): string[] {
  const idx = table.headers.findIndex((h) => h.includes(headerName));
  if (idx < 0) return [];
  return table.rows.map((row) => row[idx] ?? '');
}

/**
 * 在已解析的表格中按行标签（第一列）查找某行的所有值
 * 返回该行除第一列外的所有值
 */
export function getRowValues(table: ParsedTable, labelKeyword: string): string[] {
  for (const row of table.rows) {
    if (row.length > 0 && row[0].includes(labelKeyword)) {
      return row.slice(1);
    }
  }
  return [];
}

/**
 * 文档解析表格专用：找到包含标签关键词的行，返回下一行同列的值
 *
 * 常见表格结构：headers=类别标题(重复), row[0]=字段标签, row[1]=值
 * 例如：headers=['非循环贷账户信息汇总', ...], row[0]=['管理机构数','账户数',...], row[1]=['2','2',...]
 */
export function getValuesBelow(table: ParsedTable, labelKeyword: string): string[] {
  // 先在 headers 中找
  if (table.headers.some((h) => h.includes(labelKeyword))) {
    return table.rows[0] ?? [];
  }
  // 再在 rows 中找
  for (let i = 0; i < table.rows.length; i++) {
    const row = table.rows[i];
    if (row.some((cell) => cell.includes(labelKeyword))) {
      return table.rows[i + 1] ?? [];
    }
  }
  return [];
}

/**
 * 文档解析表格专用：按列标签取值
 *
 * 遍历 headers 和所有 rows，找到包含 colLabel 的行作为标签行，
 * 下一行为值行，返回对应列的值。
 * 支持两行表头结构（headers=类别标题, row[0]=字段标签, row[1]=值）
 */
export function getValueByCol(
  table: ParsedTable, colLabel: string,
): string | undefined {
  const allRows = [table.headers, ...table.rows];

  for (let i = 0; i < allRows.length; i++) {
    const colIdx = allRows[i].findIndex((cell) => cell.includes(colLabel));
    if (colIdx < 0) continue;
    const valueRow = allRows[i + 1];
    return valueRow?.[colIdx];
  }
  return undefined;
}

/**
 * 在已解析的表格中按行标签和列标签查找单个值
 */
export function getCellValue(
  table: ParsedTable, rowLabel: string, colLabel: string,
): string | undefined {
  const colIdx = table.headers.findIndex((h) => h.includes(colLabel));
  if (colIdx < 0) return undefined;

  for (const row of table.rows) {
    if (row.length > 0 && row[0].includes(rowLabel)) {
      return row[colIdx];
    }
  }
  return undefined;
}
