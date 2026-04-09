import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Collapse,
  DatePicker,
  Input,
  message,
  Modal,
  Progress,
  Space,
} from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import TraceHeader from '../components/Layout/TraceHeader';
import {
  CommitWarning,
  ItineraryDraftV1,
  smartTripApi,
} from '../services/api';

const STORAGE_KEY = 'trace_smart_trip_draft_v1';
const MAX_USER_TEXT = 8000;

type Step = 'fill' | 'preview';

const SmartTripCreate: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('fill');
  const [userText, setUserText] = useState('');
  const [draft, setDraft] = useState<ItineraryDraftV1 | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [commitLoading, setCommitLoading] = useState(false);
  const [tripName, setTripName] = useState('');
  const [tripDestination, setTripDestination] = useState('');
  const [tripStartDate, setTripStartDate] = useState<Dayjs | null>(null);

  const persistDraft = useCallback((text: string, d: ItineraryDraftV1 | null) => {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ user_text: text, draft: d })
      );
    } catch {
      /* ignore quota */
    }
  }, []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { user_text?: string; draft?: ItineraryDraftV1 };
      if (parsed.user_text) setUserText(parsed.user_text);
      if (parsed.draft?.schema_version === '1') {
        setDraft(parsed.draft);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    persistDraft(userText, draft);
  }, [userText, draft, persistDraft]);

  const handleGenerateDraft = async () => {
    const t = userText.trim();
    if (!t) {
      message.error('请先描述你的旅行设想');
      return;
    }
    if (draftLoading) return;
    setDraftLoading(true);
    try {
      const { data } = await smartTripApi.draft({ user_text: t, locale: 'zh-CN' });
      setDraft(data.draft);
      setTripName(data.draft.trip_summary.title_hint || '');
      setTripDestination(data.draft.trip_summary.destination_summary || '');
      setStep('preview');
      message.success('草案已生成，请确认后创建行程');
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string; error?: string } } };
      const msg =
        ax.response?.data?.message ||
        (ax.response?.data?.error === 'llm_timeout'
          ? '生成超时，请缩短描述或稍后重试'
          : '生成行程草案失败，请稍后重试');
      Modal.error({
        title: '无法生成草案',
        content: msg,
        okText: '返回修改',
      });
    } finally {
      setDraftLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!draft || commitLoading) return;
    setCommitLoading(true);
    try {
      const { data } = await smartTripApi.commit({
        draft,
        trip: {
          name: tripName || null,
          destination: tripDestination || null,
          start_date: tripStartDate ? tripStartDate.format('YYYY-MM-DD') : null,
        },
      });
      const warnings = data.warnings ?? [];
      const go = () => {
        sessionStorage.removeItem(STORAGE_KEY);
        message.success('行程已创建');
        navigate(`/trips/${data.trip.id}`);
      };
      if (warnings.length > 0) {
        Modal.warning({
          title: '部分地点未能自动匹配',
          width: 480,
          content: (
            <div className="space-y-2">
              <Alert
                type="warning"
                showIcon
                message="已创建行程，下列景点未在地图服务中找到，可在详情中手动补充。"
              />
              <ul className="list-disc pl-5 text-sm text-on-surface-variant space-y-1">
                {warnings.map((w: CommitWarning, i: number) => (
                  <li key={`${w.day_index}-${w.stop_display_name}-${i}`}>
                    Day {w.day_index} · {w.stop_display_name}
                    {w.code ? `（${w.code}）` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ),
          okText: '前往行程详情',
          onOk: go,
        });
      } else {
        go();
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      Modal.error({
        title: '创建失败',
        content: ax.response?.data?.message || '保存行程失败，请稍后重试',
        okText: '返回修改',
      });
    } finally {
      setCommitLoading(false);
    }
  };

  const collapseItems = useMemo(() => {
    if (!draft) return [];
    return draft.days.map((day) => ({
      key: String(day.day_index),
      label: `Day ${day.day_index} · ${day.city_context}`,
      children: (
        <ul className="list-none space-y-3 p-0 m-0">
          {day.stops.map((s, idx) => (
            <li
              key={`${day.day_index}-${idx}-${s.display_name}`}
              className="rounded-xl bg-surface-container-low px-4 py-3 text-sm"
            >
              <div className="font-semibold text-on-surface">{s.display_name}</div>
              {s.duration_minutes != null && (
                <div className="text-on-surface-variant mt-1">停留约 {s.duration_minutes} 分钟</div>
              )}
              {s.notes && <div className="text-on-surface-variant mt-1">{s.notes}</div>}
            </li>
          ))}
        </ul>
      ),
    }));
  }, [draft]);

  return (
    <div className="min-h-screen bg-surface-bright text-on-surface pb-24">
      <TraceHeader variant="editorial" />
      <main className="max-w-3xl mx-auto px-4 md:px-8 pt-10 md:pt-14">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">
            Smart trip
          </p>
          <h1 className="font-headline text-3xl font-extrabold text-primary mt-1">
            智能创建行程
          </h1>
          <p className="text-on-surface-variant mt-2 max-w-xl">
            用自然语言写下天数、城市与想去的景点；我们会生成草案供你确认，再匹配地图上的地点。
          </p>
        </div>

        {step === 'fill' && (
          <div className="space-y-6">
            <Input.TextArea
              value={userText}
              onChange={(e) => setUserText(e.target.value)}
              placeholder="例如：Day1 杭州西湖与灵隐，Day2 乌镇东栅住一晚…"
              maxLength={MAX_USER_TEXT}
              showCount
              autoSize={{ minRows: 10, maxRows: 20 }}
              className="text-base"
            />
            {draftLoading && (
              <div className="space-y-2">
                <Progress percent={0} status="active" showInfo={false} strokeColor="#FF6B81" />
                <p className="text-sm text-on-surface-variant">正在解析行程…</p>
              </div>
            )}
            <Space wrap>
              <Button type="primary" size="large" loading={draftLoading} onClick={() => void handleGenerateDraft()}>
                生成行程草案
              </Button>
              <Button size="large" onClick={() => navigate('/trips')}>
                返回列表
              </Button>
            </Space>
          </div>
        )}

        {step === 'preview' && draft && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm font-medium text-on-surface-variant mb-1">行程名称</div>
                <Input value={tripName} onChange={(e) => setTripName(e.target.value)} size="large" />
              </div>
              <div>
                <div className="text-sm font-medium text-on-surface-variant mb-1">目的地</div>
                <Input
                  value={tripDestination}
                  onChange={(e) => setTripDestination(e.target.value)}
                  size="large"
                />
              </div>
              <div className="md:col-span-2">
                <div className="text-sm font-medium text-on-surface-variant mb-1">开始日期（可选）</div>
                <DatePicker
                  className="w-full max-w-xs"
                  size="large"
                  value={tripStartDate}
                  onChange={(d) => setTripStartDate(d)}
                  disabledDate={(current) => current && current < dayjs().startOf('day')}
                />
              </div>
            </div>

            <Collapse items={collapseItems} defaultActiveKey={draft.days.map((d) => String(d.day_index))} />

            {commitLoading && (
              <div className="space-y-2">
                <Progress percent={0} status="active" showInfo={false} strokeColor="#FF9A44" />
                <p className="text-sm text-on-surface-variant">正在匹配地点并保存…</p>
              </div>
            )}

            <Space wrap>
              <Button
                type="primary"
                size="large"
                loading={commitLoading}
                onClick={() => void handleCommit()}
              >
                确认创建行程
              </Button>
              <Button
                size="large"
                disabled={commitLoading}
                onClick={() => {
                  setStep('fill');
                  setDraft(null);
                }}
              >
                返回修改
              </Button>
            </Space>
          </div>
        )}
      </main>
    </div>
  );
};

export default SmartTripCreate;
