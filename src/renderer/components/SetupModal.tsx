/**
 * API Key 配置弹窗 — 首次启动或用户主动打开时显示
 *
 * 用户输入 TextIn + DeepSeek 的 API Key，保存到主进程持久化存储
 */

import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, message } from 'antd';

interface SetupModalProps {
  open: boolean;
  onSuccess: () => void;
}

interface KeyFormValues {
  textinAppId: string;
  textinSecretCode: string;
  deepseekApiKey: string;
}

const SetupModal: React.FC<SetupModalProps> = ({ open, onSuccess }) => {
  const [form] = Form.useForm<KeyFormValues>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    window.electron.getApiKeys().then((keys) => {
      form.setFieldsValue({
        textinAppId: keys.textinAppId ?? '',
        textinSecretCode: keys.textinSecretCode ?? '',
        deepseekApiKey: keys.deepseekApiKey ?? '',
      });
    });
  }, [open, form]);

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await window.electron.setApiKeys(values);
      message.success('API Key 已保存，重启应用后生效');
      onSuccess();
    } catch {
      message.error('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="配置 API Key"
      open={open}
      onOk={handleSave}
      confirmLoading={saving}
      closable={false}
      maskClosable={false}
      okText="保存"
      cancelButtonProps={{ style: { display: 'none' } }}
    >
      <p className="text-gray-500 mb-4 text-sm">
        首次使用需要配置以下 API Key，配置后将安全存储在本地。
      </p>
      <Form form={form} layout="vertical" autoComplete="off">
        <Form.Item label="TextIn App ID" name="textinAppId"
          rules={[{ required: true, message: '请输入 TextIn App ID' }]}>
          <Input placeholder="TextIn 应用 ID" />
        </Form.Item>
        <Form.Item label="TextIn Secret Code" name="textinSecretCode"
          rules={[{ required: true, message: '请输入 TextIn Secret Code' }]}>
          <Input.Password placeholder="TextIn 密钥" />
        </Form.Item>
        <Form.Item label="DeepSeek API Key" name="deepseekApiKey"
          rules={[{ required: true, message: '请输入 DeepSeek API Key' }]}>
          <Input.Password placeholder="sk-..." />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default SetupModal;

