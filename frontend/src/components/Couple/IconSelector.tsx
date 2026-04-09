import React from 'react';
import { Modal, Grid } from 'antd';

const { useBreakpoint } = Grid;

interface IconSelectorProps {
  open: boolean;
  onCancel: () => void;
  onSelect: (icon: string) => void;
  selectedIcon?: string;
}

const ICONS = [
  { id: 'heart', emoji: '❤️', name: '爱心' },
  { id: 'couple', emoji: '👫', name: '情侣' },
  { id: 'star', emoji: '⭐', name: '星星' },
  { id: 'sparkles', emoji: '✨', name: '闪光' },
  { id: 'rainbow', emoji: '🌈', name: '彩虹' },
  { id: 'sun', emoji: '🌅', name: '日出' },
  { id: 'flower', emoji: '🌸', name: '樱花' },
  { id: 'butterfly', emoji: '🦋', name: '蝴蝶' },
];

const IconSelector: React.FC<IconSelectorProps> = ({
  open,
  onCancel,
  onSelect,
  selectedIcon,
}) => {
  const screens = useBreakpoint();

  return (
    <Modal
      title="选择图标"
      open={open}
      onCancel={onCancel}
      footer={null}
      width={screens.sm ? 400 : '90%'}
      className="rounded-modal"
    >
      <div className="grid grid-cols-4 gap-3">
        {ICONS.map((icon) => (
          <div
            key={icon.id}
            className={`flex flex-col items-center p-3 rounded-2xl cursor-pointer min-h-[44px] transition-all duration-200 ${
              selectedIcon === icon.id
                ? 'traced-sunset-gradient text-on-primary editorial-shadow'
                : 'bg-surface-container-low hover:bg-surface-container text-on-surface'
            }`}
            onClick={() => {
              onSelect(icon.id);
              onCancel();
            }}
          >
            <span className="text-3xl">{icon.emoji}</span>
            <span className="text-xs mt-1">{icon.name}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
};

export default IconSelector;
