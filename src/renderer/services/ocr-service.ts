import { DocParserResult } from '../../shared/doc-parser-types';
import { OcrResult } from '../types/client-profile';
import { parseCreditReport } from '../parser';
import { MIN_TEXT_LENGTH, isImageFile } from '../config/ocr-config';
import { parseDocument } from './textin-document-parser';
import { correctOcrText, correctDocResult } from '../parser/ocr-corrector';
import { reorderPages, reorderDocPages } from '../parser/page-reorder';
import { evaluateOcrQuality } from '../parser/ocr-quality';
import { DEBUG_ENABLED, debugLog } from '../utils/debug-log';
import { mergeDocParserResults } from './doc-parser-merge';
import { preprocessImage, type PreprocessOptions } from './image-preprocess';
import { evaluateImageQuality } from './image-quality';
import { validateCreditReportData } from './credit-report-validation';
import { normalizeCreditReportInstitutions } from './institution-normalizer';
import { pdfToImages } from './pdf-to-image';
import type {
  ImageQualityDiagnostic,
  InstitutionCorrectionDiagnostic,
  OcrCandidateDiagnostic,
  OcrDiagnosticsReport,
} from '../types/ocr-diagnostics';
import * as pdfjsLib from 'pdfjs-dist';

interface OcrDocumentResult {
  docResult: DocParserResult;
  candidates: OcrCandidateDiagnostic[];
}

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

function buildDiagnostics(
  report: import('../types/credit-report').CreditReport,
  images: ImageQualityDiagnostic[] = [],
  candidates: OcrCandidateDiagnostic[] = [],
  institutionCorrections: InstitutionCorrectionDiagnostic[] = [],
): OcrDiagnosticsReport {
  return {
    images,
    candidates,
    institutionCorrections,
    validation: validateCreditReportData(report),
  };
}

function logQuality(quality: ReturnType<typeof evaluateOcrQuality> | undefined): void {
  if (!quality) return;
  debugLog('[OCRQuality]', JSON.stringify({
    profile: quality.profile,
    score: quality.score,
    pages: quality.pages,
    tables: quality.tables.count,
    anchors: `${quality.anchors.found}/${quality.anchors.required}`,
    issues: quality.issues,
  }));
}

/**
 * 解析征信报告（自动选择路径）
 * 路径 A：电子版 PDF → 文本直提 → 解析引擎
 * 路径 B：扫描件 PDF/图片 → TextIn 文档解析 API → 结构化数据 → 解析引擎
 */
export async function analyzeCreditReport(file: File): Promise<OcrResult> {
  return analyzeSingleCreditReport(file);
}

export async function analyzeCreditReportFiles(files: File[]): Promise<OcrResult> {
  const validFiles = files.filter(Boolean);
  if (validFiles.length === 0) {
    throw new Error('No files selected');
  }

  if (validFiles.length === 1) {
    return analyzeSingleCreditReport(validFiles[0]);
  }

  if (!validFiles.every(isImageFile)) {
    throw new Error('Multiple-file OCR only supports image files');
  }

  return analyzeImageSetCreditReport(validFiles);
}

async function analyzeSingleCreditReport(file: File): Promise<OcrResult> {
  const image = isImageFile(file);
  let fullText = '';
  let docResult: DocParserResult | undefined;
  const imageDiagnostics: ImageQualityDiagnostic[] = [];
  let candidateDiagnostics: OcrCandidateDiagnostic[] = [];

  if (image) {
    // 图片 → 直接走 OCR，无 pdfjs 文本层
    debugLog('[DocParser] image file detected, using document parser...');
    const imageQuality = await evaluateImageQuality(file);
    imageDiagnostics.push(imageQuality);
    const result = await analyzeImageViaOcrCandidates(file, imageQuality);
    docResult = result.docResult;
    candidateDiagnostics = result.candidates;
    fullText = extractTextFromDocParser(docResult);
    fullText = correctOcrText(fullText);
  } else {
    // PDF → 先尝试文本直提，不足则走 OCR
    fullText = await extractTextFromPdf(file);
    const isScanned = fullText.trim().length < MIN_TEXT_LENGTH;

    if (isScanned) {
      debugLog('[DocParser] scanned pdf detected, using document parser...');
      const result = await analyzeScannedPdfViaOcrCandidates(file);
      docResult = result.docResult;
      candidateDiagnostics = result.candidates;
      fullText = extractTextFromDocParser(docResult);
      fullText = correctOcrText(fullText);
    }
  }

  const quality = docResult ? evaluateOcrQuality(docResult) : undefined;
  logQuality(quality);

  const { profile, confidence, report: parsedReport, debugBlockMap } = parseCreditReport(fullText, undefined, docResult);
  const { report, corrections } = normalizeCreditReportInstitutions(parsedReport);
  if (DEBUG_ENABLED && debugBlockMap) {
    debugLog('[Debug] blockMap.level1:', JSON.stringify(debugBlockMap.level1));
    debugLog('[Debug] blockMap.level2:', JSON.stringify(debugBlockMap.level2));
    debugLog('[Debug] blockMap.accounts count:', debugBlockMap.accounts?.length);
  }
  return {
    profile,
    confidence,
    report,
    quality,
    diagnostics: buildDiagnostics(report, imageDiagnostics, candidateDiagnostics, corrections),
  };
}

/** 通过 OCR API 解析文件，返回结构化结果 */
async function analyzeImageSetCreditReport(files: File[]): Promise<OcrResult> {
  debugLog('[DocParser] multi-image document detected, pages:', files.length);
  const imageDiagnostics: ImageQualityDiagnostic[] = [];
  for (const file of files) {
    imageDiagnostics.push(await evaluateImageQuality(file));
  }
  const imageResult = await analyzeMultiImageViaOcr(files, imageDiagnostics);
  const { docResult } = imageResult;
  let fullText = extractTextFromDocParser(docResult);
  fullText = correctOcrText(fullText);

  const quality = evaluateOcrQuality(docResult);
  logQuality(quality);

  const { profile, confidence, report: parsedReport, debugBlockMap } = parseCreditReport(fullText, undefined, docResult);
  const { report, corrections } = normalizeCreditReportInstitutions(parsedReport);
  if (DEBUG_ENABLED && debugBlockMap) {
    debugLog('[Debug] blockMap.level1:', JSON.stringify(debugBlockMap.level1));
    debugLog('[Debug] blockMap.level2:', JSON.stringify(debugBlockMap.level2));
    debugLog('[Debug] blockMap.accounts count:', debugBlockMap.accounts?.length);
  }
  return {
    profile,
    confidence,
    report,
    quality,
    diagnostics: buildDiagnostics(report, imageDiagnostics, imageResult.candidates, corrections),
  };
}

async function analyzeViaOcr(file: File): Promise<DocParserResult> {
  return normalizeOcrDocResult(await parseViaOcr(file));
}

async function analyzeImageViaOcrCandidates(
  file: File,
  imageQuality?: ImageQualityDiagnostic,
): Promise<OcrDocumentResult> {
  const originalBase64 = await fileToBase64(file);
  return analyzeBase64ViaOcrCandidates(file.name, originalBase64, imageQuality);
}

async function analyzeBase64ViaOcrCandidates(
  fileName: string,
  originalBase64: string,
  imageQuality?: ImageQualityDiagnostic,
): Promise<OcrDocumentResult> {
  const candidates: Array<{ variant: string; base64: string }> = [
    { variant: '原图', base64: originalBase64 },
  ];

  const original = await parseBase64Candidate(fileName, candidates[0]);
  let parsed = [original];

  if (shouldTryEnhancedCandidates(original.quality.score, imageQuality)) {
    const enhanced = await buildPreprocessCandidates(originalBase64);
    for (const candidate of enhanced) {
      try {
        parsed.push(await parseBase64Candidate(fileName, candidate));
      } catch (err) {
        debugLog(`[DocParser] OCR candidate skipped: ${fileName} ${candidate.variant}`, err);
      }
    }
  }

  const best = parsed.reduce((winner, item) =>
    rankCandidate(item.quality) > rankCandidate(winner.quality) ? item : winner,
  );

  const diagnostics = parsed.map((item) => ({
    fileName,
    variant: item.variant,
    selected: item === best,
    score: item.quality.score,
    tables: item.quality.tables.count,
    anchorsFound: item.quality.anchors.found,
    issues: item.quality.issues,
  }));

  return {
    docResult: best.docResult,
    candidates: diagnostics,
  };
}

async function analyzeScannedPdfViaOcrCandidates(file: File): Promise<OcrDocumentResult> {
  const original = await analyzeViaOcr(file);
  const originalQuality = evaluateOcrQuality(original);
  const originalDiagnostic: OcrCandidateDiagnostic = {
    fileName: file.name,
    variant: '原始PDF',
    selected: true,
    score: originalQuality.score,
    tables: originalQuality.tables.count,
    anchorsFound: originalQuality.anchors.found,
    issues: originalQuality.issues,
  };

  if (!shouldTryEnhancedCandidates(originalQuality.score)) {
    return { docResult: original, candidates: [originalDiagnostic] };
  }

  try {
    const pageImages = await pdfToImages(file);
    const pageResults: DocParserResult[] = [];
    const pageCandidates: OcrCandidateDiagnostic[] = [];
    for (let i = 0; i < pageImages.length; i++) {
      const result = await analyzeBase64ViaOcrCandidates(`${file.name}#第${i + 1}页`, pageImages[i]);
      pageResults.push(result.docResult);
      pageCandidates.push(...result.candidates);
    }

    const rendered = normalizeOcrDocResult(mergeDocParserResults(pageResults, `${file.name}#逐页渲染`));
    const renderedQuality = evaluateOcrQuality(rendered);
    const renderedDiagnostic: OcrCandidateDiagnostic = {
      fileName: file.name,
      variant: 'PDF逐页渲染',
      selected: false,
      score: renderedQuality.score,
      tables: renderedQuality.tables.count,
      anchorsFound: renderedQuality.anchors.found,
      issues: renderedQuality.issues,
    };

    const useRendered = rankCandidate(renderedQuality) > rankCandidate(originalQuality);
    originalDiagnostic.selected = !useRendered;
    renderedDiagnostic.selected = useRendered;

    return {
      docResult: useRendered ? rendered : original,
      candidates: [originalDiagnostic, renderedDiagnostic, ...pageCandidates],
    };
  } catch (err) {
    debugLog('[DocParser] scanned pdf rendered candidates failed, using original pdf OCR', err);
    return { docResult: original, candidates: [originalDiagnostic] };
  }
}

async function analyzeMultiImageViaOcr(
  files: File[],
  imageDiagnostics: ImageQualityDiagnostic[],
): Promise<OcrDocumentResult> {
  const results: DocParserResult[] = [];
  const candidates: OcrCandidateDiagnostic[] = [];
  for (let i = 0; i < files.length; i++) {
    debugLog(`[DocParser] OCR image ${i + 1}/${files.length}:`, files[i].name);
    const result = await analyzeImageViaOcrCandidates(files[i], imageDiagnostics[i]);
    results.push(result.docResult);
    candidates.push(...result.candidates);
  }

  return {
    docResult: normalizeOcrDocResult(mergeDocParserResults(results, buildMultiImageFileName(files))),
    candidates,
  };
}

async function parseBase64Candidate(
  fileName: string,
  candidate: { variant: string; base64: string },
): Promise<{ variant: string; docResult: DocParserResult; quality: ReturnType<typeof evaluateOcrQuality> }> {
  const docResult = normalizeOcrDocResult(
    await parseDocument(candidate.base64, `${fileName}#${candidate.variant}`),
  );
  return {
    variant: candidate.variant,
    docResult,
    quality: evaluateOcrQuality(docResult),
  };
}

async function buildPreprocessCandidates(
  base64: string,
): Promise<Array<{ variant: string; base64: string }>> {
  const variants: Array<{ variant: string; options: Partial<PreprocessOptions> }> = [
    { variant: '增强对比', options: { contrast: 1.35, binaryThreshold: 175, denoise: false } },
    { variant: '轻二值化', options: { contrast: 1.55, binaryThreshold: 155, denoise: true } },
    { variant: '自适应二值化', options: { contrast: 1.45, adaptiveThreshold: true, denoise: true } },
  ];
  const results: Array<{ variant: string; base64: string }> = [];

  for (const variant of variants) {
    try {
      results.push({
        variant: variant.variant,
        base64: await preprocessImage(base64, variant.options),
      });
    } catch (err) {
      debugLog(`[ImagePreprocess] ${variant.variant} failed`, err);
    }
  }

  return results;
}

function shouldTryEnhancedCandidates(
  originalScore: number,
  imageQuality?: ImageQualityDiagnostic,
): boolean {
  if (imageQuality && (imageQuality.score < 0.86 || imageQuality.issues.length > 0)) return true;
  return originalScore < 0.86;
}

function rankCandidate(quality: ReturnType<typeof evaluateOcrQuality>): number {
  return quality.score * 100
    + quality.tables.count * 1.2
    + quality.anchors.found * 0.7
    + quality.scope.recognizedModules.length * 1.5
    - quality.issues.length * 1.8;
}

async function parseViaOcr(file: File): Promise<DocParserResult> {
  const base64 = await fileToBase64(file);
  const docResult = await parseDocument(base64, file.name || 'document');
  debugLog('[DocParser] pages count:', docResult.pages?.length ?? 'undefined');
  return docResult;
}

function normalizeOcrDocResult(docResult: DocParserResult): DocParserResult {
  // 页面重排：根据页脚逻辑页码修正乱序，并更新 page_num
  docResult.pages = reorderDocPages(docResult.pages);
  docResult.pages.forEach((p, i) => { p.page_num = i; });

  correctDocResult(docResult);
  debugLog('[OcrCorrector] docResult corrected');

  if (DEBUG_ENABLED) debugPageStructure(docResult);
  return docResult;
}

function buildMultiImageFileName(files: File[]): string {
  const first = files[0]?.name?.replace(/\.[^.]+$/, '') || 'multi-image-credit-report';
  return `${first}_等${files.length}张图片`;
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
