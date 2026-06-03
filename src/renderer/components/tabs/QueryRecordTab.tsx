import React, { useMemo } from 'react';
import { Tabs, Table } from 'antd';
import type { CreditReport } from '../../types/credit-report';

interface QueryRecordTabProps {
  report: CreditReport;
  onChange: (report: CreditReport) => void;
}

/**
 * 四、查询记录
 * 包含二级章节：机构查询记录明细、本人查询记录明细
 */
const QueryRecordTab: React.FC<QueryRecordTabProps> = ({ report }) => {
  const { orgQueries, selfQueries } = report.queryRecord;

  // 提取所有不重复的查询原因，用于 filter
  const reasonFilters = useMemo(() => {
    const reasons = new Set(orgQueries.map(q => q.queryReason).filter(Boolean));
    return Array.from(reasons).map(r => ({ text: r, value: r }));
  }, [orgQueries]);

  const items = [
    {
      key: 'orgQuery',
      label: `(一) 机构查询记录明细 (${orgQueries.length})`,
      children: (
        <Table
          dataSource={orgQueries.map((q, i) => ({ ...q, key: i }))}
          columns={[
            { title: '查询日期', dataIndex: 'queryDate', key: 'queryDate', width: 130 },
            { title: '查询机构', dataIndex: 'queryOrg', key: 'queryOrg' },
            {
              title: '查询原因', dataIndex: 'queryReason', key: 'queryReason', width: 150,
              filters: reasonFilters,
              onFilter: (value: React.Key | boolean, record: { queryReason: string }) =>
                record.queryReason === String(value),
            },
          ]}
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: true }}
          scroll={{ x: 600 }}
          locale={{ emptyText: '暂无机构查询记录' }}
        />
      ),
    },
    {
      key: 'selfQuery',
      label: `(二) 本人查询记录明细 (${selfQueries.length})`,
      children: (
        <Table
          dataSource={selfQueries.map((q, i) => ({ ...q, key: i }))}
          columns={[
            { title: '查询日期', dataIndex: 'queryDate', key: 'queryDate', width: 120 },
            { title: '查询机构', dataIndex: 'queryOrg', key: 'queryOrg' },
            { title: '查询原因', dataIndex: 'queryReason', key: 'queryReason', width: 150 },
          ]}
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: true }}
          scroll={{ x: 600 }}
          locale={{ emptyText: '暂无本人查询记录' }}
        />
      ),
    },
  ];

  return <Tabs items={items} size="small" tabPosition="left" />;
};

export default QueryRecordTab;

