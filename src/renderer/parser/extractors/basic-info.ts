import { ExtractedField } from '../types';
import { extractByRegex, extractByPatterns, extractAfterLabel } from '../extract-utils';

const MARRIAGE_MAP: Record<string, 'single' | 'married' | 'divorced'> = {
  '未婚': 'single', '已婚': 'married', '离异': 'divorced', '离婚': 'divorced',
};

/** 提取姓名：同行匹配 → OCR 跨行匹配 */
export function extractName(text: string): ExtractedField<string> {
  const inline = extractByPatterns(text, [
    /姓\s*名[：:]\s*([^\s\n,，]{2,4})/,
    /被查询者[：:]\s*([^\s\n,，]{2,4})/,
  ], (m) => m[1] || null);
  if (inline.value) return inline;

  // OCR: "被查询者姓名" 在一行，姓名在后续行
  return extractAfterLabel(text,
    /被查询者姓名/, /^([\u4e00-\u9fa5]{2,4})$/,
    (m) => m[1] || null, 10,
  );
}

/** 提取身份证号：同行匹配 → OCR 跨行拼接 */
export function extractIdCard(text: string): ExtractedField<string> {
  const inline = extractByRegex(text,
    /(?:身份证号|证件号码|身份证号码)[：:]\s*(\d{17}[\dXx])/,
    (m) => m[1] || null,
  );
  if (inline.value) return inline;

  // OCR: 身份证号可能被拆成两行（如 120109199005227 + 011）
  return extractIdCardFromLines(text);
}

/** OCR 跨行拼接身份证号 */
function extractIdCardFromLines(text: string): ExtractedField<string> {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!/证件号码|证件类型/.test(lines[i])) continue;
    // 向后扫描，收集纯数字行拼接
    let digits = '';
    for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
      const trimmed = lines[j].trim();
      if (/^\d+$/.test(trimmed)) {
        digits += trimmed;
        if (digits.length >= 18) break;
      }
    }
    if (digits.length >= 17) {
      const id = digits.substring(0, 18);
      if (/^\d{17}[\dXx]$/.test(id)) {
        return { value: id, confidence: 0.75, rawMatch: id };
      }
    }
  }
  return { value: null, confidence: 0, rawMatch: null };
}

/** 从身份证号推算年龄 */
export function extractAgeFromIdCard(idCard: string | null): ExtractedField<number> {
  if (!idCard || idCard.length !== 18) return { value: null, confidence: 0, rawMatch: null };
  const birthYear = parseInt(idCard.substring(6, 10), 10);
  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear;
  if (age < 0 || age > 120) return { value: null, confidence: 0, rawMatch: idCard };
  return { value: age, confidence: 0.95, rawMatch: idCard.substring(6, 10) };
}

/** 提取婚姻状况：同行匹配 → OCR 跨行匹配 */
export function extractMarriage(text: string): ExtractedField<'single' | 'married' | 'divorced'> {
  const inline = extractByRegex(text,
    /婚姻状况[：:]\s*(未婚|已婚|离异|离婚)/,
    (m) => MARRIAGE_MAP[m[1]] ?? null,
  );
  if (inline.value) return inline;

  // OCR: "婚姻状况" 在一行，值在后续行
  return extractAfterLabel(text,
    /婚姻状况/, /^(未婚|已婚|离异|离婚)$/,
    (m) => MARRIAGE_MAP[m[1]] ?? null, 15,
  );
}

/** 提取工作单位：同行匹配 → OCR 跨行匹配 */
export function extractCompany(text: string): ExtractedField<string> {
  const inline = extractByPatterns(text, [
    /工作单位[：:]\s*(.{2,30}?)(?:\s|$|\n)/,
  ], (m) => m[1]?.trim() || null);
  if (inline.value) return inline;

  // OCR: "工作单位" 在一行，公司名在后续行
  return extractAfterLabel(text,
    /工作单位/, /^(.{4,30})$/,
    (m) => {
      const val = m[1]?.trim();
      // 排除表头类干扰行
      if (!val || /^(单位性质|单位地址|单位电话|编号)$/.test(val)) return null;
      return val;
    }, 5,
  );
}

