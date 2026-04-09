import React from 'react';
import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';

interface ShareButtonProps {
  onSaveToDevice: () => void;
  onShareToSocial: (platform: string) => void;
}

const ShareButton: React.FC<ShareButtonProps> = ({ onSaveToDevice, onShareToSocial }) => {
  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'save') {
      onSaveToDevice();
    } else {
      onShareToSocial(key);
    }
  };

  const menuItems: MenuProps['items'] = [
    { key: 'save', label: '保存到本地' },
    { key: 'wechat', label: '分享到微信' },
    { key: 'weibo', label: '分享到微博' },
    { key: 'moments', label: '分享到朋友圈' },
  ];

  return (
    <Dropdown menu={{ items: menuItems, onClick: handleMenuClick }}>
      <button
        type="button"
        className="traced-sunset-gradient text-on-primary font-bold py-2.5 px-6 rounded-full editorial-shadow hover:opacity-95 transition-opacity duration-200 cursor-pointer min-h-[44px] text-sm"
      >
        分享行程
      </button>
    </Dropdown>
  );
};

export default ShareButton;
