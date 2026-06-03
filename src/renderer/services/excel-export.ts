import * as XLSX from 'xlsx';
import { CreditReport } from '../types/credit-report';

/**
 * 将结构化的征信报告数据导出为 Excel 文件
 * 包含多个 Sheet：基本信息、非循环贷、循环贷、贷记卡、查询记录等
 */
export function exportCreditReportToExcel(report: CreditReport, fileName: string = '征信报告数据.xlsx') {
  const wb = XLSX.utils.book_new();

  // 1. 基本信息 Sheet
  const basicInfoData = [
    ['报告编号', report.header.reportNo],
    ['报告时间', report.header.reportTime],
    ['姓名', report.header.name],
    ['证件类型', report.header.certType],
    ['证件号码', report.header.certNo],
    ['查询机构', report.header.queryOrg],
    ['查询原因', report.header.queryReason],
    ['', ''],
    ['身份信息', ''],
    ['性别', report.personalInfo.identity.gender],
    ['出生日期', report.personalInfo.identity.birthDate],
    ['婚姻状况', report.personalInfo.identity.maritalStatus],
    ['手机号码', ''],
    ['单位名称', ''],
    ['居住地址', report.personalInfo.identity.commAddress || ''],
    ['', ''],
    ['信用汇总', ''],
    ['非循环贷账户数', report.accountDerived.nonRevolvingLoan?.accountCount || 0],
    ['循环贷账户数', (report.accountDerived.revolvingLoan1?.accountCount || 0) + (report.accountDerived.revolvingLoan2?.accountCount || 0)],
    ['信用卡账户数', report.accountDerived.creditCard?.accountCount || 0],
    ['逾期账户数', report.summary.overdueSummary?.overdueAccountCount || 0],
  ];
  const wsBasic = XLSX.utils.aoa_to_sheet(basicInfoData);
  XLSX.utils.book_append_sheet(wb, wsBasic, '基本信息');

  // 2. 非循环贷明细 Sheet
  if (report.creditDetail.nonRevolvingLoans.length > 0) {
    const wsData = [
      ['机构名称', '业务种类', '开立日期', '到期日期', '借款金额', '余额', '五级分类', '账户状态', '当前逾期金额'],
      ...report.creditDetail.nonRevolvingLoans.map(loan => [
        loan.org,
        loan.businessType,
        loan.openDate,
        loan.endDate || '',
        loan.loanAmount,
        loan.balance || 0,
        loan.fiveCategory || '',
        loan.status,
        loan.currentOverdueAmount || 0
      ])
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, '非循环贷明细');
  }

  // 3. 循环贷明细 Sheet (合并 Type1 和 Type2)
  const revolvingLoans = [
    ...report.creditDetail.revolvingLoansType1,
    ...report.creditDetail.revolvingLoansType2
  ];
  if (revolvingLoans.length > 0) {
    const wsData = [
      ['机构名称', '业务种类', '开立日期', '到期日期', '授信/借款金额', '余额/已用', '五级分类', '账户状态', '当前逾期金额'],
      ...revolvingLoans.map(loan => {
        // Type1 用 loanAmount, Type2 用 creditLimit，统一展示
        const amount = 'loanAmount' in loan ? loan.loanAmount : (loan as any).creditLimit;
        return [
          loan.org,
          loan.businessType,
          loan.openDate,
          loan.endDate || '',
          amount,
          loan.balance || 0,
          loan.fiveCategory || '',
          loan.status,
          loan.currentOverdueAmount || 0
        ];
      })
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, '循环贷明细');
  }

  // 4. 贷记卡明细 Sheet
  if (report.creditDetail.creditCards.length > 0) {
    const wsData = [
      ['发卡机构', '业务种类', '开立日期', '授信额度', '已用额度', '最近6个月平均使用', '最大使用额度', '账户状态', '当前逾期金额'],
      ...report.creditDetail.creditCards.map(card => [
        card.org,
        card.businessType,
        card.openDate,
        card.creditLimit,
        card.usedAmount || 0,
        card.avgUsed6m || 0,
        card.maxUsed || 0,
        card.status,
        card.currentOverdueAmount || 0
      ])
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, '贷记卡明细');
  }

  // 5. 查询记录 Sheet
  const queries = [
    ...report.queryRecord.orgQueries.map(q => ({ ...q, type: '机构查询' })),
    ...report.queryRecord.selfQueries.map(q => ({ ...q, type: '本人查询' }))
  ];
  if (queries.length > 0) {
    const wsData = [
      ['查询日期', '查询类型', '查询机构', '查询原因'],
      ...queries.map(q => [
        q.queryDate,
        q.type,
        q.queryOrg,
        q.queryReason
      ])
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, '查询记录');
  }

  // 导出文件
  XLSX.writeFile(wb, fileName);
}

