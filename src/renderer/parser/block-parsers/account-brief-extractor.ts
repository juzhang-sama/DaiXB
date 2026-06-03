/**
 * 从 DocParser 表格提取每个账户的简要信息 — 用于账户明细 Tab 展示
 *
 * 使用精确分类替代关键词匹配，避免子串交叉污染
 */

import type { AccountBrief } from '../../types/credit-report';
import type { ContextTable } from '../doc-table-bridge';
import { groupAccountTables, type AccountCategory } from '../doc-table-bridge';
import { getRowValues } from '../markdown-table-parser';

/** 类别中文标签映射 */
const CATEGORY_LABELS: Record<AccountCategory, string> = {
  nonRevolvingLoan: '非循环贷账户',
  revolvingLoan1: '循环贷账户一',
  revolvingLoan2: '循环贷账户二',
  creditCard: '贷记卡账户',
  repayResponsibility: '相关还款责任信息',
  creditAgreement: '授信协议信息',
};

/** 从所有 DocParser 表格提取账户简要列表 */
export function extractAccountBriefs(docTables: ContextTable[]): AccountBrief[] {
  if (!docTables?.length) return [];

  const briefs: AccountBrief[] = [];
  const groups = groupAccountTables(docTables);

  for (const category of Object.keys(groups) as AccountCategory[]) {
    const tables = groups[category];
    const isCard = category === 'creditCard';
    const label = CATEGORY_LABELS[category];

    for (const ct of tables) {
      briefs.push(extractBriefFromTable(ct, category, label, isCard));
    }
  }

  return briefs;
}

/** 从单个 DocParser 表格提取一条账户简要 */
function extractBriefFromTable(
  ct: ContextTable, category: string, categoryLabel: string, isCreditCard: boolean,
): AccountBrief {
  const t = ct.table;

  const orgVals = getRowValues(t, isCreditCard ? '发卡机构' : '管理机构');
  const org = orgVals[0]?.trim() ?? '';

  const openDateVals = getRowValues(t, '开立日期');
  const openDate = openDateVals[0]?.trim() ?? '';

  const statusVals = getRowValues(t, '账户状态');
  const status = statusVals[0]?.trim() ?? '';
  const isClosed = statusVals.some((s) => /结清|销户/.test(s));

  const creditLabel = isCreditCard ? '授信额度' : '借款金额';
  const balanceLabel = isCreditCard ? '已用额度' : '余额';

  const creditAmount = parseDocNum(getRowValues(t, creditLabel)[0]);
  const balance = parseDocNum(getRowValues(t, balanceLabel)[0]);
  const monthlyPayment = isClosed ? 0 : parseDocNum(getRowValues(t, '本月应还款')[0]);

  return {
    category, categoryLabel, org, openDate,
    creditAmount, balance, monthlyPayment, status, isClosed,
  };
}

/** 解析文档解析返回的数值字符串 */
function parseDocNum(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.trim().replace(/,/g, '').replace(/--/g, '0');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

