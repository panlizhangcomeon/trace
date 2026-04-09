/**
 * Ant Design：与 Tailwind 一致 —  saddle brown / 深褐，避免浅桃陶土发粉
 */
export const theme = {
  token: {
    colorPrimary: '#8b4513',
    colorPrimaryHover: '#6b3410',
    colorPrimaryActive: '#5a2d0c',
    colorPrimaryBg: '#efebe6',
    colorPrimaryBgHover: '#e8e8e8',

    colorLink: '#8b4513',
    colorLinkHover: '#6b3410',
    colorLinkActive: '#5a2d0c',

    colorSuccess: '#2e7d32',
    colorWarning: '#b78103',
    colorError: '#b91c1c',
    colorInfo: '#5c7a6e',

    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorBgLayout: '#fdfbf8',

    colorBorder: 'rgba(138, 130, 121, 0.32)',
    colorBorderSecondary: '#e8e8e8',

    colorText: '#3d3d3d',
    colorTextSecondary: '#4a4a4a',
    colorTextTertiary: '#6b6560',

    borderRadius: 16,
    borderRadiusLG: 24,
    borderRadiusSM: 8,

    fontFamily:
      '"Noto Sans SC", Manrope, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
    fontSize: 15,
    lineHeight: 1.55,

    motionDurationFast: '150ms',
    motionDurationMid: '200ms',
    motionDurationSlow: '300ms',

    controlHeight: 44,
  },
  components: {
    Button: {
      colorPrimary: '#8b4513',
      colorPrimaryHover: '#6b3410',
      colorPrimaryActive: '#5a2d0c',
      borderRadius: 9999,
      controlHeight: 44,
      paddingInline: 24,
      fontWeight: 600,
      primaryShadow: '0 8px 24px rgba(90, 45, 12, 0.18)',
    },
    Card: {
      borderRadiusLG: 24,
      paddingLG: 20,
      boxShadow: '0 12px 32px rgba(62, 48, 38, 0.08)',
      colorBorderSecondary: 'transparent',
    },
    Input: {
      borderRadius: 9999,
      controlHeight: 44,
      colorBgContainer: '#e0ddd8',
      colorBorder: 'transparent',
      activeBorderColor: '#8b4513',
      hoverBorderColor: 'transparent',
      activeShadow: '0 0 0 2px rgba(139, 69, 19, 0.22)',
    },
    Select: {
      borderRadius: 16,
      controlHeight: 44,
      colorBgContainer: '#ffffff',
    },
    Modal: {
      borderRadiusLG: 24,
      paddingContentHorizontalLG: 24,
    },
    Menu: {
      colorPrimary: '#8b4513',
      itemSelectedColor: '#8b4513',
      itemSelectedBg: '#e8e8e8',
      itemHoverBg: 'rgba(139, 69, 19, 0.08)',
    },
    Tag: {
      borderRadiusSM: 9999,
    },
    Tabs: {
      colorPrimary: '#8b4513',
      inkBarColor: '#8b4513',
      itemSelectedColor: '#8b4513',
      itemHoverColor: '#6b3410',
    },
    Switch: {
      colorPrimary: '#526255',
      colorPrimaryHover: '#3d4a3f',
    },
    Checkbox: {
      colorPrimary: '#8b4513',
      colorPrimaryHover: '#6b3410',
    },
    Radio: {
      colorPrimary: '#8b4513',
      colorPrimaryHover: '#6b3410',
    },
    Slider: {
      trackBg: '#d2e4d3',
      trackHoverBg: '#d2e4d3',
      handleColor: '#8b4513',
      handleActiveColor: '#6b3410',
      railBg: '#e8e8e8',
      railHoverBg: '#e8e8e8',
    },
    Calendar: {
      colorPrimary: '#8b4513',
      itemActiveBg: '#efebe6',
    },
    List: {
      colorSplit: 'transparent',
    },
    Spin: {
      colorPrimary: '#8b4513',
    },
  },
};

export const colors = {
  primary: '#8b4513',
  primaryHover: '#6b3410',
  primaryLight: '#9a6239',
  primaryContainer: '#6b3a22',
  secondary: '#526255',
  secondaryLight: '#d2e4d3',
  tertiary: '#5c7a6e',
  surface: '#ffffff',
  surfaceBg: '#fdfbf8',
  surfaceContainer: '#f3f1ee',
  border: 'rgba(138, 130, 121, 0.28)',
  textPrimary: '#3d3d3d',
  textSecondary: '#4a4a4a',
  textMuted: '#6b6560',
  success: '#2e7d32',
  warning: '#b78103',
  error: '#b91c1c',
  info: '#5c7a6e',
  onSurface: '#3d3d3d',
  onSurfaceVariant: '#4a4a4a',
};

export const routeColors = {
  default: '#8b4513',
  start: '#5c7a6e',
  end: '#8b4513',
  hover: '#9a6239',
};

export const shadows = {
  softSm: '0 2px 8px rgba(62, 48, 38, 0.06)',
  softMd: '0 8px 24px rgba(62, 48, 38, 0.08)',
  softLg: '0 12px 32px rgba(62, 48, 38, 0.1)',
  float: '0 12px 32px rgba(62, 48, 38, 0.08)',
};

export const durations = {
  micro: '150ms',
  normal: '200ms',
  slow: '300ms',
};
