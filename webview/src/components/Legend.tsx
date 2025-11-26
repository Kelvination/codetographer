import { memo, useState } from 'react';
import type { CGraphLegend } from '../types/cgraph';

interface LegendProps {
  legend: CGraphLegend;
  selectedColor?: string | null;
  onSelectColor?: (color: string | null) => void;
}

function LegendComponent({ legend, selectedColor, onSelectColor }: LegendProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleItemClick = (color: string) => {
    if (!onSelectColor) return;
    // Toggle: if same color clicked, deselect
    onSelectColor(selectedColor === color ? null : color);
  };

  if (!isExpanded) {
    return (
      <button
        className="legend-toggle-btn"
        onClick={() => setIsExpanded(true)}
      >
        Show Legend
      </button>
    );
  }

  return (
    <div className="graph-legend">
      {legend.title && <div className="legend-title">{legend.title}</div>}
      <div className="legend-items">
        {legend.items.map((item, index) => (
          <div
            key={index}
            className={`legend-item ${onSelectColor ? 'clickable' : ''} ${selectedColor === item.color ? 'selected' : ''}`}
            onClick={() => handleItemClick(item.color)}
          >
            <span
              className="legend-color"
              style={{ backgroundColor: item.color }}
            />
            <span className="legend-label">{item.label}</span>
          </div>
        ))}
      </div>
      <button
        className="legend-hide-btn"
        onClick={() => setIsExpanded(false)}
      >
        Hide Legend
      </button>
    </div>
  );
}

export const Legend = memo(LegendComponent);
