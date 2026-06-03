/**
 * 验证区块识别器 — 用真实 OCR 文本跑 recognizeBlocks()
 *
 * 因为 block-types.ts 用了 const enum（编译时内联），
 * 这里手动内联枚举值，直接复刻识别逻辑来验证。
 *
 * 用法: node scripts/verify-blocks.mjs
 */

import { readFileSync } from 'fs';

// ---- 内联枚举值 ----
const Level1Block = {
  REPORT_HEADER: 'REPORT_HEADER',
  PERSONAL_INFO: 'PERSONAL_INFO',
  INFO_SUMMARY: 'INFO_SUMMARY',
  CREDIT_DETAIL: 'CREDIT_DETAIL',
  QUERY_RECORD: 'QUERY_RECORD',
  REPORT_NOTE: 'REPORT_NOTE',
};

const Level2Block = {
  IDENTITY_INFO: 'IDENTITY_INFO',
  SPOUSE_INFO: 'SPOUSE_INFO',
  RESIDENCE_INFO: 'RESIDENCE_INFO',
  JOB_INFO: 'JOB_INFO',
  PHONE_INFO: 'PHONE_INFO',
  CREDIT_HINT: 'CREDIT_HINT',
  DEBT_SUMMARY: 'DEBT_SUMMARY',
  QUERY_SUMMARY: 'QUERY_SUMMARY',
  NON_REVOLVING_LOAN: 'NON_REVOLVING_LOAN',
  REVOLVING_LOAN_TYPE1: 'REVOLVING_LOAN_TYPE1',
  REVOLVING_LOAN_TYPE2: 'REVOLVING_LOAN_TYPE2',
  CREDIT_CARD: 'CREDIT_CARD',
  REPAY_RESPONSIBILITY: 'REPAY_RESPONSIBILITY',
  CREDIT_AGREEMENT: 'CREDIT_AGREEMENT',
  ORG_QUERY: 'ORG_QUERY',
  SELF_QUERY: 'SELF_QUERY',
  DISPUTE_INFO: 'DISPUTE_INFO',
};

// ---- 标题规则（与 block-recognizer.ts 完全一致） ----
const MAX_TITLE_LINE_LENGTH = 30;

const LEVEL1_RULES = [
  { pattern: /个人基本信息/, level1: Level1Block.PERSONAL_INFO },
  { pattern: /^信息概要$/, level1: Level1Block.INFO_SUMMARY },
  { pattern: /信贷交易信息明细/, level1: Level1Block.CREDIT_DETAIL },
  { pattern: /查询记录$/, level1: Level1Block.QUERY_RECORD },
  { pattern: /^报告说明$/, level1: Level1Block.REPORT_NOTE },
];

const LEVEL2_RULES = [
  { pattern: /身份信息/, level2: Level2Block.IDENTITY_INFO, parentL1: [Level1Block.PERSONAL_INFO] },
  { pattern: /配偶信息/, level2: Level2Block.SPOUSE_INFO, parentL1: [Level1Block.PERSONAL_INFO] },
  { pattern: /居住信息/, level2: Level2Block.RESIDENCE_INFO, parentL1: [Level1Block.PERSONAL_INFO] },
  { pattern: /职业信息/, level2: Level2Block.JOB_INFO, parentL1: [Level1Block.PERSONAL_INFO] },
  { pattern: /信贷交易信息提示/, level2: Level2Block.CREDIT_HINT, parentL1: [Level1Block.INFO_SUMMARY] },
  { pattern: /信贷交易授信及负债信息概要/, level2: Level2Block.DEBT_SUMMARY, parentL1: [Level1Block.INFO_SUMMARY] },
  { pattern: /查询记录概要/, level2: Level2Block.QUERY_SUMMARY, parentL1: [Level1Block.INFO_SUMMARY] },
  { pattern: /非循环贷账户$/, level2: Level2Block.NON_REVOLVING_LOAN, parentL1: [Level1Block.CREDIT_DETAIL] },
  { pattern: /循环贷账户一/, level2: Level2Block.REVOLVING_LOAN_TYPE1, parentL1: [Level1Block.CREDIT_DETAIL] },
  { pattern: /循环贷账户二/, level2: Level2Block.REVOLVING_LOAN_TYPE2, parentL1: [Level1Block.CREDIT_DETAIL] },
  { pattern: /贷记卡账户$/, level2: Level2Block.CREDIT_CARD, parentL1: [Level1Block.CREDIT_DETAIL] },
  { pattern: /相关还款责任信息$/, level2: Level2Block.REPAY_RESPONSIBILITY, parentL1: [Level1Block.CREDIT_DETAIL] },
  { pattern: /授信协议信息/, level2: Level2Block.CREDIT_AGREEMENT, parentL1: [Level1Block.CREDIT_DETAIL] },
  { pattern: /机构查询记录明细/, level2: Level2Block.ORG_QUERY, parentL1: [Level1Block.QUERY_RECORD] },
  { pattern: /本人查询记录明细/, level2: Level2Block.SELF_QUERY, parentL1: [Level1Block.QUERY_RECORD] },
  { pattern: /^异议信息提示$/, level2: Level2Block.DISPUTE_INFO },
];

const ACCOUNT_PATTERN = /^账户[0-9]+/;
const PAGE_NOISE_PATTERN = /^第[0-9]+页[，。,.]共[0-9]+页/;

// ---- 识别逻辑（与 block-recognizer.ts 完全一致） ----
function matchTitle(line, rules, currentL1) {
  const cleaned = line
    .replace(/^[一二三四五六七八九十]+/, '')
    .replace(/^\([一二三四五六七八九十]+\)/, '')
    .trim();
  for (const rule of rules) {
    if (!(rule.pattern.test(cleaned) || rule.pattern.test(line))) continue;
    if (rule.parentL1 && (!currentL1 || !rule.parentL1.includes(currentL1))) continue;
    return rule;
  }
  return null;
}

function isAccountContext(l2) {
  return [
    Level2Block.NON_REVOLVING_LOAN,
    Level2Block.REVOLVING_LOAN_TYPE1,
    Level2Block.REVOLVING_LOAN_TYPE2,
    Level2Block.CREDIT_CARD,
  ].includes(l2);
}

function recognizeBlocks(lines) {
  const result = { level1: {}, level2: {}, accounts: [] };
  let currentL1 = null, currentL1Start = 0;
  let currentL2 = null, currentL2Start = 0;
  let currentAccount = null;
  let reachedReportNote = false;

  result.level1[Level1Block.REPORT_HEADER] = { startLine: 0, endLine: 0 };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '' || PAGE_NOISE_PATTERN.test(line)) continue;

    if (reachedReportNote) continue;
    const isShortLine = line.length <= MAX_TITLE_LINE_LENGTH;

    const l1Match = isShortLine ? matchTitle(line, LEVEL1_RULES, null) : null;
    if (l1Match?.level1) {
      if (currentAccount) { closeAccount(result, currentAccount, i - 1); currentAccount = null; }
      if (currentL2) { result.level2[currentL2] = { startLine: currentL2Start, endLine: i - 1 }; currentL2 = null; }
      if (currentL1) { result.level1[currentL1] = { startLine: currentL1Start, endLine: i - 1 }; }
      if (!currentL1) { result.level1[Level1Block.REPORT_HEADER].endLine = i - 1; }
      currentL1 = l1Match.level1; currentL1Start = i;
      if (currentL1 === Level1Block.REPORT_NOTE) { reachedReportNote = true; }
      continue;
    }

    const l2Match = isShortLine ? matchTitle(line, LEVEL2_RULES, currentL1) : null;
    if (l2Match?.level2) {
      if (currentAccount) { closeAccount(result, currentAccount, i - 1); currentAccount = null; }
      if (currentL2) { result.level2[currentL2] = { startLine: currentL2Start, endLine: i - 1 }; }
      currentL2 = l2Match.level2; currentL2Start = i;
      continue;
    }

    if (ACCOUNT_PATTERN.test(line) && isAccountContext(currentL2)) {
      if (currentAccount) { closeAccount(result, currentAccount, i - 1); }
      currentAccount = { label: line, parent: currentL2, start: i };
    }
  }

  const lastLine = lines.length - 1;
  if (currentAccount) closeAccount(result, currentAccount, lastLine);
  if (currentL2) result.level2[currentL2] = { startLine: currentL2Start, endLine: lastLine };
  if (currentL1) result.level1[currentL1] = { startLine: currentL1Start, endLine: lastLine };
  return result;
}

function closeAccount(result, account, endLine) {
  result.accounts.push({ parentBlock: account.parent, label: account.label, range: { startLine: account.start, endLine } });
}

// ---- 执行验证 ----
const text = readFileSync('D:\\DaiXB_project\\full text view.txt', 'utf-8');
const lines = text.split('\n');
console.log(`总行数: ${lines.length}\n`);

const blockMap = recognizeBlocks(lines);

console.log('=== 一级区块 ===');
for (const [key, range] of Object.entries(blockMap.level1)) {
  const first = lines[range.startLine]?.trim().substring(0, 40);
  const last = lines[range.endLine]?.trim().substring(0, 40);
  console.log(`${key.padEnd(20)} 行 ${String(range.startLine).padStart(5)}-${String(range.endLine).padStart(5)}  (${range.endLine - range.startLine + 1}行)  首:"${first}"  尾:"${last}"`);
}

console.log('\n=== 二级区块 ===');
for (const [key, range] of Object.entries(blockMap.level2)) {
  const first = lines[range.startLine]?.trim().substring(0, 40);
  const last = lines[range.endLine]?.trim().substring(0, 40);
  console.log(`${key.padEnd(25)} 行 ${String(range.startLine).padStart(5)}-${String(range.endLine).padStart(5)}  (${range.endLine - range.startLine + 1}行)  首:"${first}"  尾:"${last}"`);
}

console.log(`\n=== 账户区块 (共 ${blockMap.accounts.length} 个) ===`);
for (const acc of blockMap.accounts) {
  const first = lines[acc.range.startLine]?.trim().substring(0, 50);
  console.log(`[${acc.parentBlock.padEnd(22)}] ${acc.label.padEnd(15)} 行 ${String(acc.range.startLine).padStart(5)}-${String(acc.range.endLine).padStart(5)}  (${acc.range.endLine - acc.range.startLine + 1}行)  首:"${first}"`);
}

