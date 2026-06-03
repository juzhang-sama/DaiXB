import React from 'react';
import { Descriptions, Card } from 'antd';
import type { CreditReport, ReportHeader, IdentityInfo } from '../../types/credit-report';
import EditableCell from '../EditableCell';

interface BasicInfoTabProps {
  report: CreditReport;
  onChange: (report: CreditReport) => void;
}

const BasicInfoTab: React.FC<BasicInfoTabProps> = ({ report, onChange }) => {
  const { header, personalInfo } = report;
  const identity = personalInfo.identity;

  const updateHeader = (key: keyof ReportHeader, val: string | number) => {
    onChange({ ...report, header: { ...header, [key]: String(val) } });
  };

  const updateIdentity = (key: keyof IdentityInfo, val: string | number) => {
    onChange({
      ...report,
      personalInfo: { ...personalInfo, identity: { ...identity, [key]: String(val) } },
    });
  };

  return (
    <div className="space-y-4">
      <Card title="报告信息" size="small">
        <Descriptions column={2} size="small">
          <Descriptions.Item label="报告编号">
            <EditableCell value={header.reportNo} onChange={(v) => updateHeader('reportNo', v)} />
          </Descriptions.Item>
          <Descriptions.Item label="报告时间">
            <EditableCell value={header.reportTime} onChange={(v) => updateHeader('reportTime', v)} />
          </Descriptions.Item>
          <Descriptions.Item label="查询机构">
            <EditableCell value={header.queryOrg} onChange={(v) => updateHeader('queryOrg', v)} />
          </Descriptions.Item>
          <Descriptions.Item label="查询原因">
            <EditableCell value={header.queryReason} onChange={(v) => updateHeader('queryReason', v)} />
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="身份信息" size="small">
        <Descriptions column={2} size="small">
          <Descriptions.Item label="姓名">
            <EditableCell value={header.name} onChange={(v) => updateHeader('name', v)} />
          </Descriptions.Item>
          <Descriptions.Item label="证件号码">
            <EditableCell value={header.certNo} onChange={(v) => updateHeader('certNo', v)} />
          </Descriptions.Item>
          <Descriptions.Item label="性别">
            <EditableCell value={identity.gender} onChange={(v) => updateIdentity('gender', v)} />
          </Descriptions.Item>
          <Descriptions.Item label="出生日期">
            <EditableCell value={identity.birthDate} onChange={(v) => updateIdentity('birthDate', v)} />
          </Descriptions.Item>
          <Descriptions.Item label="婚姻状况">
            <EditableCell value={identity.maritalStatus} onChange={(v) => updateIdentity('maritalStatus', v)} />
          </Descriptions.Item>
          <Descriptions.Item label="就业状况">
            <EditableCell value={identity.employmentStatus} onChange={(v) => updateIdentity('employmentStatus', v)} />
          </Descriptions.Item>
          <Descriptions.Item label="学历">
            <EditableCell value={identity.education} onChange={(v) => updateIdentity('education', v)} />
          </Descriptions.Item>
          <Descriptions.Item label="学位">
            <EditableCell value={identity.degree} onChange={(v) => updateIdentity('degree', v)} />
          </Descriptions.Item>
          <Descriptions.Item label="国籍">
            <EditableCell value={identity.nationality} onChange={(v) => updateIdentity('nationality', v)} />
          </Descriptions.Item>
          <Descriptions.Item label="电子邮箱">
            <EditableCell value={identity.email} onChange={(v) => updateIdentity('email', v)} />
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="联系地址" size="small">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="通讯地址">
            <EditableCell value={identity.commAddress} onChange={(v) => updateIdentity('commAddress', v)} />
          </Descriptions.Item>
          <Descriptions.Item label="户籍地址">
            <EditableCell value={identity.registeredAddress} onChange={(v) => updateIdentity('registeredAddress', v)} />
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
};

export default BasicInfoTab;

