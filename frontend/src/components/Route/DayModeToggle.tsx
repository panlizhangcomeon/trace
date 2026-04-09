import React from 'react';

interface DayModeToggleProps {
  currentDay: number;
  totalDays: number;
  onDayChange: (day: number) => void;
}

const DayModeToggle: React.FC<DayModeToggleProps> = ({
  currentDay,
  totalDays,
  onDayChange,
}) => {
  const days = Array.from({ length: totalDays }, (_, i) => i + 1);

  return (
    <div className="flex gap-2 flex-nowrap w-max max-w-full day-mode-toggle">
      {days.map((day) => {
        const active = currentDay === day;
        return (
          <button
            key={day}
            type="button"
            onClick={() => onDayChange(day)}
            className={[
              'rounded-full px-5 py-2.5 text-sm font-semibold transition-colors duration-200 cursor-pointer min-h-[44px] shrink-0',
              active
                ? 'traced-sunset-gradient text-on-primary editorial-shadow'
                : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest',
            ].join(' ')}
          >
            Day {day}
          </button>
        );
      })}
    </div>
  );
};

export default DayModeToggle;
