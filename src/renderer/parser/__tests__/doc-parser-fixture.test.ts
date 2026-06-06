import assert from 'node:assert/strict';
import type { DocLayout, DocParserResult, DocTable } from '../../../shared/doc-parser-types';
import { parseCreditReport } from '../index';
import { extractTablesFromDoc } from '../doc-table-bridge';
import { classifyTables } from '../table-classifier';
import { evaluateOcrQuality } from '../ocr-quality';
import { computeSummaryFromAccounts } from '../block-parsers/summary-from-accounts';

const fullText = [
  '个人信用报告',
  '报告编号：RPT-001',
  '三 信贷交易信息明细',
  '（五）相关还款责任信息',
  '四 查询记录',
  '机构查询记录明细',
  '报告说明',
].join('\n');

function textLayout(id: string, text: string, y: number): DocLayout {
  return {
    layout_id: id,
    text,
    position: [50, y, 300, 20],
    type: 'para',
    sub_type: '',
    parent: '',
    children: [],
  };
}

function tableLayout(id: string, y: number): DocLayout {
  return {
    layout_id: id,
    text: '',
    position: [50, y, 300, 40],
    type: 'table',
    sub_type: '',
    parent: '',
    children: [],
  };
}

function docTable(id: string, markdown: string, y: number): DocTable {
  return {
    layout_id: id,
    markdown,
    position: [50, y, 300, 40],
    cells: [],
    matrix: [],
    merge_table: '',
  };
}

function createFixtureDoc(): DocParserResult {
  const repayHeader = [
    '| 管理机构 | 业务种类 | 开立日期 | 到期日期 | 责任人类型 | 还款责任金额 | 币种 | 保证合同编号 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ].join('\n');

  const repayData = [
    '| 测试银行股份有限公司 | 个人住房贷款 | 2025.01.01 | 2035.01.01 | 保证人 | 100,000 | 人民币 | HT001 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    '| 主业务借款人 | 主业务借款人证件类型 | 主业务借款人证件号码 |',
    '| 张三 | 身份证 | 110101199001011234 |',
    '| 主业务状态 | 主业务状态 | 主业务状态 |',
    '| 五级分类 | 余额 | 还款状态 |',
    '| 正常 | 80,000 | 正常 |',
  ].join('\n');

  const queryDetail = [
    '| 查询日期 | 查询机构 | 查询原因 |',
    '| --- | --- | --- |',
    '| 2026.05.01 | A银行 | 贷款审批 |',
  ].join('\n');

  return {
    file_name: 'fixture.pdf',
    file_id: 'fixture',
    pages: [{
      page_id: 'page-1',
      page_num: 0,
      text: fullText,
      layouts: [
        textLayout('l-credit-detail', '三 信贷交易信息明细', 80),
        textLayout('l-repay-section', '（五）相关还款责任信息', 120),
        tableLayout('t-repay-header', 140),
        tableLayout('t-repay-data', 180),
        textLayout('l-query-record', '四 查询记录', 300),
        textLayout('l-query-detail', '机构查询记录明细', 330),
        tableLayout('t-query-detail', 360),
      ],
      tables: [
        docTable('t-repay-header', repayHeader, 140),
        docTable('t-repay-data', repayData, 180),
        docTable('t-query-detail', queryDetail, 360),
      ],
      images: [],
      meta: {
        page_width: 842,
        page_height: 1191,
        is_scan: true,
        page_angle: 0,
        page_type: 'normal',
      },
    }],
  };
}

function createCombinedRepayFixtureDoc(): DocParserResult {
  const repayCombined = [
    '| 管理机构 | 业务种类 | 开立日期 | 到期日期 | 责任人类型 | 还款责任金额 | 币种 | 保证合同编号 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    '| 测试银行股份有限公司 | 个人住房贷款 | 2025.01.01 | 2035.01.01 | 保证人 | 100,000 | 人民币 | HT001 |',
    '| 主业务借款人 | 主业务借款人证件类型 | 主业务借款人证件号码 |',
    '| 张三 | 身份证 | 110101199001011234 |',
    '| 主业务状态 | 主业务状态 | 主业务状态 |',
    '| 五级分类 | 余额 | 还款状态 |',
    '| 正常 | 80,000 | 正常 |',
  ].join('\n');

  const queryDetail = [
    '| 编号 | 查询日期 | 查询机构 | 查询原因 |',
    '| --- | --- | --- | --- |',
    '| 1 | 2026.05.01 | A银行 | 贷款审批 |',
  ].join('\n');

  return {
    file_name: 'fixture-combined.pdf',
    file_id: 'fixture-combined',
    pages: [{
      page_id: 'page-1',
      page_num: 0,
      text: fullText,
      layouts: [
        textLayout('l-credit-detail', '三 信贷交易信息明细', 80),
        textLayout('l-repay-section', '（五）相关还款责任信息', 120),
        tableLayout('t-repay-combined', 140),
        textLayout('l-query-record', '四 查询记录', 300),
        textLayout('l-query-detail', '机构查询记录明细', 330),
        tableLayout('t-query-detail', 360),
      ],
      tables: [
        docTable('t-repay-combined', repayCombined, 140),
        docTable('t-query-detail', queryDetail, 360),
      ],
      images: [],
      meta: {
        page_width: 842,
        page_height: 1191,
        is_scan: true,
        page_angle: 0,
        page_type: 'normal',
      },
    }],
  };
}

function createMonthlyFixtureDoc(): DocParserResult {
  const accountTable = [
    '| 账户信息 | 账户信息 | 账户信息 | 账户信息 | 账户信息 | 账户信息 | 账户信息 | 账户信息 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    '| 管理机构 | 借款金额 | 账户状态 | 账户状态 | 余额 | 余额 | 本月应还款 | 本月应还款 |',
    '| 测试银行 | 20,000 | 正常 | 正常 | 11.576 | 11.576 | 706 | 706 |',
  ].join('\n');

  return {
    file_name: 'fixture-monthly.pdf',
    file_id: 'fixture-monthly',
    pages: [{
      page_id: 'page-1',
      page_num: 0,
      text: [
        '个人信用报告',
        '三 信贷交易信息明细',
        '（一）非循环贷账户',
        '账户1',
        '四 查询记录',
      ].join('\n'),
      layouts: [
        textLayout('l-credit-detail', '三 信贷交易信息明细', 80),
        textLayout('l-non-revolving', '（一）非循环贷账户', 100),
        textLayout('l-account-1', '账户1', 120),
        tableLayout('t-account-1', 140),
        textLayout('l-query-record', '四 查询记录', 300),
      ],
      tables: [
        docTable('t-account-1', accountTable, 140),
      ],
      images: [],
      meta: {
        page_width: 842,
        page_height: 1191,
        is_scan: true,
        page_angle: 0,
        page_type: 'normal',
      },
    }],
  };
}

function createBareMonthlyFragmentDoc(): DocParserResult {
  const accountTable = [
    '| 管理机构 | 借款金额 | 账户状态 | 余额 | 本月应还款 | 应还款日 |',
    '| --- | --- | --- | --- | --- | --- |',
    '| 测试银行 | 20,000 | 正常 | 11,576 | 706 | 2026.04.04 |',
  ].join('\n');

  return {
    file_name: 'fragment-account.jpg',
    file_id: 'fragment-account',
    pages: [{
      page_id: 'page-1',
      page_num: 0,
      text: '账户1',
      layouts: [
        textLayout('l-account-1', '账户1', 120),
        tableLayout('t-account-1', 140),
      ],
      tables: [
        docTable('t-account-1', accountTable, 140),
      ],
      images: [],
      meta: {
        page_width: 842,
        page_height: 1191,
        is_scan: true,
        page_angle: 0,
        page_type: 'normal',
      },
    }],
  };
}

function createBareQueryFragmentDoc(): DocParserResult {
  const queryDetail = [
    '| 编号 | 查询日期 | 查询机构 | 查询原因 |',
    '| --- | --- | --- | --- |',
    '| 1 | 2026.05.01 | A银行 | 贷款审批 |',
  ].join('\n');

  return {
    file_name: 'fragment-query.png',
    file_id: 'fragment-query',
    pages: [{
      page_id: 'page-1',
      page_num: 0,
      text: '',
      layouts: [
        tableLayout('t-query-detail', 120),
      ],
      tables: [
        docTable('t-query-detail', queryDetail, 120),
      ],
      images: [],
      meta: {
        page_width: 842,
        page_height: 1191,
        is_scan: true,
        page_angle: 0,
        page_type: 'normal',
      },
    }],
  };
}

const docTables = extractTablesFromDoc(createFixtureDoc());
const classified = classifyTables(docTables);

assert.equal(classified.creditAccount.length, 2);
assert.equal(classified.queryDetail.length, 1);

const parsed = parseCreditReport(fullText, undefined, createFixtureDoc());
const repay = parsed.report.repayResponsibilities[0];

assert.equal(parsed.report.repayResponsibilities.length, 1);
assert.equal(repay.org, '测试银行股份有限公司');
assert.equal(repay.businessType, '个人住房贷款');
assert.equal(repay.openDate, '2025.01.01');
assert.equal(repay.endDate, '2035.01.01');
assert.equal(repay.responsibilityType, '保证人');
assert.equal(repay.responsibilityAmount, 100000);
assert.equal(repay.currency, '人民币');
assert.equal(repay.contractNo, 'HT001');
assert.equal(repay.borrowerName, '张三');
assert.equal(repay.borrowerCertType, '身份证');
assert.equal(repay.borrowerCertNo, '110101199001011234');
assert.equal(repay.balance, 80000);
assert.equal(parsed.report.queryRecord.orgQueries.length, 1);

const combinedParsed = parseCreditReport(fullText, undefined, createCombinedRepayFixtureDoc());
const combinedRepay = combinedParsed.report.repayResponsibilities[0];

assert.equal(combinedParsed.report.repayResponsibilities.length, 1);
assert.equal(combinedRepay.org, '测试银行股份有限公司');
assert.equal(combinedRepay.businessType, '个人住房贷款');
assert.equal(combinedRepay.responsibilityType, '保证人');
assert.equal(combinedRepay.responsibilityAmount, 100000);
assert.equal(combinedRepay.borrowerName, '张三');
assert.equal(combinedRepay.balance, 80000);

const quality = evaluateOcrQuality(createCombinedRepayFixtureDoc());
assert.equal(quality.pages, 1);
assert.equal(quality.tables.count, 2);
assert.equal(quality.anchors.counts['个人信用报告'], 1);
assert.equal(quality.profile, 'pboc-personal-fragment');
assert.equal(quality.scope.type, 'fragment');
assert.ok(quality.scope.recognizedModules.some((item) => item.key === 'repayResponsibility'));
assert.equal(quality.issues.some((issue) => issue.includes('关键锚点')), false);

const monthlyDocTables = extractTablesFromDoc(createMonthlyFixtureDoc());
const monthlyClassified = classifyTables(monthlyDocTables);
const monthlySummary = computeSummaryFromAccounts([], [], undefined, monthlyClassified.creditAccount);

assert.equal(monthlySummary.nonRevolvingLoan.monthlyPayment, 706);
assert.equal(monthlySummary.nonRevolvingLoan.balance, 11576);

const bareMonthlyTables = extractTablesFromDoc(createBareMonthlyFragmentDoc());
const bareMonthlyClassified = classifyTables(bareMonthlyTables);
const bareMonthlySummary = computeSummaryFromAccounts([], [], undefined, bareMonthlyClassified.creditAccount);

assert.equal(bareMonthlyClassified.creditAccount.length, 1);
assert.equal(bareMonthlySummary.nonRevolvingLoan.monthlyPayment, 706);
assert.equal(bareMonthlySummary.nonRevolvingLoan.balance, 11576);

const bareQueryParsed = parseCreditReport('', undefined, createBareQueryFragmentDoc());
const bareQueryQuality = evaluateOcrQuality(createBareQueryFragmentDoc());

assert.equal(bareQueryParsed.report.queryRecord.orgQueries.length, 1);
assert.equal(bareQueryQuality.scope.type, 'fragment');
assert.ok(bareQueryQuality.scope.recognizedModules.some((item) => item.key === 'queryRecord'));
