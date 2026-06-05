/**
 * 产品规则库侧边栏 — 产品管理 + 成功率展示
 *
 * 三种视图状态：list（产品列表+成功率）、create（新建）、edit（编辑）
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Drawer, Button, Card, Empty, Popconfirm, Collapse, Tooltip, Upload, message } from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SettingOutlined,
  CopyOutlined, DownloadOutlined, UploadOutlined,
} from '@ant-design/icons';
import type { CreditReport } from '../types/credit-report';
import type { ProductRule, ConditionRule } from '../types/product-rule';
import { buildCreditProfile } from '../services/credit-profile-builder';
import { matchAllProducts } from '../services/product-matcher';
import type { ProductMatchResult, ConditionMatchResult } from '../services/product-matcher';
import {
  getAllProducts, addProduct, updateProduct, deleteProduct,
  exportProducts, importProducts,
} from '../services/product-store';
import ProductForm from './ProductForm';

const WeightConfigModal = React.lazy(() => import('./WeightConfigModal'));

interface ProductDrawerProps {
  open: boolean;
  onClose: () => void;
  report: CreditReport;
}

type ViewMode = 'list' | 'create' | 'edit';

/** 根据成功率返回配色方案 */
function rateTheme(rate: number): { color: string; bg: string; label: string } {
  if (rate >= 80) return { color: '#389e0d', bg: 'linear-gradient(135deg, #f6ffed 0%, #d9f7be 100%)', label: '通过率高' };
  if (rate >= 50) return { color: '#d48806', bg: 'linear-gradient(135deg, #fffbe6 0%, #ffe58f 100%)', label: '有风险' };
  return { color: '#cf1322', bg: 'linear-gradient(135deg, #fff1f0 0%, #ffa39e 100%)', label: '通过率低' };
}

const STATUS_ICON: Record<string, { color: string; symbol: string }> = {
  pass: { color: '#52c41a', symbol: '✓' },
  fail: { color: '#ff4d4f', symbol: '✗' },
  insufficient: { color: '#faad14', symbol: '?' },
};

/** 条件明细行 */
const ConditionRow: React.FC<{ detail: ConditionMatchResult }> = ({ detail }) => {
  const s = STATUS_ICON[detail.status];
  return (
    <div className="flex items-center text-xs py-0.5 gap-2">
      <span style={{ color: s.color, fontWeight: 'bold' }}>{s.symbol}</span>
      <span className="text-gray-600 w-28 shrink-0">{detail.label}</span>
      <span className="text-gray-400">要求: {detail.expected}</span>
      <span className="ml-auto" style={{ color: s.color }}>实际: {detail.actual}</span>
    </div>
  );
};

const ProductDrawer: React.FC<ProductDrawerProps> = ({ open, onClose, report }) => {
  const [view, setView] = useState<ViewMode>('list');
  const [editingProduct, setEditingProduct] = useState<ProductRule | undefined>();
  const [products, setProducts] = useState<ProductRule[]>([]);
  const [weightConfigProduct, setWeightConfigProduct] = useState<ProductRule | null>(null);

  // 打开时刷新产品列表
  React.useEffect(() => {
    if (open) setProducts(getAllProducts());
  }, [open]);

  // 构建 profile + 匹配
  const matchResults = useMemo(() => {
    if (products.length === 0) return [];
    const hasReport = !!report.header.reportNo;
    if (!hasReport) return [];
    const profile = buildCreditProfile(report);
    return matchAllProducts(profile, products);
  }, [report, products]);

  // 没有报告数据时，只展示产品列表不做匹配
  const hasReport = !!report.header.reportNo;

  const handleCreate = useCallback((data: Omit<ProductRule, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newProduct = addProduct(data);
    setProducts(getAllProducts());
    setView('list');
    // 创建成功后自动弹出权重配置
    if (newProduct && newProduct.conditions.length > 0) {
      setWeightConfigProduct(newProduct);
    }
  }, []);

  const handleUpdate = useCallback((data: Omit<ProductRule, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingProduct) {
      updateProduct(editingProduct.id, data);
      setProducts(getAllProducts());
    }
    setView('list');
    setEditingProduct(undefined);
  }, [editingProduct]);

  const handleWeightSave = useCallback((conditions: ConditionRule[]) => {
    if (weightConfigProduct) {
      updateProduct(weightConfigProduct.id, { conditions });
      setProducts(getAllProducts());
    }
    setWeightConfigProduct(null);
  }, [weightConfigProduct]);

  const handleDelete = useCallback((id: string) => {
    deleteProduct(id);
    setProducts(getAllProducts());
  }, []);

  const handleDuplicate = useCallback((product: ProductRule) => {
    addProduct({
      name: `${product.name} 副本`,
      institution: product.institution,
      amountRange: [...product.amountRange] as [number, number],
      rateRange: [...product.rateRange] as [number, number],
      remark: product.remark,
      conditions: product.conditions.map(c => ({ ...c })),
    });
    setProducts(getAllProducts());
    message.success('已复制产品');
  }, []);

  const handleExportProducts = useCallback(() => {
    const blob = new Blob([exportProducts()], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `产品规则库_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImportProducts = useCallback(async (file: File) => {
    try {
      const count = importProducts(await file.text());
      setProducts(getAllProducts());
      message.success(`已导入 ${count} 个产品`);
    } catch {
      message.error('导入失败，请确认 JSON 格式正确');
    }
    return false;
  }, []);

  const startEdit = (product: ProductRule) => {
    setEditingProduct(product);
    setView('edit');
  };

  // 按产品 ID 索引匹配结果
  const resultMap = useMemo(() => {
    const m = new Map<string, ProductMatchResult>();
    for (const r of matchResults) m.set(r.product.id, r);
    return m;
  }, [matchResults]);

  return (
    <Drawer
      title="产品规则库"
      placement="right"
      size={480}
      open={open}
      onClose={() => { setView('list'); onClose(); }}
      extra={view === 'list' && (
        <div className="flex gap-1">
          <Tooltip title="导出产品规则">
            <Button size="small" icon={<DownloadOutlined />} onClick={handleExportProducts} />
          </Tooltip>
          <Upload accept=".json" showUploadList={false} beforeUpload={handleImportProducts}>
            <Tooltip title="导入产品规则">
              <Button size="small" icon={<UploadOutlined />} />
            </Tooltip>
          </Upload>
          <Button type="primary" size="small" icon={<PlusOutlined />}
            onClick={() => setView('create')}>
            新建产品
          </Button>
        </div>
      )}
    >
      {view === 'list' && (
        <div className="space-y-3">
          {products.length === 0 ? (
            <Empty description="暂无产品，点击右上角新建" />
          ) : (
            products.map(p => {
              const mr = resultMap.get(p.id);
              const theme = mr ? rateTheme(mr.successRate) : null;
              return (
                <Card key={p.id} size="small"
                  title={<span className="text-sm font-medium">{p.name}</span>}
                  extra={
                    <div className="flex gap-1 items-center">
                      <Tooltip title="编辑">
                        <Button size="small" type="text" icon={<EditOutlined />}
                          onClick={() => startEdit(p)} />
                      </Tooltip>
                      <Tooltip title="复制">
                        <Button size="small" type="text" icon={<CopyOutlined />}
                          onClick={() => handleDuplicate(p)} />
                      </Tooltip>
                      <Popconfirm title="确定删除？" onConfirm={() => handleDelete(p.id)}>
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </div>
                  }
                >
                  <div className="text-xs text-gray-400 mb-2">
                    {p.institution && <span>{p.institution} · </span>}
                    额度 {p.amountRange[0]}-{p.amountRange[1]}万 · 利率 {p.rateRange[0]}-{p.rateRange[1]}%
                  </div>
                  {mr && theme && (
                    <div className="rounded-lg px-3 py-2 mb-2" style={{ background: theme.bg }}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs" style={{ color: theme.color }}>{theme.label}</span>
                        <span className="text-2xl font-bold" style={{ color: theme.color }}>
                          {mr.successRate}<span className="text-sm font-normal">%</span>
                        </span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-white/60 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${mr.successRate}%`, backgroundColor: theme.color }}
                        />
                      </div>
                      <div className="flex gap-3 mt-1.5 text-xs" style={{ color: theme.color, opacity: 0.8 }}>
                        <span>{mr.passCount}通过</span>
                        <span>{mr.failCount}不通过</span>
                        <span>{mr.insufficientCount}待定</span>
                      </div>
                    </div>
                  )}
                  {p.conditions.length === 0 && (
                    <div className="text-xs text-gray-300">未设置准入条件</div>
                  )}
                  {mr && mr.details.length > 0 && (
                    <Collapse size="small" ghost items={[{
                      key: '1',
                      label: <span className="text-xs text-gray-500">条件明细</span>,
                      children: mr.details.map((d, i) => <ConditionRow key={i} detail={d} />),
                    }]} />
                  )}
                  {!hasReport && p.conditions.length > 0 && (
                    <div className="text-xs text-gray-300 mt-1">上传征信报告后可查看预估成功率</div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {view === 'create' && (
        <ProductForm onSave={handleCreate} onCancel={() => setView('list')} />
      )}

      {view === 'edit' && editingProduct && (
        <div className="space-y-4">
          <ProductForm initial={editingProduct} onSave={handleUpdate} onCancel={() => { setView('list'); setEditingProduct(undefined); }} />
          {editingProduct.conditions.length > 0 && (
            <Button block icon={<SettingOutlined />} onClick={() => setWeightConfigProduct(editingProduct)}>
              配置权重
            </Button>
          )}
        </div>
      )}

      {weightConfigProduct && (
        <React.Suspense fallback={null}>
          <WeightConfigModal
            open
            conditions={weightConfigProduct.conditions}
            onSave={handleWeightSave}
            onCancel={() => setWeightConfigProduct(null)}
          />
        </React.Suspense>
      )}
    </Drawer>
  );
};

export default ProductDrawer;
