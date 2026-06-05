import assert from 'node:assert/strict';
import { parseMarkdownTable, getValueByCol, getValuesBelow } from '../markdown-table-parser';
import { recognizeBlocks } from '../block-recognizer';
import { Level1Block, Level2Block } from '../block-types';
import { reorderPages } from '../page-reorder';
import { parseQueryRecords } from '../block-parsers/query-record-parser';

const debtMarkdown = [
  '| 非循环贷账户信息汇总 | 非循环贷账户信息汇总 | 非循环贷账户信息汇总 |',
  '| --- | --- | --- |',
  '| 管理机构数 | 账户数 | 余额 |',
  '| 2 | 3 | 201,667 |',
].join('\n');

const parsedDebt = parseMarkdownTable(debtMarkdown);
assert.equal(getValueByCol(parsedDebt, '账户数'), '3');
assert.deepEqual(getValuesBelow(parsedDebt, '余额'), ['2', '3', '201,667']);

const lines = [
  '个人信用报告',
  '报告编号：R1',
  '一 个人基本信息',
  '身份信息',
  '性别',
  '男',
  '二 信息概要',
  '三 信贷交易信息明细',
  '（一）非循环贷账户',
  '账户1',
  '管理机构',
  '测试银行',
  '四 查询记录',
  '机构查询记录明细',
  '报告说明',
];

const blocks = recognizeBlocks(lines);
assert.deepEqual(blocks.level1[Level1Block.REPORT_HEADER], { startLine: 0, endLine: 1 });
assert.equal(blocks.level1[Level1Block.PERSONAL_INFO]?.startLine, 2);
assert.equal(blocks.level2[Level2Block.IDENTITY_INFO]?.startLine, 3);
assert.equal(blocks.level2[Level2Block.NON_REVOLVING_LOAN]?.startLine, 8);
assert.equal(blocks.accounts.length, 1);
assert.equal(blocks.accounts[0].label, '账户1');

const reordered = reorderPages([
  '第二页内容\n第2页，共2页',
  '第一页内容\n第1页，共2页',
]);
assert.equal(reordered[0].includes('第一页内容'), true);

const queryMarkdown = [
  '| 查询日期 | 查询机构 | 查询原因 |',
  '| --- | --- | --- |',
  '| 2026.05.01 | A银行 | 贷款审批 |',
  '| 2026.04.01 | 本人 | 本人查询 |',
].join('\n');

const queryTable = {
  table: parseMarkdownTable(queryMarkdown),
  pageNum: 0,
  logicalPage: 1,
  positionY: 0,
  precedingText: '机构查询记录明细',
  markdown: queryMarkdown,
};
const query = parseQueryRecords([queryTable], []);
assert.equal(query.orgQueries.length, 1);
assert.equal(query.selfQueries.length, 1);
