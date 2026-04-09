import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Space, message, Modal, Form, Input, DatePicker, Spin } from 'antd';
import type { Dayjs } from 'dayjs';
import { Trip, tripApi, unwrapTripList } from '../services/api';
import TraceHeader from '../components/Layout/TraceHeader';

const TripList: React.FC = () => {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    void fetchTrips();
  }, []);

  const fetchTrips = async () => {
    setLoading(true);
    try {
      const response = await tripApi.list();
      setTrips(unwrapTripList(response.data));
    } catch {
      message.error('获取行程列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTrip = async (values: { name: string; destination: string; start_date: Dayjs | null }) => {
    setCreateLoading(true);
    try {
      const response = await tripApi.create({
        name: values.name,
        destination: values.destination,
        start_date: values.start_date?.format('YYYY-MM-DD') ?? undefined,
      });
      message.success('行程创建成功');
      setTrips((prev) => [response.data, ...prev]);
      setCreateModalOpen(false);
      form.resetFields();
      navigate(`/trips/${response.data.id}`);
    } catch {
      message.error('行程创建失败');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteTrip = async (tripId: string) => {
    try {
      await tripApi.delete(tripId);
      message.success('行程删除成功');
      setTrips((prev) => prev.filter((t) => t.id !== tripId));
    } catch {
      message.error('行程删除失败');
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '未设置';
    return dateStr;
  };

  return (
    <div className="min-h-screen bg-surface-bright text-on-surface pb-24">
      <TraceHeader variant="editorial" />

      <main className="max-w-6xl mx-auto px-4 md:px-8 pt-10 md:pt-14">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between mb-10">
          <div className="space-y-2 ml-0 md:ml-1">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">Trace rituals</p>
            <h1 className="font-headline text-3xl md:text-4xl font-extrabold tracking-tight text-primary">
              我的行程
            </h1>
            <p className="text-on-surface-variant font-medium max-w-xl leading-relaxed">
              以纸质档案般的触感整理路线：轻盈留白、柔和莫兰迪色，让计划本身也像一段旅程。
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/trips/smart-create')}
              className="rounded-full border-2 border-primary text-primary font-bold py-3.5 px-8 bg-transparent hover:bg-primary/5 transition-colors duration-200 cursor-pointer min-h-[44px]"
            >
              智能创建行程
            </button>
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="traced-sunset-gradient text-on-primary font-bold py-3.5 px-8 rounded-full editorial-shadow hover:opacity-95 transition-opacity duration-200 cursor-pointer min-h-[44px]"
            >
              创建新行程
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Spin size="large" />
          </div>
        ) : trips.length === 0 ? (
          <div className="rounded-[2rem] bg-surface-container-low p-10 md:p-14 text-center editorial-shadow">
            <p className="font-headline text-lg font-semibold text-on-surface mb-2">还没有行程档案</p>
            <p className="text-on-surface-variant text-sm mb-8 max-w-md mx-auto leading-relaxed">
              从一个目的地、一句标题开始；随后可在地图与日程里不断丰满它。
            </p>
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="traced-sunset-gradient text-on-primary font-bold py-3 px-8 rounded-full cursor-pointer min-h-[44px] transition-opacity hover:opacity-95"
            >
              创建第一条行程
            </button>
          </div>
        ) : (
          <ul className="flex flex-col gap-5 list-none p-0 m-0">
            {trips.map((trip, index) => (
              <li key={trip.id}>
                <article
                  className={[
                    'group cursor-pointer rounded-[1.5rem] p-6 md:p-8 transition-colors duration-200 editorial-shadow',
                    index % 2 === 0 ? 'bg-surface-container-low' : 'bg-surface-container',
                    'hover:bg-surface-container-high',
                  ].join(' ')}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/trips/${trip.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/trips/${trip.id}`);
                    }
                  }}
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="min-w-0 space-y-2">
                      <h2 className="font-headline text-xl md:text-2xl font-bold text-on-surface truncate">
                        {trip.name || '未命名行程'}
                      </h2>
                      <p className="text-on-surface-variant">
                        <span className="font-medium text-on-surface-variant/80">目的地</span>{' '}
                        {trip.destination || '未设置'}
                      </p>
                      <p className="text-sm text-on-surface-variant">
                        开始 {formatDate(trip.start_date)} · 路线 {trip.routes?.length || 0} 条
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        className="rounded-full bg-surface-container-high text-on-surface px-5 py-2.5 text-sm font-semibold cursor-pointer min-h-[44px] transition-colors hover:bg-surface-container-highest"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/trips/${trip.id}?edit=1`);
                        }}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        className="rounded-full bg-secondary-container text-on-secondary-container px-5 py-2.5 text-sm font-semibold cursor-pointer min-h-[44px] transition-opacity hover:opacity-90"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/trips/${trip.id}`);
                        }}
                      >
                        打开详情
                      </button>
                      <button
                        type="button"
                        className="rounded-full px-4 py-2.5 text-sm font-medium text-error cursor-pointer min-h-[44px] hover:bg-error/5 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          Modal.confirm({
                            title: '删除这条行程？',
                            content: '此操作不可恢复。',
                            okText: '删除',
                            okType: 'danger',
                            cancelText: '取消',
                            onOk: () => void handleDeleteTrip(trip.id),
                          });
                        }}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </main>

      <Modal
        title={<span className="font-headline font-bold text-primary">创建行程</span>}
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          form.resetFields();
        }}
        footer={null}
        width={440}
        classNames={{ body: 'pt-2' }}
      >
        <Form form={form} layout="vertical" onFinish={(v) => void handleCreateTrip(v)} className="mt-2">
          <Form.Item
            label="行程名称"
            name="name"
            rules={[{ required: true, message: '请输入行程名称' }]}
          >
            <Input placeholder="如：徽州慢旅 · 烟雨人间" size="large" />
          </Form.Item>

          <Form.Item
            label="目的地"
            name="destination"
            rules={[{ required: true, message: '请输入目的地' }]}
          >
            <Input placeholder="如：婺源 / 大理" size="large" />
          </Form.Item>

          <Form.Item label="开始日期" name="start_date">
            <DatePicker className="w-full" size="large" />
          </Form.Item>

          <Form.Item className="mb-0 mt-6">
            <Space className="w-full justify-end">
              <Button
                size="large"
                onClick={() => {
                  setCreateModalOpen(false);
                  form.resetFields();
                }}
              >
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={createLoading} size="large">
                创建
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TripList;
