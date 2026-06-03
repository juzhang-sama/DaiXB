/**
 * 报告头解析器 — 从 REPORT_HEADER 区块提取报告基本信息
 *
 * OCR 文本特征（多列表格线性化）：
 * - 标签区先出现（被查询者姓名/证件类型/证件号码/查询机构/查询原因/编号/数据发生机构名称）
 * - 值区后出现（王占军/身份证/120109199005227+011/本人/本人查询...）
 * - 身份证号可能被 OCR 拆成两行，需要拼接
 */

import { ReportHeader } from '../../types/credit-report';
import type { ContextTable } from '../doc-table-bridge';

const HEADER_LABELS = [
  '被查询者', '证件类型', '证件号码', '查询机构', '查询原因',
  '编号', '数据发生机构', '报告编号', '报告时间',
];

/** 判断是否为表头标签行 */
function isLabelLine(text: string): boolean {
  return HEADER_LABELS.some((l) => text.includes(l));
}

/** 从报告头区块文本行提取 ReportHeader */
export function parseHeader(lines: string[], docTables?: ContextTable[]): ReportHeader {
  const header: ReportHeader = {
    reportNo: '', reportTime: '', name: '',
    certType: '', certNo: '', queryOrg: '', queryReason: '',
  };

  // 优先：DocParser 模式
  if (docTables?.length) {
    const result = parseHeaderFromDoc(docTables, header);
    if (result) return result;
  }

  extractReportMeta(lines, header);
  extractQueryBlock(lines, header);
  return header;
}

/**
 * DocParser 模式：从报告头表格直接按列取值
 *
 * 表格结构：
 * headers: [报告编号：xxx, ..., 报告时间：xxx, ...]
 * row[0]:  [被查询者姓名, 被查询者证件类型, 被查询者证件号码, 查询机构, 查询原因]
 * row[1]:  [王占军, 身份证, 120109199005227\n011, 本人, 本人查询(...)]
 */
function parseHeaderFromDoc(
  docTables: ContextTable[], header: ReportHeader,
): ReportHeader | null {
  // 桶内已是报告头表格，直接取第一张
  const ct = docTables[0];
  if (!ct) return null;

  const t = ct.table;
  if (t.rows.length < 2) return null;

  // 从 headers 提取报告编号和时间
  for (const h of t.headers) {
    const noMatch = h.match(/报告编号[：:]\s*(.+)/);
    if (noMatch) header.reportNo = noMatch[1].trim();
    const timeMatch = h.match(/报告时间[：:]\s*(.+)/);
    if (timeMatch) header.reportTime = timeMatch[1].trim();
  }

  // row[0] 是标签行，row[1] 是值行，按列索引取值
  const labels = t.rows[0];
  const values = t.rows[1];
  for (let i = 0; i < labels.length && i < values.length; i++) {
    const label = labels[i];
    const val = values[i]?.trim();
    if (!val) continue;
    if (label.includes('姓名')) header.name = val;
    else if (label.includes('证件类型')) header.certType = val;
    else if (label.includes('证件号码')) header.certNo = cleanCertNo(val);
    else if (label.includes('查询机构')) header.queryOrg = val;
    else if (label.includes('查询原因')) header.queryReason = val;
  }

  return header.name ? header : null;
}

/** 清理身份证号中的 OCR 噪声（\n、空格等） */
function cleanCertNo(raw: string): string {
  const digits = raw.replace(/\\n/g, '').replace(/\n/g, '').replace(/\s/g, '');
  return digits.length >= 17 ? digits.substring(0, 18) : digits;
}

/** 提取报告编号和报告时间 */
function extractReportMeta(lines: string[], header: ReportHeader): void {
  for (const raw of lines) {
    const line = raw.trim();
    const noMatch = line.match(/报告编号[：:]\s*(.+)/);
    if (noMatch) header.reportNo = noMatch[1].trim();
    const timeMatch = line.match(/报告时间[：:]\s*(.+)/);
    if (timeMatch) header.reportTime = timeMatch[1].trim();
  }
}

/**
 * 提取姓名/证件类型/证件号码/查询机构/查询原因
 *
 * 策略：找到"被查询者姓名"后，先跳过所有标签行，
 * 然后按顺序消费值行：姓名 → 证件类型 → 身份证号(拼接) → 查询机构 → 查询原因
 */
function extractQueryBlock(lines: string[], header: ReportHeader): void {
  const startIdx = lines.findIndex((l) => /被查询者姓名/.test(l));
  if (startIdx < 0) return;

  // 找到值区起始：第一个非标签、非空行
  let valStart = startIdx + 1;
  for (; valStart < lines.length; valStart++) {
    const t = lines[valStart].trim();
    if (t && !isLabelLine(t)) break;
  }
  if (valStart >= lines.length) return;

  // 按顺序消费值行
  const values = collectValueLines(lines, valStart, 15);
  assignHeaderValues(values, header);
}

/** 从起始位置收集非标签值行（最多 maxCount 个） */
function collectValueLines(
  lines: string[], start: number, maxCount: number,
): string[] {
  const vals: string[] = [];
  for (let i = start; i < lines.length && vals.length < maxCount; i++) {
    const t = lines[i].trim();
    if (!t || isLabelLine(t)) continue;
    vals.push(t);
  }
  return vals;
}

/** 将收集到的值按顺序赋给 header 字段 */
function assignHeaderValues(values: string[], header: ReportHeader): void {
  // 值顺序：姓名(2-4汉字), 身份证, 数字段..., 本人, 本人查询(...)
  let idx = 0;

  // 姓名：2-4个汉字
  if (idx < values.length && /^[\u4e00-\u9fa5]{2,4}$/.test(values[idx])) {
    header.name = values[idx++];
  }

  // 证件类型：短汉字（身份证/护照等）
  if (idx < values.length && /^[\u4e00-\u9fa5]{2,4}$/.test(values[idx])) {
    header.certType = values[idx++];
  }

  // 身份证号：拼接连续数字行，或从含 \n 的 OCR 值中提取纯数字
  let digits = '';
  while (idx < values.length) {
    const cleaned = values[idx].replace(/\\n/g, '').replace(/\n/g, '');
    if (/^\d+$/.test(cleaned)) {
      digits += cleaned;
      idx++;
    } else {
      break;
    }
  }
  if (digits.length >= 17) header.certNo = digits.substring(0, 18);

  // 查询机构 + 查询原因
  if (idx < values.length) header.queryOrg = values[idx++];
  if (idx < values.length) header.queryReason = values[idx++];
}

