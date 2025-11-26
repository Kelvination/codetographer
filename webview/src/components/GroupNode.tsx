import { memo } from 'react';
import { NodeResizer } from '@xyflow/react';

export interface GroupNodeData {
  label: string;
  description?: string;
  color: string;
  width: number;
  height: number;
  groupId?: string;
  dimmed?: boolean;
}

interface GroupNodeProps {
  data: GroupNodeData;
  selected?: boolean;
}

function GroupNodeComponent({ data, selected }: GroupNodeProps) {
  // Extract the base color from rgba and create a more visible border
  const borderColor = data.color.replace(/[\d.]+\)$/, '0.5)');

  return (
    <>
      <NodeResizer
        minWidth={150}
        minHeight={100}
        isVisible={selected}
        lineStyle={{ borderColor: borderColor, borderWidth: 2 }}
        handleStyle={{
          backgroundColor: 'var(--vscode-button-background)',
          borderColor: borderColor,
          width: 10,
          height: 10,
        }}
      />
      <div
        className={`group-node ${data.dimmed ? 'dimmed' : ''}`}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: data.color,
          borderColor: borderColor,
        }}
      >
        <div className="group-label">{data.label}</div>
      </div>
    </>
  );
}

export const GroupNode = memo(GroupNodeComponent);
