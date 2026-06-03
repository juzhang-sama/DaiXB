import React from 'react';
import { Card, Table, Tag } from 'antd';
import type { CreditReport, AccountBrief } from '../../types/credit-report';
import EditableCell from '../EditableCell';

interface AccountDetailTabProps {
  report: CreditReport;
  onChange: (report: CreditReport) => void;
}

/** 格式化金额：元 → 带千分位 */
function formatYuan(val: number): string {
  if (val === 0) return '0';
  return val.toLocaleString('zh-CN');
}

/** 按类别分组 */
function groupByCategory(briefs: AccountBrief[]): Record<string, AccountBrief[]> {
  const groups: Record<string, AccountBrief[]> = {};
  for (const b of briefs) {
    if (!groups[b.category]) groups[b.category] = [];
    groups[b.category].push(b);
  }
  return groups;
}

/** 类别显示顺序 */
const CATEGORY_ORDER = ['nonRevolvingLoan', 'revolvingLoan1', 'revolvingLoan2', 'creditCard'];

const AccountDetailTab: React.FC<AccountDetailTabProps> = ({ report, onChange }) => {
  const briefs = report.accountBriefs ?? [];

  const updateBrief = (index: number, field: keyof AccountBrief, val: string | number) => {
    const updated = [...briefs];
    updated[index] = { ...updated[index], [field]: val };
    onChange({ ...report, accountBriefs: updated });
  };

  /** 找到 brief 在 report.accountBriefs 中的原始索引 */
  const findIndex = (brief: AccountBrief): number => {
    return briefs.indexOf(brief);
  };

  const groups = groupByCategory(briefs);

  const columns = [
    {
      title: '序号', width: 50, render: (_: unknown, __: unknown, i: number) => i + 1,
    },
    {
      title: '管理机构', dataIndex: 'org', key: 'org', width: 200,
      render: (_: string, record: AccountBrief) => (
        <EditableCell value={record.org} onChange={(v) => updateBrief(findIndex(record), 'org', String(v))} />
      ),
    },
    {
      title: '开立日期', dataIndex: 'openDate', key: 'openDate', width: 110,
      render: (_: string, record: AccountBrief) => (
        <EditableCell value={record.openDate} onChange={(v) => updateBrief(findIndex(record), 'openDate', String(v))} />
      ),
    },
    {
      title: '借款/授信额度', dataIndex: 'creditAmount', key: 'creditAmount', width: 130,
      render: (_: number, record: AccountBrief) => (
        <EditableCell
          value={record.creditAmount} type="number" formatter={formatYuan}
          onChange={(v) => updateBrief(findIndex(record), 'creditAmount', Number(v))}
        />
      ),
    },
    {
      title: '余额/已用额度', dataIndex: 'balance', key: 'balance', width: 130,
      render: (_: number, record: AccountBrief) => (
        <EditableCell
          value={record.balance} type="number" formatter={formatYuan}
          onChange={(v) => updateBrief(findIndex(record), 'balance', Number(v))}
        />
      ),
    },
    {
      title: '月还款额', dataIndex: 'monthlyPayment', key: 'monthlyPayment', width: 110,
      render: (_: number, record: AccountBrief) => (
        <EditableCell
          value={record.monthlyPayment} type="number" formatter={formatYuan}
          onChange={(v) => updateBrief(findIndex(record), 'monthlyPayment', Number(v))}
        />
      ),
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (_: string, record: AccountBrief) => {
        const color = record.isClosed ? 'default' : 'blue';
        return (
          <Tag color={color}>
            <EditableCell value={record.status} onChange={(v) => updateBrief(findIndex(record), 'status', String(v))} />
          </Tag>
        );
      },
    },
  ];

  const sortedKeys = CATEGORY_ORDER.filter((k) => groups[k]?.length);

  if (briefs.length === 0) {
    return <Card size="small"><span className="text-gray-400">暂无账户明细数据</span></Card>;
  }

  return (
    <div className="space-y-4">
      {sortedKeys.map((key) => {
        const list = groups[key];
        const label = list[0].categoryLabel;
        return (
          <Card key={key} title={`${label}（${list.length} 笔）`} size="small">
            <Table
              columns={columns} dataSource={list} pagination={false}
              size="small" bordered scroll={{ x: 900 }}
              rowKey={(record) => `${record.category}-${record.org}-${record.openDate}`}
            />
          </Card>
        );
      })}
    </div>
  );
};

export default AccountDetailTab;

