import { DocParserResult } from '../../shared/doc-parser-types';
import { OcrResult } from '../types/client-profile';
import { parseCreditReport } from '../parser';
import { MIN_TEXT_LENGTH, isImageFile } from '../config/ocr-config';
import { parseDocument } from './baidu-ocr';
import { correctOcrText, correctDocResult } from '../parser/ocr-corrector';
import { reorderPages, reorderDocPages } from '../parser/page-reorder';
import { DEBUG_ENABLED, debugLog } from '../utils/debug-log';
import * as pdfjsLib from 'pdfjs-dist';

/**
 * 从电子版 PDF 直接提取文本层
 * 准确率远高于 OCR，优先使用
 */
async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pages.push(text);
  }

  // 页面重排：根据页脚逻辑页码修正乱序
  const ordered = reorderPages(pages);
  return ordered.join('\n');
}

/** 将 File 转为 base64 字符串（不含 data: 前缀） */
async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * 从文档解析结果中提取全文文本
 * 表格区域提取为纯文本行（每个唯一单元格值一行），保持与旧 OCR 行模式兼容
 */
function extractTextFromDocParser(result: DocParserResult): string {
  const pageTexts: string[] = [];

  for (const page of result.pages) {
    const parts: string[] = [];
    for (const layout of page.layouts) {
      if (layout.type === 'table') {
        const table = page.tables.find((t) => t.layout_id === layout.layout_id);
        if (table?.markdown) {
          parts.push(markdownTableToPlainLines(table.markdown));
        }
      } else if (layout.text) {
        // layout.text 也可能内嵌 Markdown 表格，需要检测并转换
        parts.push(convertTextWithTables(layout.text));
      }
    }
    pageTexts.push(parts.join('\n'));
  }

  return pageTexts.join('\n');
}

/** 检测文本中是否包含 Markdown 表格行，有则转为纯文本 */
function convertTextWithTables(text: string): string {
  if (!text.includes('|')) return text;

  const lines = text.split('\n');
  const result: string[] = [];
  let tableBlock: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      tableBlock.push(line);
    } else {
      if (tableBlock.length > 0) {
        result.push(markdownTableToPlainLines(tableBlock.join('\n')));
        tableBlock = [];
      }
      if (trimmed) result.push(trimmed);
    }
  }
  if (tableBlock.length > 0) {
    result.push(markdownTableToPlainLines(tableBlock.join('\n')));
  }

  return result.join('\n');
}

/** 将 Markdown 表格转为纯文本行：提取每行每列的唯一值，每个值一行 */
function markdownTableToPlainLines(markdown: string): string {
  const lines = markdown.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || /^\|[\s\-:|]+\|$/.test(trimmed)) continue;

    const cells = trimmed.slice(1, -1).split('|').map((c) => c.trim());
    // 去重：征信报告表格常有合并单元格导致同一值重复多列
    const seen = new Set<string>();
    for (const cell of cells) {
      if (!cell || seen.has(cell)) continue;
      seen.add(cell);
      result.push(cell);
    }
  }

  return result.join('\n');
}

/**
 * 解析征信报告（自动选择路径）
 * 路径 A：电子版 PDF → 文本直提 → 解析引擎
 * 路径 B：扫描件 PDF → 百度文档解析 API → 结构化数据 → 解析引擎
 */
export async function analyzeCreditReport(file: File): Promise<OcrResult> {
  const image = isImageFile(file);
  let fullText = '';
  let docResult: DocParserResult | undefined;

  if (image) {
    // 图片 → 直接走 OCR，无 pdfjs 文本层
    debugLog('[DocParser] image file detected, using document parser...');
    docResult = await analyzeViaOcr(file);
    fullText = extractTextFromDocParser(docResult);
    fullText = correctOcrText(fullText);
  } else {
    // PDF → 先尝试文本直提，不足则走 OCR
    fullText = await extractTextFromPdf(file);
    const isScanned = fullText.trim().length < MIN_TEXT_LENGTH;

    if (isScanned) {
      debugLog('[DocParser] scanned pdf detected, using document parser...');
      docResult = await analyzeViaOcr(file);
      fullText = extractTextFromDocParser(docResult);
      fullText = correctOcrText(fullText);
    }
  }

  const { profile, confidence, report, debugBlockMap } = parseCreditReport(fullText, undefined, docResult);
  if (DEBUG_ENABLED && debugBlockMap) {
    debugLog('[Debug] blockMap.level1:', JSON.stringify(debugBlockMap.level1));
    debugLog('[Debug] blockMap.level2:', JSON.stringify(debugBlockMap.level2));
    debugLog('[Debug] blockMap.accounts count:', debugBlockMap.accounts?.length);
  }
  return { profile, confidence, report };
}

/** 通过 OCR API 解析文件，返回结构化结果 */
async function analyzeViaOcr(file: File): Promise<DocParserResult> {
  const base64 = await fileToBase64(file);
  const docResult = await parseDocument(base64, file.name || 'document');
  debugLog('[DocParser] pages count:', docResult.pages?.length ?? 'undefined');

  // 页面重排：根据页脚逻辑页码修正乱序，并更新 page_num
  docResult.pages = reorderDocPages(docResult.pages);
  docResult.pages.forEach((p, i) => { p.page_num = i; });

  correctDocResult(docResult);
  debugLog('[OcrCorrector] docResult corrected');

  if (DEBUG_ENABLED) debugPageStructure(docResult);
  return docResult;
}

/**
 * 调试：打印页面结构信息
 * - 页脚内容（验证逻辑页码 vs 物理页码）
 * - 章节标题的 position.x 和 page_num（验证左右栏）
 */
function debugPageStructure(doc: DocParserResult): void {
  debugLog('\n========== [Debug] 页面结构分析 ==========');

  // 打印所有物理页码，检查是否有遗漏
  const pageNums = doc.pages.map((p) => p.page_num);
  debugLog(`[Debug] 物理页码列表 (共${doc.pages.length}页):`, pageNums.join(', '));

  // 打印物理页 → 逻辑页对照表（从页脚提取）
  const pageFooterPattern = /第(\d+)页[，,。./\s]*共(\d+)页/;
  const pageMapping: string[] = [];
  for (const page of doc.pages) {
    let footerText = '';
    for (const l of page.layouts) {
      if (pageFooterPattern.test(l.text ?? '')) {
        footerText = l.text!;
        break;
      }
      if (l.type === 'head_tail') {
        footerText = footerText || l.text || '';
      }
    }
    const m = footerText.match(pageFooterPattern);
    const lp = m ? `逻辑页${m[1]}/${m[2]}` : `无页脚(${footerText.slice(0, 20)})`;
    pageMapping.push(`物理${page.page_num}→${lp}`);
  }
  debugLog(`[Debug] 页码对照:`, pageMapping.join(' | '));

  // 打印前两页的全部 layouts（用于排查页脚识别问题）
  for (const page of doc.pages.slice(0, 2)) {
    const pn = page.page_num;
    debugLog(`[Debug] --- 物理页${pn} layouts(${page.layouts.length}) ---`);
    for (let i = 0; i < page.layouts.length; i++) {
      const l = page.layouts[i];
      const sub = l.sub_type ? ` sub=${l.sub_type}` : '';
      debugLog(
        `[Debug] 页${pn} [${i}] type=${l.type}${sub} x=${l.position[0]} y=${l.position[1]} text="${l.text?.slice(0, 80) ?? ''}"`,
      );
    }
  }

  const sectionKeywords = ['非循环贷账户', '循环贷账户一', '循环贷账户二', '贷记卡账户', '四查询记录', '四 查询记录'];
  const accountPattern = /^账户\d+/;

  for (const page of doc.pages) {
    const pageWidth = page.meta?.page_width ?? 0;
    const midX = pageWidth / 2;

    // 找页脚
    const footers = page.layouts.filter(
      (l) => l.type === 'head_tail' && (l.sub_type === 'footer' || /第\d+页/.test(l.text))
    );
    for (const f of footers) {
      const side = f.position[0] < midX ? '左栏' : '右栏';
        debugLog(`[Footer] 物理页${page.page_num} ${side} x=${f.position[0]}: "${f.text}"`);
    }

    // 找章节标题
    for (const layout of page.layouts) {
      const text = layout.text?.trim() ?? '';
      const isSection = sectionKeywords.some((kw) => text.includes(kw));
      const isAccount = accountPattern.test(text);

      if (isSection || isAccount) {
        const side = layout.position[0] < midX ? '左栏' : '右栏';
        debugLog(`[Section] 物理页${page.page_num} ${side} x=${layout.position[0]}: "${text}"`);
      }
    }
  }

  debugLog('========== [Debug] 页面结构分析结束 ==========\n');
}
