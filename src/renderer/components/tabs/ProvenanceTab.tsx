import React from 'react';
import { Table, Tag } from 'antd';
import type { CreditReport, FieldProvenance } from '../../types/credit-report';

interface ProvenanceTabProps {
  report: CreditReport;
}

const SOURCE_LABEL: Record<FieldProvenance['source'], string> = {
  'doc-table': '文档表格',
  'pdf-text': 'PDF文本',
  derived: '反算',
  manual: '人工',
  unknown: '未知',
};

const ProvenanceTab: React.FC<ProvenanceTabProps> = ({ report }) => {
  const rows = Object.values(report.provenance ?? {}).map((p, i) => ({ ...p, key: i }));

  return (
    <Table
      dataSource={rows}
      size="small"
      pagination={false}
      locale={{ emptyText: '暂无字段溯源信息' }}
      columns={[
        { title: '字段/模块', dataIndex: 'field', key: 'field', width: 220 },
        { title: '说明', dataIndex: 'label', key: 'label', width: 160 },
        {
          title: '来源', dataIndex: 'source', key: 'source', width: 100,
          render: (v: FieldProvenance['source']) => <Tag>{SOURCE_LABEL[v] ?? v}</Tag>,
        },
        { title: '物理页', dataIndex: 'pageNum', key: 'pageNum', width: 80, render: (v?: number) => v ?? '-' },
        { title: '逻辑页', dataIndex: 'logicalPage', key: 'logicalPage', width: 80, render: (v?: number) => v ?? '-' },
        { title: '前置文本', dataIndex: 'precedingText', key: 'precedingText', ellipsis: true },
        {
          title: '置信度', dataIndex: 'confidence', key: 'confidence', width: 90,
          render: (v?: number) => v ? `${Math.round(v * 100)}%` : '-',
        },
      ]}
    />
  );
};

export default ProvenanceTab;
