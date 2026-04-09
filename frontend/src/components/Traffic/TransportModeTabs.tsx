import React from 'react';
import { Tabs } from 'antd';

interface TransportModeTabsProps {
  value?: string;
  onChange?: (mode: string) => void;
}

const CONVENTIONAL_MODES = [
  { key: 'bus', label: '公交' },
  { key: 'subway', label: '地铁' },
  { key: 'taxi', label: '出租车' },
  { key: 'walk', label: '步行' },
];

const NICHE_MODES = [
  { key: 'bicycle', label: '自行车' },
  { key: 'motorcycle', label: '摩托车' },
  { key: 'ferry', label: '渡轮' },
  { key: 'shuttle', label: '班车' },
  { key: 'hiking', label: '徒步' },
];

const TransportModeTabs: React.FC<TransportModeTabsProps> = ({
  value,
  onChange,
}) => {
  const handleChange = (key: string) => {
    onChange?.(key);
  };

  return (
    <Tabs
      activeKey={value}
      onChange={handleChange}
      items={[
        {
          key: 'conventional',
          label: '常规',
          children: (
            <div className="flex gap-2 flex-wrap">
              {CONVENTIONAL_MODES.map((mode) => (
                <span
                  key={mode.key}
                  className={`px-3 py-1.5 rounded-full cursor-pointer min-h-[40px] inline-flex items-center transition-all duration-normal ${
                    value === mode.key
                      ? 'traced-sunset-gradient text-on-primary shadow-soft-sm'
                      : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                  }`}
                  onClick={() => onChange?.(mode.key)}
                >
                  {mode.label}
                </span>
              ))}
            </div>
          ),
        },
        {
          key: 'niche',
          label: '小众',
          children: (
            <div className="flex gap-2 flex-wrap">
              {NICHE_MODES.map((mode) => (
                <span
                  key={mode.key}
                  className={`px-3 py-1.5 rounded-full cursor-pointer min-h-[40px] inline-flex items-center transition-all duration-normal ${
                    value === mode.key
                      ? 'traced-sunset-gradient text-on-primary shadow-soft-sm'
                      : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                  }`}
                  onClick={() => onChange?.(mode.key)}
                >
                  {mode.label}
                </span>
              ))}
            </div>
          ),
        },
      ]}
    />
  );
};

export default TransportModeTabs;
