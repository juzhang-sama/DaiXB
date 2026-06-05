/**
 * CreditReport → ClientProfile 桥接
 *
 * 从完整征信报告数据中派生出 UI 表单需要的 13 字段简化模型
 * 数据源：账户明细反算值（accountDerived）+ 查询记录明细统计
 */

import { ClientProfile } from '../../types/client-profile';
import { ReportHeader, QueryRecord } from '../../types/credit-report';
import { IdentityInfo } from '../../types/credit-report';
import { AccountOverdueSummary } from './account-overdue-parser';
import type { AccountDerivedSummary } from './summary-from-accounts';
import { calcAgeAt, getReferenceDate, monthsBefore, parseDateLoose } from '../../utils/date-utils';

/** 桥接所需的解析结果集合 */
export interface ParsedData {
  header: ReportHeader;
  identity: IdentityInfo;
  latestCompany: string;
  accountOverdue: AccountOverdueSummary;
  accountDerived?: Record<string, AccountDerivedSummary>;
  queryRecord?: QueryRecord;
}

/** 从解析结果组装 ClientProfile */
export function buildClientProfile(data: ParsedData): ClientProfile {
  const derived = data.accountDerived;
  const revolving = mergeRevolvingDerived(derived);
  const card = derived?.creditCard;
  const referenceDate = getReferenceDate(data.header.reportTime);

  return {
    name: data.header.name,
    idCard: data.header.certNo,
    age: calcAgeAt(data.identity.birthDate, referenceDate),
    marriage: mapMarriage(data.identity.maritalStatus),
    company: data.latestCompany,
    q1m: countQueriesInMonths(data.queryRecord, 1, referenceDate),
    q2m: countQueriesInMonths(data.queryRecord, 2, referenceDate),
    q6m: countQueriesInMonths(data.queryRecord, 6, referenceDate),
    overdueCurrent: data.accountOverdue.hasCurrentOverdue,
    overdueHistory: data.accountOverdue.maxOverduePeriods,
    totalCreditLimit: yuanToWan(card?.totalCredit ?? 0),
    usedCreditLimit: yuanToWan(card?.balance ?? 0),
    monthlyRepayment: sumMonthlyRepayment(revolving, derived),
    monthlyIncome: null,
  };
}

/** 映射婚姻状况 */
function mapMarriage(status: string | null): 'single' | 'married' | 'divorced' | null {
  if (!status) return null;
  const map: Record<string, 'single' | 'married' | 'divorced'> = {
    '未婚': 'single', '已婚': 'married', '离异': 'divorced', '离婚': 'divorced',
  };
  return map[status] ?? null;
}

/** 计入查询次数的查询原因（排除"贷后管理"） */
const COUNTED_QUERY_REASONS = ['贷款审批', '信用卡审批', '担保资格审查'];

/** 从查询记录明细统计近 N 个月的机构查询次数（仅计审批类查询） */
function countQueriesInMonths(qr: QueryRecord | undefined, months: number, referenceDate: Date): number | null {
  if (!qr) return null;
  const cutoff = monthsBefore(referenceDate, months);
  let count = 0;
  for (const q of qr.orgQueries) {
    if (!COUNTED_QUERY_REASONS.some(r => q.queryReason.includes(r))) continue;
    const d = parseDateLoose(q.queryDate);
    if (d && d >= cutoff) count++;
  }
  return count;
}

/** 合并循环贷一和循环贷二的反算值 */
function mergeRevolvingDerived(
  derived?: Record<string, AccountDerivedSummary>,
): AccountDerivedSummary | undefined {
  if (!derived) return undefined;
  const r1 = derived['revolvingLoan1'];
  const r2 = derived['revolvingLoan2'];
  if (!r1 && !r2) return undefined;
  if (!r1) return r2;
  if (!r2) return r1;
  return {
    orgCount: r1.orgCount + r2.orgCount,
    accountCount: r1.accountCount + r2.accountCount,
    totalCredit: r1.totalCredit + r2.totalCredit,
    balance: r1.balance + r2.balance,
    monthlyPayment: r1.monthlyPayment + r2.monthlyPayment,
  };
}

/** 汇总月供：非循环贷 + 循环贷 + 贷记卡（全部来自账户明细反算） */
function sumMonthlyRepayment(
  revolving?: AccountDerivedSummary,
  derived?: Record<string, AccountDerivedSummary>,
): number {
  const nonRevolving = derived?.nonRevolvingLoan?.monthlyPayment ?? 0;
  const revolvingPayment = revolving?.monthlyPayment ?? 0;
  const creditCard = derived?.creditCard?.monthlyPayment ?? 0;
  return nonRevolving + revolvingPayment + creditCard;
}

/** 元转万元 */
function yuanToWan(yuan: number): number | null {
  if (yuan === 0) return 0;
  return Math.round(yuan / 100) / 100; // 保留两位小数
}
