import { memo } from 'react';
import type { CGraphLegend } from '../types/cgraph';

interface LegendProps {
  legend: CGraphLegend;
}

function LegendComponent({ legend }: LegendProps) {
  return (
    <div className="graph-legend">
      {legend.title && <div className="legend-title">{legend.title}</div>}
      <div className="legend-items">
        {legend.items.map((item, index) => (
          <div key={index} className="legend-item">
            <span
              className="legend-color"
              style={{ backgroundColor: item.color }}
            />
            <span className="legend-label">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const Legend = memo(LegendComponent);
