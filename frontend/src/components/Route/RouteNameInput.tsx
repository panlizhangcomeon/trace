import React from 'react';
import { Input } from 'antd';

interface RouteNameInputProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}

const RouteNameInput: React.FC<RouteNameInputProps> = ({
  value,
  onChange,
  placeholder = '输入路线名称...',
}) => {
  return (
    <Input
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      className="route-name-input"
    />
  );
};

export default RouteNameInput;
