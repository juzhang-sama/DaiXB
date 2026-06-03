import React from 'react';
import { Tabs, Table, Alert, Tag } from 'antd';
import type { CreditReport } from '../../types/credit-report';
import EditableCell from '../EditableCell';

interface CreditDetailTabProps {
  report: CreditReport;
  onChange: (report: CreditReport) => void;
}

const OCR_TIP = '部分数值由 OCR 识别生成，如有不确定建议参考原件。点击数值可修改。';

/**
 * 三、信贷交易信息明细
 * 包含二级章节：非循环贷账户、循环贷账户一、循环贷账户二、贷记卡账户、相关还款责任、授信协议信息
 */
const CreditDetailTab: React.FC<CreditDetailTabProps> = ({ report, onChange }) => {
  const { creditDetail, repayResponsibilities, creditAgreements, accountDerived } = report;

  // 账户数统计
  const accountCounts = {
    nonRevolvingLoan: accountDerived.nonRevolvingLoan?.accountCount ?? creditDetail.nonRevolvingLoans.length,
    revolvingLoan1: accountDerived.revolvingLoan1?.accountCount ?? creditDetail.revolvingLoansType1.length,
    revolvingLoan2: accountDerived.revolvingLoan2?.accountCount ?? creditDetail.revolvingLoansType2.length,
    creditCard: accountDerived.creditCard?.accountCount ?? creditDetail.creditCards.length,
  };

  const renderStatus = (status: string) => {
    const color = status === '正常' ? 'green' : status === '结清' ? 'default' : 'orange';
    return <Tag color={color}>{status}</Tag>;
  };

  const STATUS_FILTERS = [
    { text: '正常', value: '正常' },
    { text: '结清', value: '结清' },
    { text: '销户', value: '销户' },
    { text: '呆账', value: '呆账' },
    { text: '逾期', value: '逾期' },
    { text: '冻结', value: '冻结' },
    { text: '止付', value: '止付' },
  ];

  const statusColumn = {
    title: '账户状态', dataIndex: 'status', key: 'status', width: 80,
    render: renderStatus,
    filters: STATUS_FILTERS,
    onFilter: (value: any, record: any) => record.status === value,
  };

  /** 更新非循环贷某行某字段 */
  const updateNrl = (idx: number, field: string, val: number | null) => {
    const list = [...creditDetail.nonRevolvingLoans];
    list[idx] = { ...list[idx], [field]: val };
    onChange({ ...report, creditDetail: { ...creditDetail, nonRevolvingLoans: list } });
  };

  /** 更新循环贷一某行某字段 */
  const updateRl1 = (idx: number, field: string, val: number | null) => {
    const list = [...creditDetail.revolvingLoansType1];
    list[idx] = { ...list[idx], [field]: val };
    onChange({ ...report, creditDetail: { ...creditDetail, revolvingLoansType1: list } });
  };

  /** 更新循环贷二某行某字段 */
  const updateRl2 = (idx: number, field: string, val: number | null) => {
    const list = [...creditDetail.revolvingLoansType2];
    list[idx] = { ...list[idx], [field]: val };
    onChange({ ...report, creditDetail: { ...creditDetail, revolvingLoansType2: list } });
  };

  /** 更新贷记卡某行某字段 */
  const updateCard = (idx: number, field: string, val: number | null) => {
    const list = [...creditDetail.creditCards];
    list[idx] = { ...list[idx], [field]: val };
    onChange({ ...report, creditDetail: { ...creditDetail, creditCards: list } });
  };

  /** 更新还款责任某行某字段 */
  const updateRepay = (idx: number, field: string, val: number | null) => {
    const list = [...repayResponsibilities];
    list[idx] = { ...list[idx], [field]: val };
    onChange({ ...report, repayResponsibilities: list });
  };

  /** 更新授信协议某行某字段 */
  const updateAgreement = (idx: number, field: string, val: number | null) => {
    const list = [...creditAgreements];
    list[idx] = { ...list[idx], [field]: val };
    onChange({ ...report, creditAgreements: list });
  };

  /** 生成可编辑数值列的 render */
  const editableNum = (field: string, updater: (i: number, f: string, v: number | null) => void) =>
    (v: number | null, _rec: any, idx: number) => (
      <EditableCell
        value={v ?? 0} type="number"
        onChange={(nv) => updater(idx, field, Number(nv))}
      />
    );

  const items = [
    {
      key: 'nonRevolvingLoan',
      label: `(一) 非循环贷账户 (${accountCounts.nonRevolvingLoan})`,
      children: (
        <>
          <Alert title={OCR_TIP} type="info" showIcon style={{ marginBottom: 8 }} />
          <Table
            dataSource={creditDetail.nonRevolvingLoans.map((a, i) => ({ ...a, key: i }))}
            columns={[
              { title: '管理机构', dataIndex: 'org', key: 'org', width: 180, fixed: 'left' as const },
              { title: '借款金额', dataIndex: 'loanAmount', key: 'loanAmount', width: 90, render: editableNum('loanAmount', updateNrl) },
              { title: '业务种类', dataIndex: 'businessType', key: 'businessType', width: 130 },
              { title: '担保方式', dataIndex: 'guaranteeType', key: 'guaranteeType', width: 100 },
              { title: '还款期数', dataIndex: 'termCount', key: 'termCount', width: 80 },
              { title: '还款方式', dataIndex: 'repayMethod', key: 'repayMethod', width: 110 },
              statusColumn,
              { title: '余额', dataIndex: 'balance', key: 'balance', width: 90, render: editableNum('balance', updateNrl) },
              { title: '剩余期数', dataIndex: 'remainTerms', key: 'remainTerms', width: 80, render: (v: number | null) => v ?? '-' },
              { title: '本月应还', dataIndex: 'monthlyPayment', key: 'monthlyPayment', width: 90, render: editableNum('monthlyPayment', updateNrl) },
              { title: '应还款日', dataIndex: 'paymentDueDate', key: 'paymentDueDate', width: 100, render: (v: string | null) => v ?? '-' },
              { title: '本月实还', dataIndex: 'actualPayment', key: 'actualPayment', width: 90, render: editableNum('actualPayment', updateNrl) },
              { title: '逾期期数', dataIndex: 'currentOverdueCount', key: 'currentOverdueCount', width: 80, render: (v: number | null) => v ?? '-' },
              { title: '逾期总额', dataIndex: 'currentOverdueAmount', key: 'currentOverdueAmount', width: 90, render: editableNum('currentOverdueAmount', updateNrl) },
            ]}
            size="small"
            pagination={false}
            scroll={{ x: 1600 }}
            sticky
            locale={{ emptyText: '暂无非循环贷账户数据' }}
          />
        </>
      ),
    },
    {
      key: 'revolvingLoan1',
      label: `(二) 循环贷账户一 (${accountCounts.revolvingLoan1})`,
      children: (
        <>
          <Alert title={OCR_TIP} type="info" showIcon style={{ marginBottom: 8 }} />
          <Table
            dataSource={creditDetail.revolvingLoansType1.map((a, i) => ({ ...a, key: i }))}
            columns={[
              { title: '管理机构', dataIndex: 'org', key: 'org', width: 180, fixed: 'left' as const },
              { title: '借款金额', dataIndex: 'loanAmount', key: 'loanAmount', width: 90, render: editableNum('loanAmount', updateRl1) },
              { title: '业务种类', dataIndex: 'businessType', key: 'businessType', width: 130 },
              { title: '担保方式', dataIndex: 'guaranteeType', key: 'guaranteeType', width: 100 },
              { title: '还款期数', dataIndex: 'termCount', key: 'termCount', width: 80 },
              { title: '还款方式', dataIndex: 'repayMethod', key: 'repayMethod', width: 110 },
              statusColumn,
              { title: '余额', dataIndex: 'balance', key: 'balance', width: 90, render: editableNum('balance', updateRl1) },
              { title: '剩余期数', dataIndex: 'remainTerms', key: 'remainTerms', width: 80, render: (v: number | null) => v ?? '-' },
              { title: '本月应还', dataIndex: 'monthlyPayment', key: 'monthlyPayment', width: 90, render: editableNum('monthlyPayment', updateRl1) },
              { title: '应还款日', dataIndex: 'paymentDueDate', key: 'paymentDueDate', width: 100, render: (v: string | null) => v ?? '-' },
              { title: '本月实还', dataIndex: 'actualPayment', key: 'actualPayment', width: 90, render: editableNum('actualPayment', updateRl1) },
              { title: '逾期期数', dataIndex: 'currentOverdueCount', key: 'currentOverdueCount', width: 80, render: (v: number | null) => v ?? '-' },
              { title: '逾期总额', dataIndex: 'currentOverdueAmount', key: 'currentOverdueAmount', width: 90, render: editableNum('currentOverdueAmount', updateRl1) },
            ]}
            size="small"
            pagination={false}
            scroll={{ x: 1600 }}
            sticky
            locale={{ emptyText: '暂无循环贷账户一数据' }}
          />
        </>
      ),
    },
    {
      key: 'revolvingLoan2',
      label: `(三) 循环贷账户二 (${accountCounts.revolvingLoan2})`,
      children: (
        <>
          <Alert title={OCR_TIP} type="info" showIcon style={{ marginBottom: 8 }} />
          <Table
            dataSource={creditDetail.revolvingLoansType2.map((a, i) => ({ ...a, key: i }))}
            columns={[
              { title: '管理机构', dataIndex: 'org', key: 'org', width: 180, fixed: 'left' as const },
              { title: '授信额度', dataIndex: 'creditLimit', key: 'creditLimit', width: 90, render: editableNum('creditLimit', updateRl2) },
              { title: '业务种类', dataIndex: 'businessType', key: 'businessType', width: 130 },
              { title: '担保方式', dataIndex: 'guaranteeType', key: 'guaranteeType', width: 100 },
              { title: '还款期数', dataIndex: 'termCount', key: 'termCount', width: 80 },
              { title: '还款方式', dataIndex: 'repayMethod', key: 'repayMethod', width: 110 },
              statusColumn,
              { title: '余额', dataIndex: 'balance', key: 'balance', width: 90, render: editableNum('balance', updateRl2) },
              { title: '剩余期数', dataIndex: 'remainTerms', key: 'remainTerms', width: 80, render: (v: number | null) => v ?? '-' },
              { title: '本月应还', dataIndex: 'monthlyPayment', key: 'monthlyPayment', width: 90, render: editableNum('monthlyPayment', updateRl2) },
              { title: '应还款日', dataIndex: 'paymentDueDate', key: 'paymentDueDate', width: 100, render: (v: string | null) => v ?? '-' },
              { title: '本月实还', dataIndex: 'actualPayment', key: 'actualPayment', width: 90, render: editableNum('actualPayment', updateRl2) },
              { title: '逾期期数', dataIndex: 'currentOverdueCount', key: 'currentOverdueCount', width: 80, render: (v: number | null) => v ?? '-' },
              { title: '逾期总额', dataIndex: 'currentOverdueAmount', key: 'currentOverdueAmount', width: 90, render: editableNum('currentOverdueAmount', updateRl2) },
            ]}
            size="small"
            pagination={false}
            scroll={{ x: 1600 }}
            sticky
            locale={{ emptyText: '暂无循环贷账户二数据' }}
          />
        </>
      ),
    },
    {
      key: 'creditCard',
      label: `(四) 贷记卡账户 (${accountCounts.creditCard})`,
      children: (
        <>
          <Alert title={OCR_TIP} type="info" showIcon style={{ marginBottom: 8 }} />
          <Table
            dataSource={creditDetail.creditCards.map((a, i) => ({ ...a, key: i }))}
            columns={[
              { title: '发卡机构', dataIndex: 'org', key: 'org', width: 220, fixed: 'left' as const },
              { title: '账户授信额度', dataIndex: 'creditLimit', key: 'creditLimit', width: 120, render: editableNum('creditLimit', updateCard) },
              statusColumn,
              { title: '已用额度', dataIndex: 'usedAmount', key: 'usedAmount', width: 120, render: editableNum('usedAmount', updateCard) },
            ]}
            size="small"
            pagination={false}
            scroll={{ x: 600 }}
            sticky
            locale={{ emptyText: '暂无贷记卡账户数据' }}
          />
        </>
      ),
    },
    {
      key: 'repayResponsibility',
      label: `(五) 相关还款责任 (${repayResponsibilities.length})`,
      children: (
        <>
          <Alert title={OCR_TIP} type="info" showIcon style={{ marginBottom: 8 }} />
          <Table
            dataSource={repayResponsibilities.map((r, i) => ({ ...r, key: i }))}
            columns={[
              { title: '管理机构', dataIndex: 'org', key: 'org', width: 220, fixed: 'left' as const },
              { title: '责任人类型', dataIndex: 'responsibilityType', key: 'responsibilityType', width: 100 },
              { title: '还款责任金额', dataIndex: 'responsibilityAmount', key: 'responsibilityAmount', width: 120, render: editableNum('responsibilityAmount', updateRepay) },
              { title: '主业务借款人', dataIndex: 'borrowerName', key: 'borrowerName', width: 120 },
              { title: '余额', dataIndex: 'balance', key: 'balance', width: 120, render: editableNum('balance', updateRepay) },
            ]}
            size="small"
            pagination={false}
            scroll={{ x: 700 }}
            sticky
            locale={{ emptyText: '暂无相关还款责任数据' }}
          />
        </>
      ),
    },
    {
      key: 'creditAgreement',
      label: `(六) 授信协议信息 (${creditAgreements.length})`,
      children: (
        <>
          <Alert title={OCR_TIP} type="info" showIcon style={{ marginBottom: 8 }} />
          <Table
            dataSource={creditAgreements.map((a, i) => ({ ...a, key: i }))}
            columns={[
              { title: '管理机构', dataIndex: 'org', key: 'org', width: 240, fixed: 'left' as const },
              { title: '授信额度用途', dataIndex: 'creditPurpose', key: 'creditPurpose', width: 140 },
              { title: '授信额度', dataIndex: 'creditLimit', key: 'creditLimit', width: 120, render: editableNum('creditLimit', updateAgreement) },
              { title: '已用额度', dataIndex: 'usedAmount', key: 'usedAmount', width: 120, render: editableNum('usedAmount', updateAgreement) },
            ]}
            size="small"
            pagination={false}
            scroll={{ x: 650 }}
            sticky
            locale={{ emptyText: '暂无授信协议信息' }}
          />
        </>
      ),
    },
  ];

  return <Tabs items={items} size="small" tabPosition="left" />;
};

export default CreditDetailTab;

