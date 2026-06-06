/** TextIn 文档解析适配层返回的统一结构化类型 */

/** 单个表格单元格 */
export interface DocCell {
  layout_id: string;
  text: string;
  position: [number, number, number, number]; // [x, y, w, h]
  type: string;
  sub_type: string;
}

/** 单个表格 */
export interface DocTable {
  layout_id: string;
  markdown: string;
  position: [number, number, number, number];
  cells: DocCell[];
  /** 二维数组，值为 cells 索引 */
  matrix: number[][];
  /** 跨页表格标记：begin / inner / end / 空 */
  merge_table: string;
}

/** 版面元素 */
export interface DocLayout {
  layout_id: string;
  text: string;
  position: [number, number, number, number];
  type: 'para' | 'table' | 'head_tail' | 'image' | 'contents' | 'seal' | 'title' | 'formula';
  sub_type: string;
  parent: string;
  children: string[];
}

/** 页面元信息 */
export interface DocPageMeta {
  page_width: number;
  page_height: number;
  is_scan: boolean;
  page_angle: number;
  page_type: string;
}

/** 单页解析结果 */
export interface DocPage {
  page_id: string;
  page_num: number;
  text: string;
  layouts: DocLayout[];
  tables: DocTable[];
  images: unknown[];
  meta: DocPageMeta;
}

/** 文档解析完整结果 */
export interface DocParserResult {
  file_name: string;
  file_id: string;
  pages: DocPage[];
}
