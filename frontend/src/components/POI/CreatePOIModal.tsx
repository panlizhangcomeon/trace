import React, { useState } from 'react';
import { Modal, Form, Input, Select, InputNumber, message, Space } from 'antd';
import { POI, poiApi } from '../../services/api';

interface CreatePOIModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: (poi: POI) => void;
  initialPosition?: { lat: number; lng: number };
}

const POI_TYPES = [
  { value: 'attraction', label: '景点' },
  { value: 'food', label: '美食' },
  { value: 'accommodation', label: '住宿' },
  { value: 'checkin', label: '打卡' },
  { value: 'supply', label: '补给' },
];

const POI_TAGS = [
  { value: 'local_secret', label: '本地私藏' },
  { value: 'non_commercial', label: '非商业化' },
  { value: 'couple_friendly', label: '情侣友好' },
  { value: 'hiking', label: '徒步' },
  { value: 'scenic_view', label: '风景' },
  { value: 'popular', label: '热门' },
];

const CreatePOIModal: React.FC<CreatePOIModalProps> = ({
  open,
  onCancel,
  onSuccess,
  initialPosition,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      const poi = await poiApi.create(values);
      message.success('POI 创建成功');
      form.resetFields();
      onSuccess(poi.data);
    } catch (error) {
      message.error('创建失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (open && initialPosition) {
      form.setFieldsValue({
        latitude: Number(initialPosition.lat.toFixed(8)),
        longitude: Number(initialPosition.lng.toFixed(8)),
      });
    }
  }, [open, initialPosition, form]);

  return (
    <Modal
      title="创建 POI"
      open={open}
      onOk={handleSubmit}
      onCancel={onCancel}
      confirmLoading={loading}
      okText="创建"
      cancelText="取消"
      className="rounded-modal"
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          latitude: initialPosition ? Number(initialPosition.lat.toFixed(8)) : undefined,
          longitude: initialPosition ? Number(initialPosition.lng.toFixed(8)) : undefined,
        }}
      >
        <Form.Item
          name="name"
          label="名称"
          rules={[{ required: true, message: '请输入POI名称' }]}
        >
          <Input placeholder="景点名称" />
        </Form.Item>

        <Form.Item
          name="type"
          label="类型"
          rules={[{ required: true, message: '请选择类型' }]}
        >
          <Select placeholder="选择类型" options={POI_TYPES} />
        </Form.Item>

        <Space direction="horizontal" style={{ width: '100%' }} className="cursor-pointer">
          <Form.Item
            name="latitude"
            label="纬度"
            rules={[
              { required: true, message: '请输入纬度' },
              { type: 'number', min: -90, max: 90, message: '纬度范围 -90 到 90' },
            ]}
            className="flex-1"
          >
            <InputNumber placeholder="25.0968" step={0.00000001} className="w-full" />
          </Form.Item>

          <Form.Item
            name="longitude"
            label="经度"
            rules={[
              { required: true, message: '请输入经度' },
              { type: 'number', min: -180, max: 180, message: '经度范围 -180 到 180' },
            ]}
            className="flex-1"
          >
            <InputNumber placeholder="102.8463" step={0.00000001} className="w-full" />
          </Form.Item>
        </Space>

        <Form.Item name="tags" label="标签">
          <Select
            mode="multiple"
            placeholder="选择标签"
            options={POI_TAGS}
          />
        </Form.Item>

        <Form.Item name="note" label="备注">
          <Input.TextArea placeholder="添加备注信息..." rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreatePOIModal;
