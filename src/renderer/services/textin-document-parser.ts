import type { DocParserResult } from '../../shared/doc-parser-types';

/**
 * 通过主进程 IPC 调用 TextIn 文档解析。
 * 接收 PDF/图片 base64，返回统一的结构化文档解析结果。
 */
export async function parseDocument(
  fileBase64: string, fileName: string,
): Promise<DocParserResult> {
  return window.electron.parseDocument(fileBase64, fileName);
}
