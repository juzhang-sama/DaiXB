/**
 * 产品规则编辑表单 — 创建/编辑产品时使用
 *
 * 用户从条件目录中勾选"零件"，设定阈值，组装产品
 */

import React, { useState } from 'react';
import { Form, Input, InputNumber, Button, Checkbox, Switch, Select, Card, Space } from 'antd';
import type { ProductRule, ConditionRule, ConditionCatalogItem } from '../types/product-rule';
import { CONDITION_CATALOG } from '../types/product-rule';

interface ProductFormProps {
  /** 编辑时传入已有产品，新建时为 undefined */
  initial?: ProductRule;
  onSave: (data: Omit<ProductRule, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

/** 按维度分组 */
function groupByDimension(catalog: ConditionCatalogItem[]): Record<string, ConditionCatalogItem[]> {
  const groups: Record<string, ConditionCatalogItem[]> = {};
  for (const item of catalog) {
    if (!groups[item.dimension]) groups[item.dimension] = [];
    groups[item.dimension].push(item);
  }
  return groups;
}

const dimensionGroups = groupByDimension(CONDITION_CATALOG);

const ProductForm: React.FC<ProductFormProps> = ({ initial, onSave, onCancel }) => {
  const [name, setName] = useState(initial?.name ?? '');
  const [institution, setInstitution] = useState(initial?.institution ?? '');
  const [amountMin, setAmountMin] = useState(initial?.amountRange[0] ?? 1);
  const [amountMax, setAmountMax] = useState(initial?.amountRange[1] ?? 50);
  const [rateMin, setRateMin] = useState(initial?.rateRange[0] ?? 3);
  const [rateMax, setRateMax] = useState(initial?.rateRange[1] ?? 24);
  const [remark, setRemark] = useState(initial?.remark ?? '');

  // 已选条件：field -> ConditionRule
  const [selected, setSelected] = useState<Map<string, ConditionRule>>(() => {
    const m = new Map<string, ConditionRule>();
    if (initial) {
      for (const c of initial.conditions) m.set(c.field, c);
    }
    return m;
  });

  const toggleField = (item: ConditionCatalogItem, checked: boolean) => {
    setSelected(prev => {
      const next = new Map(prev);
      if (checked) {
        next.set(item.field, {
          field: item.field, label: item.label, operator: item.operator,
          weight: 0,
          min: item.defaultMin, max: item.defaultMax,
          value: item.defaultValue, values: item.enumOptions?.slice(),
        });
      } else {
        next.delete(item.field);
      }
      return next;
    });
  };

  const updateCondition = (field: string, patch: Partial<ConditionRule>) => {
    setSelected(prev => {
      const next = new Map(prev);
      const existing = next.get(field);
      if (existing) next.set(field, { ...existing, ...patch });
      return next;
    });
  };

  const handleSave = () => {
    onSave({
      name, institution,
      amountRange: [amountMin, amountMax],
      rateRange: [rateMin, rateMax],
      remark,
      conditions: Array.from(selected.values()),
    });
  };

  return (
    <div className="space-y-4">
      {/* 基本信息 */}
      <Card size="small" title="产品基本信息">
        <Form layout="vertical" size="small">
          <Form.Item label="产品名称" required>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="如：XX银行信用贷" />
          </Form.Item>
          <Form.Item label="机构名称">
            <Input value={institution} onChange={e => setInstitution(e.target.value)} placeholder="如：XX银行" />
          </Form.Item>
          <Space>
            <Form.Item label="最低额度(万)">
              <InputNumber value={amountMin} onChange={v => setAmountMin(v ?? 0)} min={0} />
            </Form.Item>
            <Form.Item label="最高额度(万)">
              <InputNumber value={amountMax} onChange={v => setAmountMax(v ?? 0)} min={0} />
            </Form.Item>
          </Space>
          <Space>
            <Form.Item label="最低利率(%)">
              <InputNumber value={rateMin} onChange={v => setRateMin(v ?? 0)} min={0} step={0.1} />
            </Form.Item>
            <Form.Item label="最高利率(%)">
              <InputNumber value={rateMax} onChange={v => setRateMax(v ?? 0)} min={0} step={0.1} />
            </Form.Item>
          </Space>
          <Form.Item label="备注">
            <Input.TextArea value={remark} onChange={e => setRemark(e.target.value)} rows={2} />
          </Form.Item>
        </Form>
      </Card>

      {/* 条件选择 */}
      <Card size="small" title="准入条件（勾选需要的条件并设定阈值）">
        {Object.entries(dimensionGroups).map(([dim, items]) => (
          <div key={dim} className="mb-3">
            <div className="text-xs font-semibold text-gray-500 mb-1">{dim}</div>
            {items.map(item => {
              const rule = selected.get(item.field);
              const checked = !!rule;
              return (
                <div key={item.field} className="flex items-center gap-2 mb-1 ml-2">
                  <Checkbox checked={checked} onChange={e => toggleField(item, e.target.checked)}>
                    <span className="text-xs">{item.label}</span>
                  </Checkbox>
                  {checked && item.operator === 'range' && (
                    <Space size={4}>
                      <InputNumber size="small" className="w-20" placeholder="最小"
                        value={rule?.min} onChange={v => updateCondition(item.field, { min: v ?? undefined })} />
                      <span className="text-xs text-gray-400">~</span>
                      <InputNumber size="small" className="w-20" placeholder="最大"
                        value={rule?.max} onChange={v => updateCondition(item.field, { max: v ?? undefined })} />
                    </Space>
                  )}
                  {checked && item.operator === 'bool' && (
                    <Switch size="small" checked={rule?.value ?? false}
                      checkedChildren="是" unCheckedChildren="否"
                      onChange={v => updateCondition(item.field, { value: v })} />
                  )}
                  {checked && item.operator === 'enum' && (
                    <Select size="small" mode="multiple" className="min-w-[140px]"
                      value={rule?.values ?? []} options={item.enumOptions?.map(o => ({ label: o, value: o }))}
                      onChange={v => updateCondition(item.field, { values: v })} />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </Card>

      {/* 操作按钮 */}
      <div className="flex gap-2 justify-end">
        <Button onClick={onCancel}>取消</Button>
        <Button type="primary" onClick={handleSave} disabled={!name.trim()}>
          {initial ? '保存修改' : '创建产品'}
        </Button>
      </div>
    </div>
  );
};

export default ProductForm;

