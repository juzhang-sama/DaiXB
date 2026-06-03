/**
 * 身份信息解析器 — 从 PERSONAL_INFO 区块提取身份信息和最新工作单位
 */

import { IdentityInfo } from '../../types/credit-report';
import type { ContextTable } from '../doc-table-bridge';

// ============================================================
// 身份信息
// ============================================================

/** 从 PERSONAL_INFO 区块提取身份信息 */
export function parseIdentity(lines: string[], docTables?: ContextTable[]): IdentityInfo {
  const info: IdentityInfo = {
    gender: null, birthDate: null, maritalStatus: null,
    employmentStatus: null, education: null, degree: null,
    nationality: null, email: null, commAddress: null,
    registeredAddress: null,
  };

  // 优先：DocParser 模式
  if (docTables?.length) {
    const result = parseIdentityFromDoc(docTables, info);
    if (result) return result;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    matchIdentityField(lines, i, line, info);
  }

  return info;
}

/**
 * DocParser 模式：从身份信息多段式大表提取字段
 *
 * 表格结构（一张大表内嵌多个标签行→值行段）：
 * headers: [性别, 性别, 出生日期, 婚姻状况, 就业状况]
 * row[0]:  [男, 男, 1990.05.22, 已婚, 在职]
 * row[3]:  [学历, 学历, 学位, 国籍, 电子邮箱]
 * row[4]:  [, , , 中国, 572931338@qq.com]
 * row[7]:  [通讯地址, 通讯地址, 通讯地址, 户籍地址, 户籍地址]
 * row[8]:  [天津市..., 天津市..., 天津市..., 河北省..., 河北省...]
 */
function parseIdentityFromDoc(
  docTables: ContextTable[], info: IdentityInfo,
): IdentityInfo | null {
  // 桶内已是身份信息表格，直接取第一张
  const ct = docTables[0];
  if (!ct) return null;

  const t = ct.table;
  const allRows = [t.headers, ...t.rows];

  // 遍历所有行，找到标签行后从下一行取值
  for (let i = 0; i < allRows.length - 1; i++) {
    const labelRow = allRows[i];
    const valueRow = allRows[i + 1];
    assignIdentityFromRow(labelRow, valueRow, info);
  }

  return info.gender ? info : null;
}

/** 根据标签行和值行的列对应关系赋值 */
function assignIdentityFromRow(
  labels: string[], values: string[], info: IdentityInfo,
): void {
  for (let i = 0; i < labels.length && i < values.length; i++) {
    const label = labels[i]?.trim();
    const val = values[i]?.trim();
    if (!label || !val) continue;
    // 跳过值行本身也是标签的情况（如"数据发生机构名称"）
    if (label === val) continue;

    if (label === '性别') info.gender = info.gender ?? val;
    else if (label === '出生日期') info.birthDate = info.birthDate ?? val;
    else if (label === '婚姻状况') info.maritalStatus = info.maritalStatus ?? val;
    else if (label === '就业状况') info.employmentStatus = info.employmentStatus ?? val;
    else if (label === '学历' && val) info.education = info.education ?? val;
    else if (label === '学位' && val) info.degree = info.degree ?? val;
    else if (label === '国籍') info.nationality = info.nationality ?? val;
    else if (label === '电子邮箱') info.email = info.email ?? val;
    else if (label === '通讯地址') info.commAddress = info.commAddress ?? val;
    else if (label === '户籍地址') info.registeredAddress = info.registeredAddress ?? val;
  }
}

/** 逐行匹配身份信息字段 — 使用字段专用验证器跨越 OCR 列交错 */
function matchIdentityField(
  lines: string[], idx: number, line: string, info: IdentityInfo,
): void {
  if (/^性别$/.test(line)) info.gender = scanMatch(lines, idx, 15, /^[男女]$/);
  else if (/^出生日期$/.test(line)) info.birthDate = scanMatch(lines, idx, 15, /^\d{4}\.\d{2}\.\d{2}$/);
  else if (/^婚姻状况$/.test(line)) info.maritalStatus = scanMatch(lines, idx, 15, /^(未婚|已婚|离异|离婚|丧偶)$/);
  else if (/^就业状况$/.test(line)) info.employmentStatus = scanMatch(lines, idx, 15, /^(在职|退休|无业|在读)$/);
  else if (/^学历$/.test(line)) info.education = scanMatch(lines, idx, 15, /^(博士|硕士|本科|大专|高中|中专|初中|小学|其他)$/);
  else if (/^学位$/.test(line)) info.degree = scanMatch(lines, idx, 15, /^(博士|硕士|学士|其他|无|--|—)$/);
  else if (/^国籍$/.test(line)) info.nationality = scanMatch(lines, idx, 15, /^(中国|中国的|中国籍)$/);
  else if (/^电子邮箱$/.test(line)) info.email = scanEmail(lines, idx);
  else if (/^通讯地址$/.test(line)) info.commAddress = scanValue(lines, idx, 5);
  else if (/^户籍地址$/.test(line)) info.registeredAddress = scanValue(lines, idx, 5);
}

// ============================================================
// 职业信息（提取第一条，即最新的工作单位）
// ============================================================

/**
 * 从 PERSONAL_INFO 区块提取最新工作单位名称
 *
 * DocParser 表格结构：
 * headers: [编号, 工作单位, 工作单位, 单位性质, 单位地址×5, 单位电话]
 * row[0]:  [1, 天津市南开区三只猫商贸有限责任公司, ..., 个体私营企业, 天津市...×5, ""]
 */
export function parseLatestCompany(lines: string[], docTables?: ContextTable[]): string {
  // 优先：DocParser 模式
  if (docTables?.length) {
    const result = parseCompanyFromDoc(docTables);
    if (result) return result;
  }

  // 行模式回退
  const jobLabelIdx = lines.findIndex((l) => /^工作单位$/.test(l.trim()));
  if (jobLabelIdx < 0) return '';

  for (let i = jobLabelIdx + 1; i < Math.min(jobLabelIdx + 15, lines.length); i++) {
    if (lines[i].trim() !== '1') continue;
    for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
      const t = lines[j].trim();
      if (t && t.length >= 4 && !isNoiseLabel(t)) return t;
    }
  }
  return '';
}

/** DocParser 模式：从职业信息桶取第一条工作单位 */
function parseCompanyFromDoc(docTables: ContextTable[]): string | null {
  // 桶内已是职业信息表格，直接取第一张
  const ct = docTables[0];
  if (!ct || ct.table.rows.length === 0) return null;

  // headers 中找"工作单位"列索引
  const colIdx = ct.table.headers.findIndex((h) => h.includes('工作单位'));
  if (colIdx < 0) return null;

  const val = ct.table.rows[0][colIdx]?.trim();
  return val && val.length >= 2 ? val : null;
}

// ============================================================
// 工具函数
// ============================================================

const IDENTITY_LABELS = [
  '性别', '出生日期', '婚姻状况', '就业状况', '学历', '学位',
  '国籍', '电子邮箱', '通讯地址', '户籍地址', '编号', '工作单位',
  '单位性质', '单位地址', '单位电话', '职业', '行业', '职务',
  '职称', '进入本单位年份', '信息更新日期', '数据发生机构',
  '手机号码', '姓名', '证件类型', '证件号码', '联系电话',
];

/** 向后扫描 N 行，找到第一个非标签、非空的值 */
function scanValue(lines: string[], idx: number, maxScan: number): string | null {
  for (let j = idx + 1; j < Math.min(idx + 1 + maxScan, lines.length); j++) {
    const t = lines[j].trim();
    if (!t || isNoiseLabel(t)) continue;
    return t;
  }
  return null;
}

/** 向后扫描 N 行，找到第一个匹配正则的值（用于精确匹配特定格式） */
function scanMatch(
  lines: string[], idx: number, maxScan: number, pattern: RegExp,
): string | null {
  for (let j = idx + 1; j < Math.min(idx + 1 + maxScan, lines.length); j++) {
    const t = lines[j].trim();
    if (pattern.test(t)) return t;
  }
  return null;
}

/** 扫描邮箱（包含@的行） */
function scanEmail(lines: string[], idx: number): string | null {
  for (let j = idx + 1; j < Math.min(idx + 8, lines.length); j++) {
    const t = lines[j].trim();
    if (t.includes('@')) return t;
  }
  return null;
}

/** 判断是否为标签/噪声行 */
function isNoiseLabel(text: string): boolean {
  return IDENTITY_LABELS.some((l) => text === l || text.startsWith(l));
}


