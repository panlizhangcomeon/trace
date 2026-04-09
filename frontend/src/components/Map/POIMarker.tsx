import React, { useState } from 'react';
import { POI } from '../../services/api';
import { colors } from '../../styles/theme';

interface POIMarkerProps {
  poi: POI;
  isSelected: boolean;
  onClick?: () => void;
}

const POI_TYPES: Record<string, { icon: string; color: string }> = {
  attraction: { icon: '📍', color: colors.primary },
  food: { icon: '🍜', color: colors.secondary },
  accommodation: { icon: '🏨', color: '#52c41a' },
  checkin: { icon: '📸', color: '#1890ff' },
  supply: { icon: '🏪', color: '#faad14' },
};

const POIMarker: React.FC<POIMarkerProps> = ({ poi, isSelected, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  const typeConfig = POI_TYPES[poi.type] || POI_TYPES.attraction;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.();
  };

  return (
    <div
      className="relative cursor-pointer transition-all duration-normal"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      {/* Hit area - 44px touch target */}
      <div className="absolute -top-2 -left-2 w-11 h-11" />

      {/* Marker */}
      <div
        className="flex items-center justify-center w-8 h-8 rounded-full shadow-soft-md border-2 border-white transition-all duration-normal"
        style={{
          backgroundColor: typeConfig.color,
          boxShadow: isHovered || isSelected
            ? '0 8px 24px rgba(62, 48, 38, 0.22)'
            : '0 4px 12px rgba(62, 48, 38, 0.1)',
        }}
      >
        <span className="text-white text-sm">{typeConfig.icon}</span>
      </div>

      {/* Selected indicator */}
      {isSelected && (
        <div
          className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 rounded-full border-2 border-white"
          style={{ backgroundColor: colors.primary }}
        />
      )}

      {/* Label */}
      {(isHovered || isSelected) && (
        <div
          className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 px-2 py-1 rounded whitespace-nowrap text-xs text-white shadow-md z-10 transition-opacity duration-normal"
          style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
        >
          {poi.name}
        </div>
      )}
    </div>
  );
};

export default POIMarker;
