import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';

interface GroupNodeData {
  label: string;
  description?: string;
  color: string;
  width: number;
  height: number;
}

function GroupNodeComponent({ data }: NodeProps<GroupNodeData>) {
  // Extract the base color from rgba and create a more visible border
  const borderColor = data.color.replace(/[\d.]+\)$/, '0.5)');

  return (
    <div
      className="group-node"
      style={{
        width: data.width,
        height: data.height,
        backgroundColor: data.color,
        borderColor: borderColor,
      }}
    >
      <div className="group-label">{data.label}</div>
    </div>
  );
}

export const GroupNode = memo(GroupNodeComponent);
