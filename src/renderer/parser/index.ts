/**
 * 征信报告解析引擎入口（v2 — 基于区块识别器）
 *
 * 流程：fullText → 按行分割 → recognizeBlocks → 各区块解析器 → ClientProfile
 * 可选接收 RebuiltTable（旧路径）或 DocParserResult（新路径）
 */

import { ClientProfile, ConfidenceMap } from '../types/client-profile';
import { CreditReport, AccountDerivedMap, createEmptyCreditReport } from '../types/credit-report';
import { recognizeBlocks, getLevel1Lines } from './block-recognizer';
import { Level1Block } from './block-types';
import { parseHeader } from './block-parsers/header-parser';
import { parseIdentity, parseLatestCompany } from './block-parsers/identity-parser';
import { aggregateAccountOverdue } from './block-parsers/account-overdue-parser';
import { computeSummaryFromAccounts, type AccountDerivedSummary } from './block-parsers/summary-from-accounts';
import { extractAccountBriefs } from './block-parsers/account-brief-extractor';
import { parseNonRevolvingLoans } from './block-parsers/non-revolving-loan-parser';
import { parseRevolvingLoans1 } from './block-parsers/revolving-loan1-parser';
import { parseRevolvingLoans2 } from './block-parsers/revolving-loan2-parser';
import { parseCreditCards } from './block-parsers/credit-card-parser';
import { parseRepayResponsibilities } from './block-parsers/repay-responsibility-parser';
import { parseCreditAgreements } from './block-parsers/credit-agreement-parser';
import { parseQueryRecords } from './block-parsers/query-record-parser';
import { buildClientProfile } from './block-parsers/profile-bridge';
import type { RebuiltTable } from './table-rebuilder';
import type { DocParserResult } from '../../shared/doc-parser-types';
import { extractTablesFromDoc, groupAccountTables, type ContextTable } from './doc-table-bridge';
import { classifyTables } from './table-classifier';
import { scanLevel1Sections, scanLevel2CreditSections } from './section-locator';
import { countAllSectionAccounts } from './section-search';

export interface ParseResult {
  profile: ClientProfile;
  confidence: ConfidenceMap;
  report: CreditReport;
  debugBlockMap?: import('./block-types').BlockMap;
}

/**
 * 征信报告解析引擎入口
 * 接收全文文本 + 可选的结构化表格（旧路径）或文档解析结果（新路径）
 */
export function parseCreditReport(
  fullText: string, table?: RebuiltTable, docResult?: DocParserResult,
): ParseResult {
  const lines = fullText.split('\n');
  const blockMap = recognizeBlocks(lines);

  // 提取文档解析的结构化表格（新路径）
  const docTables = docResult ? extractTablesFromDoc(docResult) : [];
  const classified = docTables.length > 0 ? classifyTables(docTables) : null;

  // 扫描一级/二级模块位置（新路径）
  let sectionCounts: ReturnType<typeof countAllSectionAccounts> | null = null;
  if (docResult) {
    scanLevel1Sections(docResult);
    scanLevel2CreditSections(docResult);
    // 新方案：基于关键词搜索统计账户数量
    sectionCounts = countAllSectionAccounts(docResult);
  }

  // 各区块解析
  const headerLines = getLevel1Lines(lines, blockMap, Level1Block.REPORT_HEADER) ?? [];
  const personalLines = getLevel1Lines(lines, blockMap, Level1Block.PERSONAL_INFO) ?? [];

  const header = parseHeader(headerLines, classified?.header);
  const identity = parseIdentity(personalLines, classified?.identity);
  const latestCompany = parseLatestCompany(personalLines, classified?.job);
  const accountOverdue = aggregateAccountOverdue(lines, blockMap.accounts, table, docTables);
  const creditAccountTables = classified?.creditAccount ?? [];
  const accountDerived = computeSummaryFromAccounts(lines, blockMap.accounts, table, creditAccountTables);

  // 按账户类型分组（用于明细提取）
  const accountGroups = creditAccountTables.length > 0
    ? groupAccountTables(creditAccountTables) : null;

  // 组装完整征信报告对象
  const report = createEmptyCreditReport();
  report.header = header;
  report.personalInfo.identity = identity;
  report.accountDerived = convertDerivedMap(accountDerived);
  report.accountBriefs = extractAccountBriefs(creditAccountTables);

  // 从分组表格提取账户明细
  if (accountGroups) {
    report.creditDetail.nonRevolvingLoans = parseNonRevolvingLoans(accountGroups.nonRevolvingLoan);
    report.creditDetail.revolvingLoansType1 = parseRevolvingLoans1(accountGroups.revolvingLoan1);
    report.creditDetail.revolvingLoansType2 = parseRevolvingLoans2(accountGroups.revolvingLoan2);
    report.creditDetail.creditCards = parseCreditCards(accountGroups.creditCard);
    report.repayResponsibilities = parseRepayResponsibilities(accountGroups.repayResponsibility);
  }

  // 授信协议从 classified 桶直接解析（不走 groupAccountTables）
  if (classified) {
    report.creditAgreements = parseCreditAgreements(classified.creditAgreement);
    const queryResult = parseQueryRecords(classified.queryDetail, classified.unclassified);
    report.queryRecord = queryResult;
  }

  // 用新方案的账户数量覆盖 accountDerived 中的 accountCount
  if (sectionCounts) {
    const emptyDerived = { orgCount: 0, accountCount: 0, totalCredit: 0, balance: 0, monthlyPayment: 0 };

    if (!report.accountDerived.nonRevolvingLoan) {
      report.accountDerived.nonRevolvingLoan = { ...emptyDerived };
    }
    report.accountDerived.nonRevolvingLoan.accountCount = sectionCounts.nonRevolvingLoan;

    if (!report.accountDerived.revolvingLoan1) {
      report.accountDerived.revolvingLoan1 = { ...emptyDerived };
    }
    report.accountDerived.revolvingLoan1.accountCount = sectionCounts.revolvingLoan1;

    if (!report.accountDerived.revolvingLoan2) {
      report.accountDerived.revolvingLoan2 = { ...emptyDerived };
    }
    report.accountDerived.revolvingLoan2.accountCount = sectionCounts.revolvingLoan2;

    if (!report.accountDerived.creditCard) {
      report.accountDerived.creditCard = { ...emptyDerived };
    }
    report.accountDerived.creditCard.accountCount = sectionCounts.creditCard;
  }

  // 构建 ClientProfile（从账户明细反算 + 查询记录明细）
  const profile = buildClientProfile({
    header, identity, latestCompany, accountOverdue,
    accountDerived: accountDerived,
    queryRecord: report.queryRecord,
  });

  const confidence = buildConfidence(profile, accountDerived);
  return { profile, confidence, report, debugBlockMap: blockMap };
}

/** 将解析器的 Record<string, AccountDerivedSummary> 转为类型安全的 AccountDerivedMap */
function convertDerivedMap(raw: Record<string, AccountDerivedSummary>): AccountDerivedMap {
  return {
    nonRevolvingLoan: raw['nonRevolvingLoan'],
    revolvingLoan1: raw['revolvingLoan1'],
    revolvingLoan2: raw['revolvingLoan2'],
    creditCard: raw['creditCard'],
  };
}

/** 置信度计算 — 全部基于账户明细反算值，不再依赖 OCR 概要 */
function buildConfidence(
  profile: ClientProfile,
  derived?: Record<string, AccountDerivedSummary>,
): ConfidenceMap {
  const conf: ConfidenceMap = {};
  for (const key of Object.keys(profile) as (keyof ClientProfile)[]) {
    const val = profile[key];
    if (val === null || val === undefined || val === '') {
      conf[key] = 0;
      continue;
    }
    conf[key] = getFieldConfidence(key, derived);
  }
  return conf;
}

/** 按字段类型返回置信度 */
function getFieldConfidence(
  key: keyof ClientProfile,
  derived?: Record<string, AccountDerivedSummary>,
): number {
  if (['name', 'idCard', 'age', 'marriage', 'company'].includes(key)) return 0.90;
  if (['q1m', 'q2m', 'q6m'].includes(key)) return 0.75;
  if (['overdueCurrent', 'overdueHistory'].includes(key)) return 0.80;
  if (['totalCreditLimit', 'usedCreditLimit'].includes(key)) return derived?.creditCard ? 0.80 : 0.60;
  if (key === 'monthlyRepayment') return derived ? 0.75 : 0.60;
  return 0.65;
}
