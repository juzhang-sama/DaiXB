/** 百度文档解析 API 返回的结构化类型 */

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

/** 提交任务的响应 */
export interface DocParserSubmitResponse {
  error_code: number;
  error_msg: string;
  log_id: string;
  result: { task_id: string } | null;
}

/** 查询任务的响应 */
export interface DocParserQueryResponse {
  error_code: number;
  error_msg: string;
  log_id: string;
  result: {
    task_id: string;
    status: 'pending' | 'processing' | 'success' | 'failed';
    task_error: string | null;
    duration?: number;
    markdown_url?: string;
    parse_result_url?: string;
  } | null;
}

