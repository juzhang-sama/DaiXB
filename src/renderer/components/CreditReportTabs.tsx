import React from 'react';
import { Tabs, Spin } from 'antd';
import type { CreditReport } from '../types/credit-report';
import PersonalInfoTab from './tabs/PersonalInfoTab';
import CreditDetailTab from './tabs/CreditDetailTab';
import QueryRecordTab from './tabs/QueryRecordTab';
import CreditAssessmentTab from './tabs/CreditAssessmentTab';

interface CreditReportTabsProps {
  report: CreditReport;
  loading: boolean;
  onChange: (report: CreditReport) => void;
}

/**
 * 征信报告主 Tab 组件
 * 按一级章节组织：个人基本信息、信贷交易信息明细、查询记录
 */
const CreditReportTabs: React.FC<CreditReportTabsProps> = ({ report, loading, onChange }) => {
  const items = [
    { key: 'personal', label: '个人基本信息', children: <PersonalInfoTab report={report} onChange={onChange} /> },
    { key: 'credit', label: '信贷交易信息明细', children: <CreditDetailTab report={report} onChange={onChange} /> },
    { key: 'query', label: '查询记录', children: <QueryRecordTab report={report} onChange={onChange} /> },
    { key: 'assessment', label: '征信评估', children: <CreditAssessmentTab report={report} /> },
  ];

  return (
    <Spin spinning={loading} tip="正在解析征信报告...">
      <div className="bg-white shadow rounded-lg p-6 min-h-[500px]">
        <Tabs
          defaultActiveKey="personal"
          items={items}
          type="card"
          className="custom-tabs"
        />
      </div>
    </Spin>
  );
};

export default CreditReportTabs;

