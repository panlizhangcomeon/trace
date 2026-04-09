import React from 'react';
import { Checkbox, Space } from 'antd';

interface CoupleFriendlyFiltersProps {
  value?: string[];
  onChange?: (tags: string[]) => void;
}

const COUPLE_FILTERS = [
  { value: 'double_seat', label: '双人座优先' },
  { value: 'smooth_route', label: '路线平缓' },
  { value: 'safe_night', label: '夜间安全' },
  { value: 'scenic_route', label: '风景优美' },
];

const CoupleFriendlyFilters: React.FC<CoupleFriendlyFiltersProps> = ({
  value = [],
  onChange,
}) => {
  const handleChange = (checkedValues: string[]) => {
    onChange?.(checkedValues);
  };

  return (
    <Space direction="vertical" className="w-full">
      <Checkbox.Group
        value={value}
        onChange={(e) => handleChange(e as string[])}
        className="flex flex-col gap-2"
      >
        {COUPLE_FILTERS.map((filter) => (
          <Checkbox key={filter.value} value={filter.value} className="cursor-pointer">
            <span className="text-text-primary">{filter.label}</span>
          </Checkbox>
        ))}
      </Checkbox.Group>
    </Space>
  );
};

export default CoupleFriendlyFilters;
