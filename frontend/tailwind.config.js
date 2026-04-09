/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // —— 随迹 · 侧栏参考色（暖赭 / 奶油底 / 炭灰字，避免粉桃色）——
        background: '#fdfbf8',
        surface: {
          DEFAULT: '#ffffff',
          bright: '#fdfbf8',
          /** @deprecated 使用 bg-surface-bright */
          bg: '#fdfbf8',
          dim: '#e8e6e2',
          container: '#f3f1ee',
          'container-low': '#efebe6',
          'container-high': '#e8e8e8',
          'container-highest': '#e0ddd8',
          variant: '#e5e2dd',
        },
        primary: {
          DEFAULT: '#8b4513',
          /** 仅作深色强调：偏褐陶土，避免 #c4… 类色在屏上发粉珊瑚感 */
          container: '#6b3a22',
          hover: '#6b3410',
          light: '#ede8e3',
        },
        secondary: {
          DEFAULT: '#526255',
          container: '#d2e4d3',
        },
        tertiary: {
          DEFAULT: '#5c7a6e',
          container: '#a8c4b8',
        },
        'on-surface': '#3d3d3d',
        'on-surface-variant': '#4a4a4a',
        'on-background': '#3d3d3d',
        'on-primary': '#ffffff',
        'on-primary-container': '#3e2720',
        'on-secondary-container': '#566759',
        'on-tertiary': '#ffffff',
        outline: '#8a8279',
        'outline-variant': '#d4cfc7',
        error: '#ba1a1a',
        border: {
          DEFAULT: 'rgba(138, 130, 121, 0.28)',
          light: '#e8e8e8',
        },
        text: {
          primary: '#3d3d3d',
          secondary: '#4a4a4a',
          muted: '#6b6560',
        },
        success: '#2e7d32',
        warning: '#b78103',
        info: '#5c7a6e',
      },
      borderRadius: {
        DEFAULT: '1rem',
        lg: '2rem',
        md: '1.5rem',
        card: '1.5rem',
        button: '9999px',
        modal: '1.5rem',
        pill: '9999px',
      },
      boxShadow: {
        editorial: '0 12px 32px rgba(62, 48, 38, 0.08)',
        'soft-sm': '0 2px 8px rgba(62, 48, 38, 0.06)',
        'soft-md': '0 8px 24px rgba(62, 48, 38, 0.08)',
        'soft-lg': '0 12px 32px rgba(62, 48, 38, 0.1)',
        float: '0 12px 32px rgba(62, 48, 38, 0.08)',
      },
      transitionDuration: {
        micro: '150ms',
        normal: '200ms',
        slow: '300ms',
      },
      fontFamily: {
        sans: [
          '"Noto Sans SC"',
          'Manrope',
          '-apple-system',
          'BlinkMacSystemFont',
          'PingFang SC',
          'Microsoft YaHei',
          'sans-serif',
        ],
        headline: ['"Plus Jakarta Sans"', '"Noto Sans SC"', 'sans-serif'],
        body: ['Manrope', '"Noto Sans SC"', 'sans-serif'],
        label: ['Manrope', '"Noto Sans SC"', 'sans-serif'],
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        '2xl': '48px',
      },
      zIndex: {
        ribbon: '5',
        dropdown: '10',
        sticky: '20',
        modal: '30',
        toast: '40',
      },
    },
  },
  plugins: [],
};
