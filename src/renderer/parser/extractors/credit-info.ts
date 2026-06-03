import { ExtractedField } from '../types';
import { extractByPatterns, extractAfterLabel } from '../extract-utils';

/** 解析金额字符串，去掉逗号 */
function parseAmount(s: string): number | null {
  const raw = parseFloat(s.replace(/,/g, ''));
  return isNaN(raw) ? null : raw;
}

/** 提取近N个月的查询次数，通过统计查询记录章节中的日期条目 */
export function extractQueryCount(querySection: string, months: number): ExtractedField<number> {
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());

  const datePattern = /(\d{4})[.\-/](\d{2})[.\-/](\d{2})/g;
  let match: RegExpExecArray | null;
  let count = 0;
  let totalDates = 0;

  while ((match = datePattern.exec(querySection)) !== null) {
    totalDates++;
    const date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    if (date >= cutoff && date <= now) count++;
  }

  if (totalDates === 0) return { value: null, confidence: 0, rawMatch: null };
  return { value: count, confidence: 0.90, rawMatch: `${count}/${totalDates} dates in range` };
}

/** 提取当前是否有逾期：扫描所有"当前逾期期数/总额"后面的数值 */
export function extractOverdueCurrent(text: string): ExtractedField<boolean> {
  // 同行格式
  const noOverdue = /当前[无没]逾期|逾期笔数[：:]\s*0|当前逾期[金额期数总]*[：:]\s*0/;
  if (noOverdue.test(text)) {
    return { value: false, confidence: 0.95, rawMatch: text.match(noOverdue)?.[0] ?? null };
  }
  const hasOverdue = /当前逾期[金额期数总]*[：:]\s*[1-9]/;
  if (hasOverdue.test(text)) {
    return { value: true, confidence: 0.90, rawMatch: text.match(hasOverdue)?.[0] ?? null };
  }

  // OCR 跨行：找"当前逾期期数"或"当前逾期总额"，看后续行的数字
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!/当前[途逾]期[期数总额]+/.test(lines[i])) continue;
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const trimmed = lines[j].trim();
      if (/^[1-9][\d,]*$/.test(trimmed)) {
        return { value: true, confidence: 0.75, rawMatch: trimmed };
      }
      if (trimmed === '0') {
        return { value: false, confidence: 0.75, rawMatch: '0' };
      }
    }
  }
  return { value: null, confidence: 0, rawMatch: null };
}

/** 提取历史最高逾期等级 */
export function extractOverdueHistory(text: string): ExtractedField<number> {
  return extractByPatterns(text, [
    /最大逾期期数[：:]\s*(\d)/,
    /历史最高逾期[：:]\s*(\d)/,
    /逾期\s*(\d)\s*期/,
  ], (m) => {
    const val = parseInt(m[1], 10);
    return val >= 0 && val <= 7 ? val : null;
  });
}

/** 提取信用卡总授信额度 (万元)：同行 → OCR 跨行 */
export function extractTotalCreditLimit(text: string): ExtractedField<number> {
  const inline = extractByPatterns(text, [
    /授信总额[：:]\s*([\d,.]+)/,
    /信用卡.*?授信[额总]*[：:]\s*([\d,.]+)/,
  ], (m) => { const v = parseAmount(m[1]); return v ? v / 10000 : null; });
  if (inline.value) return inline;

  // OCR: "贷记卡账户信息汇总" 区域中 "授信总额" 后面的数字行
  return extractAfterLabel(text,
    /贷记卡账户信息汇总/, /^([\d,.]+)$/,
    (m) => { const v = parseAmount(m[1]); return v && v >= 1000 ? v / 10000 : null; },
    20,
  );
}

/** 提取信用卡已用额度 (万元)：同行 → OCR 跨行 */
export function extractUsedCreditLimit(text: string): ExtractedField<number> {
  const inline = extractByPatterns(text, [
    /已用额度[：:]\s*([\d,.]+)/,
    /使用额度[：:]\s*([\d,.]+)/,
  ], (m) => { const v = parseAmount(m[1]); return v ? v / 10000 : null; });
  if (inline.value) return inline;

  // OCR: "已用额度" label 后面的数字行
  return extractAfterLabel(text,
    /已用额度/, /^([\d,.]+)$/,
    (m) => { const v = parseAmount(m[1]); return v ? v / 10000 : null; },
    5,
  );
}

/** 提取贷款月供合计 (元)：同行 → OCR 跨行累加"本月应还款" */
export function extractMonthlyRepayment(text: string): ExtractedField<number> {
  const inline = extractByPatterns(text, [
    /月[还供]款[额合计]*[：:]\s*([\d,.]+)/,
    /每月[应还]*还款[：:]\s*([\d,.]+)/,
    /本月应还[款额]*[：:]\s*([\d,.]+)/,
  ], (m) => parseAmount(m[1]));
  if (inline.value) return inline;

  // OCR: 累加所有"本月应还款"后面的金额
  const lines = text.split('\n');
  let total = 0;
  let found = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!/本月应还款/.test(lines[i])) continue;
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      const v = parseAmount(lines[j].trim());
      if (v && v > 0) { total += v; found++; break; }
    }
  }
  if (found === 0) return { value: null, confidence: 0, rawMatch: null };
  return { value: total, confidence: 0.70, rawMatch: `sum of ${found} repayments` };
}

