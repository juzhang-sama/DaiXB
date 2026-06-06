import type { ImageQualityDiagnostic } from '../types/ocr-diagnostics';

const MIN_SHORT_SIDE = 1200;
const MIN_MEGAPIXELS = 1.5;
const GOOD_SHARPNESS = 95;
const ACCEPTABLE_SHARPNESS = 55;
const SAMPLE_SIZE = 900;

export async function evaluateImageQuality(file: File): Promise<ImageQualityDiagnostic> {
  const image = await loadImage(file);
  const { width, height } = image;
  const megapixels = (width * height) / 1_000_000;
  const sharpness = measureSharpness(image);
  const issues: string[] = [];

  if (Math.min(width, height) < MIN_SHORT_SIDE) {
    issues.push(`图片短边 ${Math.min(width, height)}px，建议至少 ${MIN_SHORT_SIDE}px`);
  }
  if (megapixels < MIN_MEGAPIXELS) {
    issues.push(`图片约 ${megapixels.toFixed(2)}MP，建议使用更高清截图或扫描件`);
  }
  if (sharpness < ACCEPTABLE_SHARPNESS) {
    issues.push('图片清晰度偏低，可能存在压缩、失焦或抖动');
  } else if (sharpness < GOOD_SHARPNESS) {
    issues.push('图片清晰度一般，关键金额字段建议复核');
  }

  let score = 1;
  if (Math.min(width, height) < MIN_SHORT_SIDE) score -= 0.22;
  if (megapixels < MIN_MEGAPIXELS) score -= 0.18;
  if (sharpness < ACCEPTABLE_SHARPNESS) score -= 0.25;
  else if (sharpness < GOOD_SHARPNESS) score -= 0.1;

  return {
    fileName: file.name,
    width,
    height,
    megapixels: round(megapixels),
    sharpness: Math.round(sharpness),
    score: Math.max(0, Math.min(1, round(score))),
    issues,
  };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    image.src = url;
  });
}

function measureSharpness(image: HTMLImageElement): number {
  const scale = Math.min(1, SAMPLE_SIZE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx || width < 3 || height < 3) return 0;
  ctx.drawImage(image, 0, 0, width, height);

  const { data } = ctx.getImageData(0, 0, width, height);
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
  }

  const values: number[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const laplacian = (
        gray[idx - width] +
        gray[idx - 1] +
        gray[idx + 1] +
        gray[idx + width] -
        4 * gray[idx]
      );
      values.push(laplacian);
    }
  }

  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
