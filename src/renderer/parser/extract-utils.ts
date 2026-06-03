import { ExtractedField } from './types';

/** 高置信度阈值 */
const HIGH_CONF = 0.95;
/** 中置信度阈值 */
const MID_CONF = 0.75;

/** 通用正则提取：匹配成功返回高置信度，否则返回 null */
export function extractByRegex<T>(
  text: string,
  pattern: RegExp,
  transform: (match: RegExpMatchArray) => T | null,
): ExtractedField<T> {
  const match = text.match(pattern);
  if (!match) return { value: null, confidence: 0, rawMatch: null };
  const value = transform(match);
  if (value === null) return { value: null, confidence: 0, rawMatch: match[0] };
  return { value, confidence: HIGH_CONF, rawMatch: match[0] };
}

/** 多正则提取：按优先级尝试多个模式，第一个命中的置信度最高 */
export function extractByPatterns<T>(
  text: string,
  patterns: RegExp[],
  transform: (match: RegExpMatchArray) => T | null,
): ExtractedField<T> {
  for (let i = 0; i < patterns.length; i++) {
    const match = text.match(patterns[i]);
    if (!match) continue;
    const value = transform(match);
    if (value === null) continue;
    const confidence = i === 0 ? HIGH_CONF : MID_CONF;
    return { value, confidence, rawMatch: match[0] };
  }
  return { value: null, confidence: 0, rawMatch: null };
}

/**
 * OCR 专用：找到 label 所在行后，在后续 N 行内用 valuePattern 匹配值
 * 解决 OCR 文本中 label 和 value 分布在不同行的问题
 */
export function extractAfterLabel<T>(
  text: string,
  labelPattern: RegExp,
  valuePattern: RegExp,
  transform: (match: RegExpMatchArray) => T | null,
  maxScanLines = 10,
): ExtractedField<T> {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!labelPattern.test(lines[i])) continue;
    for (let j = i + 1; j < Math.min(i + 1 + maxScanLines, lines.length); j++) {
      const match = lines[j].trim().match(valuePattern);
      if (!match) continue;
      const value = transform(match);
      if (value === null) continue;
      return { value, confidence: MID_CONF, rawMatch: match[0] };
    }
  }
  return { value: null, confidence: 0, rawMatch: null };
}

/** 统计关键词在文本中出现的次数 */
export function countOccurrences(text: string, pattern: RegExp): number {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

/** 提取所有匹配项 */
export function extractAll(text: string, pattern: RegExp): string[] {
  const results: string[] = [];
  let match: RegExpExecArray | null;
  const global = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
  while ((match = global.exec(text)) !== null) {
    results.push(match[0]);
  }
  return results;
}

