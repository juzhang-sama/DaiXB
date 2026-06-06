import type { FieldProvenance } from '../types/credit-report';
import type { ClassifiedTables } from './table-classifier';
import type { AccountCategory, ContextTable } from './doc-table-bridge';

type AccountGroups = Record<AccountCategory, ContextTable[]>;

/** 构建字段/模块溯源映射，帮助人工确认解析值来自哪里 */
export function buildReportProvenance(
  classified: ClassifiedTables | null,
  accountGroups: AccountGroups | null,
): Record<string, FieldProvenance> {
  const result: Record<string, FieldProvenance> = {};
  if (!classified) return result;

  addFromTable(result, 'header', '报告基本信息', classified.header[0]);
  addFromTable(result, 'personalInfo.identity', '身份信息', classified.identity[0]);
  addFromTable(result, 'queryRecord', '查询记录', classified.queryDetail[0]);
  addFromTable(result, 'creditAgreements', '授信协议信息', classified.creditAgreement[0]);

  if (accountGroups) {
    addFromTable(result, 'creditDetail.nonRevolvingLoans', '非循环贷账户', accountGroups.nonRevolvingLoan[0]);
    addFromTable(result, 'creditDetail.revolvingLoansType1', '循环贷账户一', accountGroups.revolvingLoan1[0]);
    addFromTable(result, 'creditDetail.revolvingLoansType2', '循环贷账户二', accountGroups.revolvingLoan2[0]);
    addFromTable(result, 'creditDetail.creditCards', '贷记卡账户', accountGroups.creditCard[0]);
    addFromTable(result, 'repayResponsibilities', '相关还款责任信息', accountGroups.repayResponsibility[0]);

    addDerived(result, 'accountDerived.nonRevolvingLoan', '非循环贷汇总反算', accountGroups.nonRevolvingLoan[0]);
    addDerived(result, 'accountDerived.revolvingLoan1', '循环贷一汇总反算', accountGroups.revolvingLoan1[0]);
    addDerived(result, 'accountDerived.revolvingLoan2', '循环贷二汇总反算', accountGroups.revolvingLoan2[0]);
    addDerived(result, 'accountDerived.creditCard', '贷记卡汇总反算', accountGroups.creditCard[0]);
    addAccountSources(result, 'creditDetail.nonRevolvingLoans', '非循环贷账户', accountGroups.nonRevolvingLoan);
    addAccountSources(result, 'creditDetail.revolvingLoansType1', '循环贷账户一', accountGroups.revolvingLoan1);
    addAccountSources(result, 'creditDetail.revolvingLoansType2', '循环贷账户二', accountGroups.revolvingLoan2);
    addAccountSources(result, 'creditDetail.creditCards', '贷记卡账户', accountGroups.creditCard);
    addAccountSources(result, 'repayResponsibilities', '相关还款责任', accountGroups.repayResponsibility);
    addAccountSources(result, 'creditAgreements', '授信协议', accountGroups.creditAgreement);
  }

  return result;
}

function addAccountSources(
  result: Record<string, FieldProvenance>,
  listField: string,
  label: string,
  tables: ContextTable[],
): void {
  const sourceTables = tables.filter(isAccountSourceTable);
  sourceTables.forEach((table, index) => {
    addFromTable(result, `${listField}[${index}].org`, `${label}第${index + 1}笔机构`, table);
  });
}

function isAccountSourceTable(table: ContextTable): boolean {
  const headers = table.table.headers.join(' ');
  return headers.includes('管理机构') ||
    headers.includes('发卡机构') ||
    headers.includes('还款责任金额') ||
    headers.includes('授信协议标识');
}

function addFromTable(
  result: Record<string, FieldProvenance>,
  field: string,
  label: string,
  table?: ContextTable,
): void {
  if (!table) return;
  result[field] = {
    field,
    label,
    source: 'doc-table',
    pageNum: table.pageNum,
    logicalPage: table.logicalPage,
    positionY: table.positionY,
    precedingText: table.precedingText,
    confidence: 0.85,
  };
}

function addDerived(
  result: Record<string, FieldProvenance>,
  field: string,
  label: string,
  table?: ContextTable,
): void {
  if (!table) return;
  result[field] = {
    field,
    label,
    source: 'derived',
    pageNum: table.pageNum,
    logicalPage: table.logicalPage,
    positionY: table.positionY,
    precedingText: table.precedingText,
    confidence: 0.8,
  };
}
