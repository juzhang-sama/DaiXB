/** 客户征信档案 */
export interface ClientProfile {
  /** 姓名 */
  name: string;
  /** 身份证号 */
  idCard: string;
  /** 年龄 */
  age: number | null;
  /** 婚姻状况 */
  marriage: 'single' | 'married' | 'divorced' | null;
  /** 工作单位 */
  company: string;
  /** 近1个月查询次数 */
  q1m: number | null;
  /** 近2个月查询次数 */
  q2m: number | null;
  /** 近6个月查询次数 */
  q6m: number | null;
  /** 当前是否有逾期 */
  overdueCurrent: boolean | null;
  /** 历史最高逾期等级 (0-7) */
  overdueHistory: number | null;
  /** 信用卡总授信额度 (万元) */
  totalCreditLimit: number | null;
  /** 信用卡已用额度 (万元) */
  usedCreditLimit: number | null;
  /** 贷款月供合计 (元) */
  monthlyRepayment: number | null;
  /** 月收入 (元)，用于计算 DTI */
  monthlyIncome: number | null;
}

/** 各字段的 OCR 识别置信度 (0~1)，null 表示用户手动输入无需校验 */
export type ConfidenceMap = Partial<Record<keyof ClientProfile, number | null>>;

/** 空白置信度，所有字段默认 null */
export const EMPTY_CONFIDENCE: ConfidenceMap = {};

/** OCR 解析结果，包含结构化数据和置信度 */
export interface OcrResult {
  profile: ClientProfile;
  confidence: ConfidenceMap;
  report: import('../types/credit-report').CreditReport;
  quality?: import('../parser/ocr-quality').OcrQualityReport;
  diagnostics?: import('./ocr-diagnostics').OcrDiagnosticsReport;
}

/** 置信度低于此阈值时标记为需人工核对 */
export const CONFIDENCE_THRESHOLD = 0.8;

/** 空白初始状态，用于新建客户档案 */
export const EMPTY_CLIENT_PROFILE: ClientProfile = {
  name: '',
  idCard: '',
  age: null,
  marriage: null,
  company: '',
  q1m: null,
  q2m: null,
  q6m: null,
  overdueCurrent: null,
  overdueHistory: null,
  totalCreditLimit: null,
  usedCreditLimit: null,
  monthlyRepayment: null,
  monthlyIncome: null,
};
