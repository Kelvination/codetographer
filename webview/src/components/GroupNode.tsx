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
  return (
    <div
      className="group-node"
      style={{
        width: data.width,
        height: data.height,
        backgroundColor: data.color,
        borderColor: data.color.replace('0.12', '0.4'),
      }}
    >
      <div className="group-label">{data.label}</div>
    </div>
  );
}

export const GroupNode = memo(GroupNodeComponent);
