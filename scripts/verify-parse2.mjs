/**
 * 端到端解析验证脚本 v2 — 运行：node scripts/verify-parse2.mjs
 */
import { readFileSync } from 'fs';

const Level1Block = {
  REPORT_HEADER: 'REPORT_HEADER', PERSONAL_INFO: 'PERSONAL_INFO',
  INFO_SUMMARY: 'INFO_SUMMARY', CREDIT_DETAIL: 'CREDIT_DETAIL',
  QUERY_RECORD: 'QUERY_RECORD', REPORT_NOTE: 'REPORT_NOTE',
};
const Level2Block = {
  IDENTITY_INFO: 'IDENTITY_INFO', SPOUSE_INFO: 'SPOUSE_INFO',
  RESIDENCE_INFO: 'RESIDENCE_INFO', JOB_INFO: 'JOB_INFO',
  CREDIT_HINT: 'CREDIT_HINT', DEBT_SUMMARY: 'DEBT_SUMMARY',
  QUERY_SUMMARY: 'QUERY_SUMMARY', NON_REVOLVING_LOAN: 'NON_REVOLVING_LOAN',
  REVOLVING_LOAN_TYPE1: 'REVOLVING_LOAN_TYPE1', REVOLVING_LOAN_TYPE2: 'REVOLVING_LOAN_TYPE2',
  CREDIT_CARD: 'CREDIT_CARD', REPAY_RESPONSIBILITY: 'REPAY_RESPONSIBILITY',
  CREDIT_AGREEMENT: 'CREDIT_AGREEMENT', ORG_QUERY: 'ORG_QUERY',
  SELF_QUERY: 'SELF_QUERY', DISPUTE_INFO: 'DISPUTE_INFO',
};

// === recognizeBlocks (from verify-blocks.mjs) ===
const MAX_TITLE = 30, PAGE_NOISE = /^第[0-9]+页[，。,.]共[0-9]+页/, ACCOUNT_PAT = /^账户[0-9]+/;
const L1R = [
  { p: /个人基本信息/, l: Level1Block.PERSONAL_INFO },
  { p: /^信息概要$/, l: Level1Block.INFO_SUMMARY },
  { p: /信贷交易信息明细/, l: Level1Block.CREDIT_DETAIL },
  { p: /查询记录$/, l: Level1Block.QUERY_RECORD },
  { p: /^报告说明$/, l: Level1Block.REPORT_NOTE },
];
const L2R = [
  { p: /身份信息/, l: Level2Block.IDENTITY_INFO, par: [Level1Block.PERSONAL_INFO] },
  { p: /配偶信息/, l: Level2Block.SPOUSE_INFO, par: [Level1Block.PERSONAL_INFO] },
  { p: /居住信息/, l: Level2Block.RESIDENCE_INFO, par: [Level1Block.PERSONAL_INFO] },
  { p: /职业信息/, l: Level2Block.JOB_INFO, par: [Level1Block.PERSONAL_INFO] },
  { p: /信贷交易信息提示/, l: Level2Block.CREDIT_HINT, par: [Level1Block.INFO_SUMMARY] },
  { p: /信贷交易授信及负债信息概要/, l: Level2Block.DEBT_SUMMARY, par: [Level1Block.INFO_SUMMARY] },
  { p: /查询记录概要/, l: Level2Block.QUERY_SUMMARY, par: [Level1Block.INFO_SUMMARY] },
  { p: /非循环贷账户$/, l: Level2Block.NON_REVOLVING_LOAN, par: [Level1Block.CREDIT_DETAIL] },
  { p: /循环贷账户一/, l: Level2Block.REVOLVING_LOAN_TYPE1, par: [Level1Block.CREDIT_DETAIL] },
  { p: /循环贷账户二/, l: Level2Block.REVOLVING_LOAN_TYPE2, par: [Level1Block.CREDIT_DETAIL] },
  { p: /贷记卡账户$/, l: Level2Block.CREDIT_CARD, par: [Level1Block.CREDIT_DETAIL] },
  { p: /相关还款责任信息$/, l: Level2Block.REPAY_RESPONSIBILITY, par: [Level1Block.CREDIT_DETAIL] },
  { p: /授信协议信息/, l: Level2Block.CREDIT_AGREEMENT, par: [Level1Block.CREDIT_DETAIL] },
  { p: /机构查询记录明细/, l: Level2Block.ORG_QUERY, par: [Level1Block.QUERY_RECORD] },
  { p: /本人查询记录明细/, l: Level2Block.SELF_QUERY, par: [Level1Block.QUERY_RECORD] },
  { p: /^异议信息提示$/, l: Level2Block.DISPUTE_INFO },
];
const ACC_BLK = [Level2Block.NON_REVOLVING_LOAN, Level2Block.REVOLVING_LOAN_TYPE1, Level2Block.REVOLVING_LOAN_TYPE2, Level2Block.CREDIT_CARD];

function mt(line, rules, curL1) {
  const c = line.replace(/^[一二三四五六七八九十]+/, '').replace(/^\([一二三四五六七八九十]+\)/, '').trim();
  for (const r of rules) { if (!(r.p.test(c) || r.p.test(line))) continue; if (r.par && (!curL1 || !r.par.includes(curL1))) continue; return r; }
  return null;
}
function recognizeBlocks(lines) {
  const res = { level1: {}, level2: {}, accounts: [] };
  let cL1 = null, cL1S = 0, cL2 = null, cL2S = 0, cAcc = null, done = false;
  res.level1[Level1Block.REPORT_HEADER] = { startLine: 0, endLine: 0 };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '' || PAGE_NOISE.test(line) || done) continue;
    const isShort = line.length <= MAX_TITLE;
    const l1 = isShort ? mt(line, L1R, null) : null;
    if (l1?.l) {
      if (cAcc) { res.accounts.push({ parentBlock: cAcc.par, label: cAcc.lab, range: { startLine: cAcc.s, endLine: i-1 } }); cAcc = null; }
      if (cL2) { res.level2[cL2] = { startLine: cL2S, endLine: i-1 }; cL2 = null; }
      if (cL1) res.level1[cL1] = { startLine: cL1S, endLine: i-1 }; if (!cL1) res.level1[Level1Block.REPORT_HEADER].endLine = i-1;
      cL1 = l1.l; cL1S = i; if (cL1 === Level1Block.REPORT_NOTE) done = true; continue;
    }
    const l2 = isShort ? mt(line, L2R, cL1) : null;
    if (l2?.l) {
      if (cAcc) { res.accounts.push({ parentBlock: cAcc.par, label: cAcc.lab, range: { startLine: cAcc.s, endLine: i-1 } }); cAcc = null; }
      if (cL2) res.level2[cL2] = { startLine: cL2S, endLine: i-1 }; cL2 = l2.l; cL2S = i; continue;
    }
    if (ACCOUNT_PAT.test(line) && cL2 && ACC_BLK.includes(cL2)) {
      if (cAcc) res.accounts.push({ parentBlock: cAcc.par, label: cAcc.lab, range: { startLine: cAcc.s, endLine: i-1 } });
      cAcc = { lab: line, par: cL2, s: i };
    }
  }
  const last = lines.length - 1;
  if (cAcc) res.accounts.push({ parentBlock: cAcc.par, label: cAcc.lab, range: { startLine: cAcc.s, endLine: last } });
  if (cL2) res.level2[cL2] = { startLine: cL2S, endLine: last };
  if (cL1) res.level1[cL1] = { startLine: cL1S, endLine: last };
  return res;
}
function gBL(lines, r) { return lines.slice(r.startLine, r.endLine + 1); }
function gL1(lines, bm, b) { return bm.level1[b] ? gBL(lines, bm.level1[b]) : []; }
function gL2(lines, bm, b) { return bm.level2[b] ? gBL(lines, bm.level2[b]) : []; }

// === header-parser ===
const HDR_LABELS = ['被查询者', '证件类型', '证件号码', '查询机构', '查询原因', '编号', '数据发生机构', '报告编号', '报告时间'];
const isHdrLabel = (t) => HDR_LABELS.some((l) => t.includes(l));

function parseHeader(lines) {
  const h = { reportNo: '', reportTime: '', name: '', certType: '', certNo: '', queryOrg: '', queryReason: '' };
  for (const raw of lines) {
    const line = raw.trim();
    const nm = line.match(/报告编号[：:]\s*(.+)/); if (nm) h.reportNo = nm[1].trim();
    const tm = line.match(/报告时间[：:]\s*(.+)/); if (tm) h.reportTime = tm[1].trim();
  }
  const si = lines.findIndex((l) => /被查询者姓名/.test(l));
  if (si < 0) return h;
  let vs = si + 1;
  for (; vs < lines.length; vs++) { const t = lines[vs].trim(); if (t && !isHdrLabel(t)) break; }
  const vals = [];
  for (let i = vs; i < lines.length && vals.length < 15; i++) { const t = lines[i].trim(); if (t && !isHdrLabel(t)) vals.push(t); }
  let idx = 0;
  if (idx < vals.length && /^[\u4e00-\u9fa5]{2,4}$/.test(vals[idx])) h.name = vals[idx++];
  if (idx < vals.length && /^[\u4e00-\u9fa5]{2,4}$/.test(vals[idx])) h.certType = vals[idx++];
  let digits = '';
  while (idx < vals.length && /^\d+$/.test(vals[idx])) digits += vals[idx++];
  if (digits.length >= 17) h.certNo = digits.substring(0, 18);
  if (idx < vals.length) h.queryOrg = vals[idx++];
  if (idx < vals.length) h.queryReason = vals[idx++];
  return h;
}

// === identity-parser ===
const ID_LABELS = ['性别','出生日期','婚姻状况','就业状况','学历','学位','国籍','电子邮箱','通讯地址','户籍地址','编号','工作单位','单位性质','单位地址','单位电话','职业','行业','职务','职称','进入本单位年份','信息更新日期','数据发生机构','手机号码','姓名','证件类型','证件号码','联系电话'];
const isNoise = (t) => ID_LABELS.some((l) => t === l || t.startsWith(l));

function scanMatch(lines, idx, maxScan, pattern) {
  for (let j = idx + 1; j < Math.min(idx + 1 + maxScan, lines.length); j++) { if (pattern.test(lines[j].trim())) return lines[j].trim(); }
  return null;
}
function scanValue(lines, idx, maxScan) {
  for (let j = idx + 1; j < Math.min(idx + 1 + maxScan, lines.length); j++) { const t = lines[j].trim(); if (t && !isNoise(t)) return t; }
  return null;
}

function parseIdentity(lines) {
  const info = { gender: null, birthDate: null, maritalStatus: null, employmentStatus: null, education: null, degree: null, nationality: null, email: null, commAddress: null, registeredAddress: null };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^性别$/.test(line)) info.gender = scanMatch(lines, i, 15, /^[男女]$/);
    else if (/^出生日期$/.test(line)) info.birthDate = scanMatch(lines, i, 15, /^\d{4}\.\d{2}\.\d{2}$/);
    else if (/^婚姻状况$/.test(line)) info.maritalStatus = scanMatch(lines, i, 15, /^(未婚|已婚|离异|离婚|丧偶)$/);
    else if (/^就业状况$/.test(line)) info.employmentStatus = scanMatch(lines, i, 15, /^(在职|退休|无业|在读)$/);
    else if (/^学历$/.test(line)) info.education = scanMatch(lines, i, 15, /^(博士|硕士|本科|大专|高中|中专|初中|小学|其他)$/);
    else if (/^学位$/.test(line)) info.degree = scanMatch(lines, i, 15, /^(博士|硕士|学士|其他|无|--|—)$/);
    else if (/^国籍$/.test(line)) info.nationality = scanMatch(lines, i, 15, /^(中国|中国的|中国籍)$/);
    else if (/^电子邮箱$/.test(line)) { for (let j = i+1; j < Math.min(i+8, lines.length); j++) { if (lines[j].trim().includes('@')) { info.email = lines[j].trim(); break; } } }
    else if (/^通讯地址$/.test(line)) info.commAddress = scanValue(lines, i, 5);
    else if (/^户籍地址$/.test(line)) info.registeredAddress = scanValue(lines, i, 5);
  }
  return info;
}

function parseLatestCompany(lines) {
  const idx = lines.findIndex((l) => /^工作单位$/.test(l.trim()));
  if (idx < 0) return '';
  for (let i = idx + 1; i < Math.min(idx + 15, lines.length); i++) {
    if (lines[i].trim() !== '1') continue;
    for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) { const t = lines[j].trim(); if (t && t.length >= 4 && !isNoise(t)) return t; }
  }
  return '';
}

// === summary-parser ===
function collectNumbers(lines, start, count) {
  const vals = [];
  for (let i = start; i < lines.length && vals.length < count; i++) { const t = lines[i].trim().replace(/,/g, ''); if (/^\d+$/.test(t)) vals.push(parseInt(t, 10)); }
  return vals;
}
function findLabelAfter(lines, start, label) {
  for (let i = start; i < lines.length; i++) { if (lines[i].trim().includes(label)) return i; }
  return -1;
}

function parseQuerySummary(lines) {
  const s = { lastMonthOrgCount: 0, lastMonthQueryCount: 0, last2YearQueryCount: 0 };
  const lastLabelIdx = lines.findIndex((l) => /最近2年内的查询次数/.test(l));
  if (lastLabelIdx < 0) return s;
  const reasons = ['贷款审批', '信用卡审批', '本人查询', '贷后管理', '担保资格', '特约商户'];
  let reasonEndIdx = lastLabelIdx;
  for (let i = lastLabelIdx; i < Math.min(lastLabelIdx + 30, lines.length); i++) {
    if (reasons.some((r) => lines[i].trim().includes(r))) reasonEndIdx = i;
  }
  const values = collectNumbers(lines, reasonEndIdx + 1, 10);
  let start = values.findIndex((v) => v > 0);
  if (start < 0) start = 0;
  s.lastMonthOrgCount = values[start] ?? 0;
  s.lastMonthQueryCount = values[start + 1] ?? 0;
  s.last2YearQueryCount = values[start + 2] ?? 0;
  return s;
}

function collectLoanValues(lines, start, count) {
  const nums = [];
  for (let i = start; i < lines.length && nums.length < 30; i++) {
    const t = lines[i].trim().replace(/,/g, '');
    if (!/^\d+$/.test(t)) continue;
    nums.push(parseInt(t, 10));
  }
  // 阶段1：跳过递增月份序列和年份
  let pos = 0, prevMonth = 0;
  for (; pos < nums.length; pos++) {
    const n = nums[pos];
    if (n >= 1 && n <= 12 && n > prevMonth) { prevMonth = n; continue; }
    if (n >= 2020 && n <= 2030) continue;
    break;
  }
  // 阶段2：跳过连续零值
  for (; pos < nums.length; pos++) { if (nums[pos] !== 0) break; }
  // 收集真实值，遇到年份(2020-2030)停止
  const result = [];
  for (let i = pos; i < nums.length && result.length < count; i++) {
    if (nums[i] >= 2020 && nums[i] <= 2030) break;
    result.push(nums[i]);
  }
  return result;
}

function parseDebtSummary(lines) {
  function parseLoan(anchor) {
    const empty = { orgCount: 0, accountCount: 0, totalCredit: 0, balance: 0, avgRepayment6m: 0 };
    const si = lines.findIndex((l) => l.trim().includes(anchor));
    if (si < 0) return empty;
    const li = findLabelAfter(lines, si, '最近6个月平均应还款');
    if (li < 0) return empty;
    const v = collectLoanValues(lines, li + 1, 5);
    return { orgCount: v[0] ?? 0, accountCount: v[1] ?? 0, totalCredit: v[2] ?? 0, balance: v[3] ?? 0, avgRepayment6m: v[4] ?? 0 };
  }
  function parseCard() {
    const empty = { orgCount: 0, accountCount: 0, totalCredit: 0, maxSingleOrgCredit: 0, minSingleOrgCredit: 0, usedAmount: 0, avgUsed6m: 0 };
    const si = lines.findIndex((l) => l.trim().includes('贷记卡账户信息汇总'));
    if (si < 0) return empty;
    const li = findLabelAfter(lines, si, '发卡机构数');
    if (li < 0) return empty;
    const v = collectNumbers(lines, li + 7, 7);
    return { orgCount: v[0] ?? 0, accountCount: v[1] ?? 0, totalCredit: v[2] ?? 0, maxSingleOrgCredit: v[3] ?? 0, minSingleOrgCredit: v[4] ?? 0, usedAmount: v[5] ?? 0, avgUsed6m: v[6] ?? 0 };
  }
  return { nonRevolvingLoan: parseLoan('非循环贷账户信息汇总'), revolvingLoan: parseLoan('循环贷账户二信息汇总'), creditCard: parseCard() };
}

// === account-overdue-parser ===
function findFirstNum(lines, start, maxScan) {
  for (let j = start; j < Math.min(start + maxScan, lines.length); j++) { const t = lines[j].trim().replace(/,/g, ''); if (/^\d+$/.test(t)) return parseInt(t, 10); }
  return 0;
}
function collectAmountValues(lines, start, count) {
  const values = [];
  for (let i = start; i < lines.length && values.length < count; i++) {
    const raw = lines[i].trim(); if (!raw) continue;
    if (/[\u4e00-\u9fa5]{2,}/.test(raw) && !/^\d/.test(raw)) continue;
    const cleaned = raw.replace(/,/g, '');
    if (/^\d+(\.\d+)?$/.test(cleaned)) values.push(parseFloat(cleaned));
  }
  return values;
}
function isClosedAccount(lines) { return lines.some((l) => /^(结清|提前结清|销户|√结清)$/.test(l.trim())); }

function parseCreditCardPayment(lines) {
  for (let i = 0; i < lines.length; i++) {
    if (!/^本月应还款$/.test(lines[i].trim())) continue;
    let labelEnd = i;
    for (let j = i; j < Math.min(i + 8, lines.length); j++) { if (/当前[途逾]期总额/.test(lines[j].trim())) { labelEnd = j; break; } }
    const values = collectAmountValues(lines, labelEnd + 1, 6);
    return values[1] ?? 0;
  }
  return 0;
}
function parseLoanPayment(lines) {
  for (let i = 0; i < lines.length; i++) {
    if (!/^本月应还款$/.test(lines[i].trim())) continue;
    let labelEnd = i;
    for (let j = i; j < Math.min(i + 5, lines.length); j++) { if (/^本月实还款$/.test(lines[j].trim())) { labelEnd = j; break; } }
    const values = collectAmountValues(lines, labelEnd + 1, 7);
    return values[4] ?? 0;
  }
  return 0;
}

function aggregateAccountOverdue(allLines, accounts) {
  let hasCurrentOverdue = false, maxOverduePeriods = 0, totalMonthlyRepayment = 0;
  for (const acc of accounts) {
    const lines = allLines.slice(acc.range.startLine, acc.range.endLine + 1);
    for (let i = 0; i < lines.length; i++) {
      if (/当前[途逾]期期数/.test(lines[i].trim())) { const v = findFirstNum(lines, i + 1, 5); if (v > 0) hasCurrentOverdue = true; break; }
    }
    let inRepay = false;
    for (const l of lines) { const t = l.trim(); if (/还款记录/.test(t)) { inRepay = true; continue; } if (inRepay && /^[1-7]$/.test(t)) { const v = parseInt(t, 10); if (v > maxOverduePeriods) maxOverduePeriods = v; } }
    if (!isClosedAccount(lines)) {
      const isCreditCard = acc.parentBlock === 'CREDIT_CARD';
      totalMonthlyRepayment += isCreditCard ? parseCreditCardPayment(lines) : parseLoanPayment(lines);
    }
  }
  return { hasCurrentOverdue, maxOverduePeriods, totalMonthlyRepayment };
}

// === profile-bridge ===
function calcAge(birthDate) {
  if (!birthDate) return null;
  const m = birthDate.match(/(\d{4})\.(\d{2})\.(\d{2})/);
  if (!m) return null;
  const now = new Date();
  let age = now.getFullYear() - parseInt(m[1]);
  if (now.getMonth() + 1 < parseInt(m[2]) || (now.getMonth() + 1 === parseInt(m[2]) && now.getDate() < parseInt(m[3]))) age--;
  return age;
}
function mapMarriage(s) { return s === '已婚' ? '已婚' : s === '未婚' ? '未婚' : s === '离异' || s === '离婚' ? '离异' : s ?? ''; }
function yuanToWan(v) { return v ? +(v / 10000).toFixed(2) : 0; }

// === MAIN ===
const fullText = readFileSync('full text view.txt', 'utf-8');
const lines = fullText.split('\n');
const bm = recognizeBlocks(lines);

console.log('=== 区块识别 ===');
console.log('L1:', Object.keys(bm.level1).length, '个');
console.log('L2:', Object.keys(bm.level2).length, '个');
console.log('账户:', bm.accounts.length, '个');

const headerLines = gL1(lines, bm, Level1Block.REPORT_HEADER);
const header = parseHeader(headerLines);
console.log('\n=== 报告头 ===');
console.log('姓名:', header.name);
console.log('证件类型:', header.certType);
console.log('证件号码:', header.certNo);
console.log('查询机构:', header.queryOrg);
console.log('查询原因:', header.queryReason);

const idLines = gL2(lines, bm, Level2Block.IDENTITY_INFO);
const identity = parseIdentity(idLines);
console.log('\n=== 身份信息 ===');
console.log('性别:', identity.gender);
console.log('出生日期:', identity.birthDate);
console.log('婚姻状况:', identity.maritalStatus);
console.log('就业状况:', identity.employmentStatus);
console.log('学历:', identity.education);
console.log('学位:', identity.degree);
console.log('国籍:', identity.nationality);

const jobLines = gL2(lines, bm, Level2Block.JOB_INFO).concat(gL2(lines, bm, Level2Block.IDENTITY_INFO));
const company = parseLatestCompany(jobLines);
console.log('工作单位:', company);

const summaryLines = gL2(lines, bm, Level2Block.DEBT_SUMMARY);
const debt = parseDebtSummary(summaryLines);
console.log('\n=== 负债概要 ===');
console.log('非循环贷:', JSON.stringify(debt.nonRevolvingLoan));
console.log('循环贷:', JSON.stringify(debt.revolvingLoan));
console.log('贷记卡:', JSON.stringify(debt.creditCard));

const queryLines = gL2(lines, bm, Level2Block.QUERY_SUMMARY);
const query = parseQuerySummary(queryLines);
console.log('\n=== 查询概要 ===');
console.log('最近1月查询机构数:', query.lastMonthOrgCount);
console.log('最近1月查询次数:', query.lastMonthQueryCount);
console.log('最近2年查询次数:', query.last2YearQueryCount);

const overdue = aggregateAccountOverdue(lines, bm.accounts);
console.log('\n=== 逾期/月供 ===');
console.log('当前逾期:', overdue.hasCurrentOverdue);
console.log('历史最高逾期期数:', overdue.maxOverduePeriods);
console.log('月供合计(元):', overdue.totalMonthlyRepayment);
console.log('月供合计(万):', yuanToWan(overdue.totalMonthlyRepayment));

console.log('\n=== 年龄 ===');
console.log('年龄:', calcAge(identity.birthDate));
console.log('婚姻:', mapMarriage(identity.maritalStatus));
