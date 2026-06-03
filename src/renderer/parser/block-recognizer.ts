/**
 * 区块识别器 — 从 OCR 文本行数组中识别出各模块/子模块的边界
 *
 * 策略（容错两遍扫描）：
 * 第一遍：全文扫描，收集所有一级/二级标题锚点的行号
 * 第二遍：按征信报告固定结构对锚点排序，再切分区块
 * 即使页面乱序导致标题出现顺序不对，也能正确归位
 */

import {
  BlockMap, BlockRange, AccountBlock,
  Level1Block, Level2Block,
} from './block-types';

// ============================================================
// 标题匹配规则
// ============================================================

interface TitleRule {
  pattern: RegExp;
  level1?: Level1Block;
  level2?: Level2Block;
  /** 限定该二级标题只在哪些一级区块内生效 */
  parentL1?: Level1Block[];
}

/**
 * 标题行最大长度 — 超过此长度的行视为正文，不做标题匹配。
 * 排除报告说明/编制说明中包含关键词的长句。
 */
const MAX_TITLE_LINE_LENGTH = 30;

/** 一级标题规则（OCR 可能带中文数字前缀噪声） */
const LEVEL1_RULES: TitleRule[] = [
  { pattern: /个人基本信息/, level1: Level1Block.PERSONAL_INFO },
  { pattern: /^信息概要$/, level1: Level1Block.INFO_SUMMARY },
  { pattern: /信贷交易信息明细/, level1: Level1Block.CREDIT_DETAIL },
  { pattern: /查询记录$/, level1: Level1Block.QUERY_RECORD },
  { pattern: /^报告说明$/, level1: Level1Block.REPORT_NOTE },
];

/** 二级标题规则（带 parentL1 层级约束） */
const LEVEL2_RULES: TitleRule[] = [
  // 个人基本信息下
  { pattern: /身份信息/, level2: Level2Block.IDENTITY_INFO, parentL1: [Level1Block.PERSONAL_INFO] },
  { pattern: /配偶信息/, level2: Level2Block.SPOUSE_INFO, parentL1: [Level1Block.PERSONAL_INFO] },
  { pattern: /居住信息/, level2: Level2Block.RESIDENCE_INFO, parentL1: [Level1Block.PERSONAL_INFO] },
  { pattern: /职业信息/, level2: Level2Block.JOB_INFO, parentL1: [Level1Block.PERSONAL_INFO] },
  // 信息概要下
  { pattern: /信贷交易信息提示/, level2: Level2Block.CREDIT_HINT, parentL1: [Level1Block.INFO_SUMMARY] },
  { pattern: /信贷交易授信及负债信息概要/, level2: Level2Block.DEBT_SUMMARY, parentL1: [Level1Block.INFO_SUMMARY] },
  { pattern: /查询记录概要/, level2: Level2Block.QUERY_SUMMARY, parentL1: [Level1Block.INFO_SUMMARY] },
  // 信贷交易明细下
  { pattern: /非循环贷账户$/, level2: Level2Block.NON_REVOLVING_LOAN, parentL1: [Level1Block.CREDIT_DETAIL] },
  { pattern: /循环贷账户一/, level2: Level2Block.REVOLVING_LOAN_TYPE1, parentL1: [Level1Block.CREDIT_DETAIL] },
  { pattern: /循环贷账户二/, level2: Level2Block.REVOLVING_LOAN_TYPE2, parentL1: [Level1Block.CREDIT_DETAIL] },
  { pattern: /贷记卡账户$/, level2: Level2Block.CREDIT_CARD, parentL1: [Level1Block.CREDIT_DETAIL] },
  { pattern: /相关还款责任信息$/, level2: Level2Block.REPAY_RESPONSIBILITY, parentL1: [Level1Block.CREDIT_DETAIL] },
  { pattern: /授信协议信息/, level2: Level2Block.CREDIT_AGREEMENT, parentL1: [Level1Block.CREDIT_DETAIL] },
  // 查询记录下
  { pattern: /机构查询记录明细/, level2: Level2Block.ORG_QUERY, parentL1: [Level1Block.QUERY_RECORD] },
  { pattern: /本人查询记录明细/, level2: Level2Block.SELF_QUERY, parentL1: [Level1Block.QUERY_RECORD] },
  // 异议信息（可出现在报告头区域，不限定 parentL1）
  { pattern: /^异议信息提示$/, level2: Level2Block.DISPUTE_INFO },
];

/** 账户标题正则：匹配 "账户1"、"账户3（授信协议标识：...）" 等 */
const ACCOUNT_PATTERN = /^账户[0-9]+/;

/** 页码噪声正则：匹配 "第N页，共N页" / "第N页。共N页" */
const PAGE_NOISE_PATTERN = /^第[0-9]+页[，。,.]共[0-9]+页/;

/** 一级区块的固定顺序（征信报告结构） */
const L1_ORDER: Level1Block[] = [
  Level1Block.REPORT_HEADER,
  Level1Block.PERSONAL_INFO,
  Level1Block.INFO_SUMMARY,
  Level1Block.CREDIT_DETAIL,
  Level1Block.QUERY_RECORD,
  Level1Block.REPORT_NOTE,
];

/** 二级区块到所属一级区块的映射 */
const L2_PARENT: Partial<Record<Level2Block, Level1Block>> = {
  [Level2Block.IDENTITY_INFO]: Level1Block.PERSONAL_INFO,
  [Level2Block.SPOUSE_INFO]: Level1Block.PERSONAL_INFO,
  [Level2Block.RESIDENCE_INFO]: Level1Block.PERSONAL_INFO,
  [Level2Block.JOB_INFO]: Level1Block.PERSONAL_INFO,
  [Level2Block.CREDIT_HINT]: Level1Block.INFO_SUMMARY,
  [Level2Block.DEBT_SUMMARY]: Level1Block.INFO_SUMMARY,
  [Level2Block.QUERY_SUMMARY]: Level1Block.INFO_SUMMARY,
  [Level2Block.NON_REVOLVING_LOAN]: Level1Block.CREDIT_DETAIL,
  [Level2Block.REVOLVING_LOAN_TYPE1]: Level1Block.CREDIT_DETAIL,
  [Level2Block.REVOLVING_LOAN_TYPE2]: Level1Block.CREDIT_DETAIL,
  [Level2Block.CREDIT_CARD]: Level1Block.CREDIT_DETAIL,
  [Level2Block.REPAY_RESPONSIBILITY]: Level1Block.CREDIT_DETAIL,
  [Level2Block.CREDIT_AGREEMENT]: Level1Block.CREDIT_DETAIL,
  [Level2Block.ORG_QUERY]: Level1Block.QUERY_RECORD,
  [Level2Block.SELF_QUERY]: Level1Block.QUERY_RECORD,
};

// ============================================================
// 核心识别逻辑
// ============================================================

/** 从 OCR 文本行数组识别所有区块边界（容错：不依赖标题出现顺序） */
export function recognizeBlocks(lines: string[]): BlockMap {
  // 第一遍：收集所有锚点
  const anchors = collectAnchors(lines);
  // 第二遍：按固定结构排序锚点，切分区块
  return buildBlockMap(lines, anchors);
}

// ============================================================
// 第一遍：锚点收集
// ============================================================

interface Anchor {
  line: number;
  level1?: Level1Block;
  level2?: Level2Block;
  accountLabel?: string;
}

/** 全文扫描，收集所有标题锚点（不依赖出现顺序） */
function collectAnchors(lines: string[]): Anchor[] {
  const anchors: Anchor[] = [];
  const seenL1 = new Set<Level1Block>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '' || PAGE_NOISE_PATTERN.test(line)) continue;

    const isShortLine = line.length <= MAX_TITLE_LINE_LENGTH;

    if (isShortLine) {
      const l1Match = matchTitleNoParent(line, LEVEL1_RULES);
      if (l1Match?.level1 && !seenL1.has(l1Match.level1)) {
        seenL1.add(l1Match.level1);
        anchors.push({ line: i, level1: l1Match.level1 });
        continue;
      }
    }

    // L2 不去重：同一类型可能在正文中被误匹配，后续 buildBlockMap 会过滤
    if (isShortLine) {
      const l2Match = matchTitleNoParent(line, LEVEL2_RULES);
      if (l2Match?.level2) {
        anchors.push({ line: i, level2: l2Match.level2 });
        continue;
      }
    }

    if (ACCOUNT_PATTERN.test(line)) {
      anchors.push({ line: i, accountLabel: line });
    }
  }

  return anchors;
}

// ============================================================
// 第二遍：按固定结构排序 + 切分区块
// ============================================================

/** 根据锚点构建 BlockMap */
function buildBlockMap(lines: string[], anchors: Anchor[]): BlockMap {
  const result: BlockMap = { level1: {}, level2: {}, accounts: [] };
  const lastLine = lines.length - 1;

  const l1Anchors = anchors.filter((a) => a.level1);
  const l2Anchors = anchors.filter((a) => a.level2);
  const accountAnchors = anchors.filter((a) => a.accountLabel);

  // 按征信报告固定结构排序一级锚点
  l1Anchors.sort((a, b) => {
    const ia = L1_ORDER.indexOf(a.level1!);
    const ib = L1_ORDER.indexOf(b.level1!);
    return ia - ib;
  });

  // 报告头：从第 0 行到第一个一级标题前
  const firstL1Line = l1Anchors.length > 0 ? l1Anchors[0].line : lastLine;
  result.level1[Level1Block.REPORT_HEADER] = {
    startLine: 0,
    endLine: Math.max(firstL1Line - 1, 0),
  };

  // 切分一级区块
  for (let i = 0; i < l1Anchors.length; i++) {
    const curr = l1Anchors[i];
    const nextStart = l1Anchors[i + 1]?.line ?? lastLine + 1;
    result.level1[curr.level1!] = {
      startLine: curr.line,
      endLine: nextStart - 1,
    };
  }

  // 过滤 L2 锚点：只保留落在所属 L1 范围内的，同类型取第一个
  const validL2 = filterL2Anchors(l2Anchors, result.level1);

  // 切分二级区块：按行号排序，限定在所属一级区块范围内
  validL2.sort((a, b) => a.line - b.line);
  for (let i = 0; i < validL2.length; i++) {
    const curr = validL2[i];
    const parentL1 = L2_PARENT[curr.level2!];
    const parentRange = parentL1 ? result.level1[parentL1] : null;

    // 默认结束行：有 parent 用 parent 的 endLine，无 parent 用下一个任意 L2 截断
    let endLine = parentRange?.endLine ?? lastLine;
    for (let j = i + 1; j < validL2.length; j++) {
      const next = validL2[j];
      const nextParent = L2_PARENT[next.level2!];
      // 有 parent：找同 parent 的下一个 L2 截断
      // 无 parent：找任意下一个 L2 截断
      if (parentL1 ? nextParent === parentL1 : true) {
        endLine = next.line - 1;
        break;
      }
    }

    result.level2[curr.level2!] = { startLine: curr.line, endLine };
  }

  // 切分账户区块：根据行号找到所属二级区块
  for (let i = 0; i < accountAnchors.length; i++) {
    const curr = accountAnchors[i];
    const nextStart = accountAnchors[i + 1]?.line ?? lastLine + 1;
    const parentL2 = findParentL2(curr.line, result.level2);

    if (parentL2 && isAccountContext(parentL2)) {
      result.accounts.push({
        parentBlock: parentL2,
        label: curr.accountLabel!,
        range: { startLine: curr.line, endLine: nextStart - 1 },
      });
    }
  }

  return result;
}

/** 根据行号找到所属的二级区块 */
function findParentL2(
  line: number, l2Map: Partial<Record<Level2Block, BlockRange>>,
): Level2Block | null {
  for (const [key, range] of Object.entries(l2Map)) {
    if (range && line >= range.startLine && line <= range.endLine) {
      return key as Level2Block;
    }
  }
  return null;
}

/** 过滤 L2 锚点：只保留落在所属 L1 范围内的，同类型取第一个 */
function filterL2Anchors(
  l2Anchors: Anchor[],
  l1Map: Partial<Record<Level1Block, BlockRange>>,
): Anchor[] {
  const seen = new Set<Level2Block>();
  const result: Anchor[] = [];

  for (const anchor of l2Anchors) {
    const l2 = anchor.level2!;
    if (seen.has(l2)) continue;

    const parentL1 = L2_PARENT[l2];
    if (parentL1) {
      const parentRange = l1Map[parentL1];
      if (!parentRange) continue;
      if (anchor.line < parentRange.startLine || anchor.line > parentRange.endLine) {
        continue;
      }
    }

    seen.add(l2);
    result.push(anchor);
  }
  return result;
}
// ============================================================
// 辅助函数
// ============================================================

/** 匹配标题规则（忽略 parentL1 约束，用于第一遍锚点收集） */
function matchTitleNoParent(line: string, rules: TitleRule[]): TitleRule | null {
  const cleaned = line
    .replace(/^[一二三四五六七八九十]+/, '')
    .replace(/^\([一二三四五六七八九十]+\)/, '')
    .trim();

  for (const rule of rules) {
    if (rule.pattern.test(cleaned) || rule.pattern.test(line)) return rule;
  }
  return null;
}

/** 当前二级区块是否允许出现账户标题 */
function isAccountContext(l2: Level2Block | null): boolean {
  if (!l2) return false;
  const accountBlocks: Level2Block[] = [
    Level2Block.NON_REVOLVING_LOAN,
    Level2Block.REVOLVING_LOAN_TYPE1,
    Level2Block.REVOLVING_LOAN_TYPE2,
    Level2Block.CREDIT_CARD,
  ];
  return accountBlocks.includes(l2);
}

// ============================================================
// 工具函数：从 BlockMap 中提取指定区块的文本行
// ============================================================

/** 获取指定区块范围内的文本行 */
export function getBlockLines(lines: string[], range: BlockRange): string[] {
  return lines.slice(range.startLine, range.endLine + 1);
}

/** 获取指定一级区块的文本行 */
export function getLevel1Lines(
  lines: string[],
  blockMap: BlockMap,
  block: Level1Block,
): string[] | null {
  const range = blockMap.level1[block];
  return range ? getBlockLines(lines, range) : null;
}

/** 获取指定二级区块的文本行 */
export function getLevel2Lines(
  lines: string[],
  blockMap: BlockMap,
  block: Level2Block,
): string[] | null {
  const range = blockMap.level2[block];
  return range ? getBlockLines(lines, range) : null;
}