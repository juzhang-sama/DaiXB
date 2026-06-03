/**
 * 区块识别器的类型定义
 *
 * 区块 = OCR 文本中一段连续的行，对应征信报告的某个模块/子模块。
 * 识别器只负责切割边界，不负责提取值。
 */

/** 一级区块标识 */
export const enum Level1Block {
  REPORT_HEADER = 'REPORT_HEADER',
  PERSONAL_INFO = 'PERSONAL_INFO',
  INFO_SUMMARY = 'INFO_SUMMARY',
  CREDIT_DETAIL = 'CREDIT_DETAIL',
  QUERY_RECORD = 'QUERY_RECORD',
  REPORT_NOTE = 'REPORT_NOTE',
}

/** 二级区块标识 */
export const enum Level2Block {
  // 个人基本信息下
  IDENTITY_INFO = 'IDENTITY_INFO',
  SPOUSE_INFO = 'SPOUSE_INFO',
  RESIDENCE_INFO = 'RESIDENCE_INFO',
  JOB_INFO = 'JOB_INFO',
  PHONE_INFO = 'PHONE_INFO',

  // 信息概要下
  CREDIT_HINT = 'CREDIT_HINT',
  DEBT_SUMMARY = 'DEBT_SUMMARY',
  QUERY_SUMMARY = 'QUERY_SUMMARY',

  // 信贷交易信息明细下
  NON_REVOLVING_LOAN = 'NON_REVOLVING_LOAN',
  REVOLVING_LOAN_TYPE1 = 'REVOLVING_LOAN_TYPE1',
  REVOLVING_LOAN_TYPE2 = 'REVOLVING_LOAN_TYPE2',
  CREDIT_CARD = 'CREDIT_CARD',
  REPAY_RESPONSIBILITY = 'REPAY_RESPONSIBILITY',
  CREDIT_AGREEMENT = 'CREDIT_AGREEMENT',

  // 查询记录下
  ORG_QUERY = 'ORG_QUERY',
  SELF_QUERY = 'SELF_QUERY',

  // 报告尾部
  DISPUTE_INFO = 'DISPUTE_INFO',
}

/** 区块的行号范围（0-based，闭区间） */
export interface BlockRange {
  startLine: number;
  endLine: number;
}

/** 区块识别结果 */
export interface BlockMap {
  /** 一级区块 */
  level1: Partial<Record<Level1Block, BlockRange>>;
  /** 二级区块 */
  level2: Partial<Record<Level2Block, BlockRange>>;
  /** 账户级区块（信贷明细中的每个账户） */
  accounts: AccountBlock[];
}

/** 单个账户区块 */
export interface AccountBlock {
  /** 所属二级区块 */
  parentBlock: Level2Block;
  /** 账户序号标签（如 "账户1"、"账户3（授信协议标识：...）"） */
  label: string;
  /** 行号范围 */
  range: BlockRange;
}

