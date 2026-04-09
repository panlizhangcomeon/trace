import React, { useState, useEffect } from 'react';
import { Modal, List, Tag, Space, Spin, message } from 'antd';
import { TrafficOption, trafficApi, POI } from '../../services/api';

interface TrafficPanelProps {
  open: boolean;
  onCancel: () => void;
  fromPoi: POI | null;
  toPoi: POI | null;
  coupleFriendly?: boolean;
}

const MODE_LABELS: Record<string, string> = {
  bus: '公交',
  subway: '地铁',
  taxi: '出租车',
  walk: '步行',
  bicycle: '自行车',
  motorcycle: '摩托车',
  ferry: '渡轮',
  shuttle: '班车',
  hiking: '徒步',
};

const COUPLE_TAGS: Record<string, { color: string; label: string }> = {
  double_seat: { color: '#8b4513', label: '双人座' },
  smooth_route: { color: 'green', label: '路线平缓' },
  safe_night: { color: 'blue', label: '夜间安全' },
  scenic_route: { color: 'orange', label: '风景优美' },
};

const TrafficPanel: React.FC<TrafficPanelProps> = ({
  open,
  onCancel,
  fromPoi,
  toPoi,
  coupleFriendly = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<TrafficOption[]>([]);

  useEffect(() => {
    if (open && fromPoi && toPoi) {
      fetchTrafficOptions();
    }
  }, [open, fromPoi, toPoi, coupleFriendly]);

  const fetchTrafficOptions = async () => {
    if (!fromPoi || !toPoi) return;

    try {
      setLoading(true);
      const response = await trafficApi.getOptions(
        fromPoi.id,
        toPoi.id,
        coupleFriendly
      );
      setOptions(response.data.options);
    } catch (error) {
      message.error('获取交通方案失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={`交通方案: ${fromPoi?.name || ''} → ${toPoi?.name || ''}`}
      open={open}
      onCancel={onCancel}
      footer={null}
      width={500}
      className="rounded-modal"
    >
      {loading ? (
        <div className="flex justify-center items-center py-8">
          <Spin size="large" />
        </div>
      ) : (
        <List
          dataSource={options}
          renderItem={(option) => (
            <List.Item
              key={option.id}
              extra={
                <div className="text-right">
                  <div className="text-lg font-medium text-primary">
                    ¥{option.cost?.toFixed(2) || '--'}
                  </div>
                  <div className="text-xs text-text-muted">
                    ≈ {option.duration_minutes} 分钟
                  </div>
                </div>
              }
            >
              <List.Item.Meta
                title={
                  <Space>
                    <Tag color="blue">{MODE_LABELS[option.mode] || option.mode}</Tag>
                    {option.operating_hours && (
                      <span className="text-xs text-text-muted">
                        {option.operating_hours}
                      </span>
                    )}
                  </Space>
                }
                description={
                  option.couple_friendly_tags.length > 0 ? (
                    <Space className="mt-1">
                      {option.couple_friendly_tags.map((tag) => (
                        <Tag key={tag} color={COUPLE_TAGS[tag]?.color || 'default'}>
                          {COUPLE_TAGS[tag]?.label || tag}
                        </Tag>
                      ))}
                    </Space>
                  ) : null
                }
              />
            </List.Item>
          )}
          locale={{ emptyText: '暂无交通方案' }}
        />
      )}
    </Modal>
  );
};

export default TrafficPanel;
