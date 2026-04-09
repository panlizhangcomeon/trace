import React, { useMemo } from 'react';
import { Calendar, List, Card, Button, Popconfirm, message } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { Route } from '../../services/api';

interface CalendarSidebarProps {
  routes: Route[];
  selectedDay: number;
  selectedRouteId?: string | null;
  onDaySelect: (day: number) => void;
  onRouteClick: (route: Route) => void;
  onRouteDelete?: (route: Route) => void | Promise<void>;
  /** 插在「当日路线」列表下方，例如站点编辑面板 */
  extra?: React.ReactNode;
  /** 行程开始日，用于把日历上的日期映射为「第几天」而非「当月几号」 */
  tripStartDate?: string | null;
}

const CalendarSidebar: React.FC<CalendarSidebarProps> = ({
  routes,
  selectedDay,
  selectedRouteId = null,
  onDaySelect,
  onRouteClick,
  onRouteDelete,
  extra,
  tripStartDate,
}) => {
  const maxItineraryDay = useMemo(
    () => Math.max(1, ...routes.map((r) => Number(r.day_number) || 0)),
    [routes]
  );

  const routesByDay = routes.reduce(
    (acc, route) => {
      const day = Number(route.day_number);
      if (!acc[day]) acc[day] = [];
      acc[day].push(route);
      return acc;
    },
    {} as Record<number, Route[]>
  );

  const handleCalendarSelect = (date: Dayjs) => {
    if (tripStartDate) {
      const start = dayjs(tripStartDate).startOf('day');
      const picked = date.startOf('day');
      const diff = picked.diff(start, 'day');
      if (diff >= 0 && diff < maxItineraryDay) {
        onDaySelect(diff + 1);
        return;
      }
      message.info('所选日期不在当前行程天数范围内，请点上方的 Day 切换');
      return;
    }
    message.info('行程未设置开始日期时，请用顶部「Day 1 / Day 2」切换');
  };

  return (
    <aside className="calendar-sidebar w-64 md:w-72 shrink-0 p-3 md:p-4 bg-surface-container-low overflow-y-auto border-r border-transparent shadow-[1px_0_0_rgba(62,48,38,0.07)]">
      <div className="rounded-2xl bg-surface p-2 editorial-shadow">
        <Calendar
          fullscreen={false}
          onSelect={(d) => handleCalendarSelect(d)}
          headerRender={({ value }) => (
            <div className="flex justify-between items-center mb-2 px-1">
              <span className="text-base font-headline font-semibold text-on-surface">
                {value.year()} 年 {value.month() + 1} 月
              </span>
            </div>
          )}
        />
      </div>

      <div className="mt-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3 px-1">
          Day {selectedDay} 路线
        </h3>
        <List
          dataSource={routesByDay[selectedDay] || []}
          renderItem={(route) => (
            <List.Item className="border-none px-0 py-1.5">
              <Card
                size="small"
                className={[
                  'w-full rounded-2xl cursor-pointer transition-all duration-200 border-0',
                  'bg-surface-container hover:bg-surface-container-high',
                  selectedRouteId === route.id ? 'ring-2 ring-primary/25 editorial-shadow' : '',
                ].join(' ')}
                styles={{ body: { padding: 12 } }}
                onClick={() => onRouteClick(route)}
                style={{ borderInlineStartWidth: 4, borderInlineStartColor: route.color || '#8b4513' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-headline font-semibold text-on-surface text-sm">
                      {route.name || `路线 ${route.day_number}`}
                    </div>
                    <div className="text-xs text-on-surface-variant mt-0.5">
                      {route.pois?.length || 0} 个标点
                    </div>
                  </div>
                  {onRouteDelete ? (
                    <Popconfirm
                      title="删除该路线？"
                      description="路线中的标点仍保留在「标点与搜索」中。"
                      okText="删除"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => void onRouteDelete(route)}
                    >
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        className="shrink-0"
                        aria-label={`删除路线「${route.name || route.day_number}」`}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Popconfirm>
                  ) : null}
                </div>
              </Card>
            </List.Item>
          )}
          locale={{ emptyText: '这一天还没有路线' }}
        />
      </div>

      {extra}
    </aside>
  );
};

export default CalendarSidebar;
