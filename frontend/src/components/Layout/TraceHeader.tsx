import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

type TraceHeaderVariant = 'editorial' | 'minimal';

interface TraceHeaderProps {
  variant?: TraceHeaderVariant;
  title?: string;
  right?: React.ReactNode;
  className?: string;
}

const navLinkClass = (active: boolean) =>
  [
    'text-sm font-medium transition-colors duration-200 rounded-full px-4 py-2 cursor-pointer min-h-[44px] inline-flex items-center',
    active
      ? 'bg-primary text-on-primary'
      : 'text-on-surface-variant hover:bg-surface-container-high',
  ].join(' ');

/**
 * 随迹 · 编辑风顶栏：毛玻璃 + 无硬分割线（与 PRD / stitch 参考一致）
 */
const TraceHeader: React.FC<TraceHeaderProps> = ({
  variant = 'editorial',
  title = '随迹',
  right,
  className = '',
}) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (variant === 'minimal') {
    return (
      <header
        className={`sticky top-0 z-sticky flex items-center justify-between gap-4 px-4 py-3 bg-surface-bright/80 backdrop-blur-xl ${className}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="cursor-pointer shrink-0 flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
            aria-label="返回"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
              <path
                fillRule="evenodd"
                d="M11.03 3.97a.75.75 0 010 1.06l-6.22 6.22H21a.75.75 0 010 1.5H4.81l6.22 6.22a.75.75 0 11-1.06 1.06l-7.5-7.5a.75.75 0 010-1.06l7.5-7.5a.75.75 0 011.06 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <h1 className="font-headline text-lg font-bold text-primary truncate tracking-tight">{title}</h1>
        </div>
        {right ? <div className="shrink-0 flex items-center gap-2">{right}</div> : null}
      </header>
    );
  }

  const tripsActive = pathname === '/' || pathname.startsWith('/trips');
  const poisActive = pathname.startsWith('/pois');
  const createActive = pathname.startsWith('/routes/create');

  return (
    <header
      className={`sticky top-0 z-sticky w-full px-4 md:px-8 py-3 bg-surface-bright/80 backdrop-blur-xl ${className}`}
    >
      <div className="max-w-6xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          to="/"
          className="font-headline text-xl font-bold tracking-wide text-primary cursor-pointer shrink-0 hover:opacity-90 transition-opacity"
        >
          随迹
        </Link>
        <nav className="flex flex-wrap items-center gap-2" aria-label="主导航">
          <Link to="/trips" className={navLinkClass(tripsActive)}>
            我的行程
          </Link>
          <Link to="/pois" className={navLinkClass(poisActive)}>
            标点与搜索
          </Link>
          <Link to="/routes/create" className={navLinkClass(createActive)}>
            规划路线
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default TraceHeader;
