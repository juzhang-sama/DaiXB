import * as pdfjsLib from 'pdfjs-dist';

const RENDER_SCALE = 2;

/**
 * 将 PDF 单页渲染为 base64 图片（不含 data:image 前缀）
 */
async function renderPageToBase64(
  page: pdfjsLib.PDFPageProxy,
): Promise<string> {
  const viewport = page.getViewport({ scale: RENDER_SCALE });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;

  // toDataURL 返回 "data:image/png;base64,xxxxx"，去掉前缀
  const dataUrl = canvas.toDataURL('image/png');
  return dataUrl.replace(/^data:image\/\w+;base64,/, '');
}

/**
 * 将 PDF 文件的所有页面转为 base64 图片数组
 */
export async function pdfToImages(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const images: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const base64 = await renderPageToBase64(page);
    images.push(base64);
  }

  return images;
}

