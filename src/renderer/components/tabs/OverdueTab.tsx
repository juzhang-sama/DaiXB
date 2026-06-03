import React from 'react';
import { Card, Descriptions, Tag } from 'antd';
import type { CreditReport, AccountDerivedSummary } from '../../types/credit-report';
import EditableCell from '../EditableCell';

interface OverdueTabProps {
  report: CreditReport;
  onChange: (report: CreditReport) => void;
}

const EMPTY: AccountDerivedSummary = {
  orgCount: 0, accountCount: 0, totalCredit: 0, balance: 0, monthlyPayment: 0,
};

/** 格式化金额：元 → 带千分位 */
function formatYuan(val: number): string {
  if (val === 0) return '0';
  return val.toLocaleString('zh-CN');
}

const OverdueTab: React.FC<OverdueTabProps> = ({ report, onChange }) => {
  const d = report.accountDerived;
  const nonRev = d.nonRevolvingLoan ?? EMPTY;
  const rev1 = d.revolvingLoan1 ?? EMPTY;
  const rev2 = d.revolvingLoan2 ?? EMPTY;
  const card = d.creditCard ?? EMPTY;

  const totalMonthly = nonRev.monthlyPayment + rev1.monthlyPayment + rev2.monthlyPayment;
  const totalLoanBalance = nonRev.balance + rev1.balance + rev2.balance;

  const overdueSummary = report.summary.overdueSummary;

  const updateOverdue = (key: string, val: number) => {
    onChange({
      ...report,
      summary: {
        ...report.summary,
        overdueSummary: {
          ...(overdueSummary ?? { overdueAccountCount: 0, maxOverdueDuration: 0, overdueMaxAmount: 0, overdueMonths: 0 }),
          [key]: val
        },
      },
    });
  };

  const updateDerived = (category: keyof typeof d, field: keyof AccountDerivedSummary, val: number) => {
    const prev = d[category] ?? { ...EMPTY };
    onChange({
      ...report,
      accountDerived: { ...d, [category]: { ...prev, [field]: val } },
    });
  };

  /** 渲染可编辑数值 */
  const ec = (value: number, onSave: (v: number) => void) => (
    <EditableCell value={value} type="number" formatter={formatYuan} onChange={(v) => onSave(Number(v))} />
  );

  return (
    <div className="space-y-4">
      <Card title="逾期状况" size="small">
        <Descriptions column={2} size="small">
          <Descriptions.Item label="当前逾期">
            {overdueSummary
              ? <Tag color="red">有逾期（{overdueSummary.overdueAccountCount ?? 0} 笔）</Tag>
              : <Tag color="green">无当前逾期</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="历史最长逾期期数">
            <EditableCell
              value={overdueSummary?.maxOverdueDuration ?? 0} type="number"
              onChange={(v) => updateOverdue('maxOverdueDuration', Number(v))}
            />
          </Descriptions.Item>
          <Descriptions.Item label="逾期账户数">
            <EditableCell
              value={overdueSummary?.overdueAccountCount ?? 0} type="number"
              onChange={(v) => updateOverdue('overdueAccountCount', Number(v))}
            />
          </Descriptions.Item>
          <Descriptions.Item label="逾期最大金额 (元)">
            <EditableCell
              value={overdueSummary?.overdueMaxAmount ?? 0} type="number" formatter={formatYuan}
              onChange={(v) => updateOverdue('overdueMaxAmount', Number(v))}
            />
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="负债概览（明细反算）" size="small">
        <Descriptions column={2} size="small">
          <Descriptions.Item label="贷款余额合计 (元)">{ec(totalLoanBalance, () => {})}</Descriptions.Item>
          <Descriptions.Item label="贷记卡已用额度 (元)">{ec(card.balance, v => updateDerived('creditCard', 'balance', v))}</Descriptions.Item>
          <Descriptions.Item label="贷款月供合计 (元)">{ec(totalMonthly, () => {})}</Descriptions.Item>
          <Descriptions.Item label="贷记卡授信总额 (元)">{ec(card.totalCredit, v => updateDerived('creditCard', 'totalCredit', v))}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="负债率 (DTI)" size="small">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="月供合计 (元)">{ec(totalMonthly, () => {})}</Descriptions.Item>
          <Descriptions.Item label="月收入 (元)">
            <span className="text-gray-400">待填写（用于计算 DTI）</span>
          </Descriptions.Item>
          <Descriptions.Item label="DTI">
            <span className="text-gray-400">= 月供 / 月收入（预留）</span>
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
};

export default OverdueTab;

