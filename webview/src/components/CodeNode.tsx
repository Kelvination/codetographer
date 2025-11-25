import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { CGraphNode, CGraphLocation } from '../types/cgraph';

const typeConfig: Record<CGraphNode['type'], { icon: string; color: string }> = {
  function: { icon: 'f', color: '#4fc1ff' },
  method: { icon: 'm', color: '#dcdcaa' },
  class: { icon: 'C', color: '#4ec9b0' },
  module: { icon: 'M', color: '#c586c0' },
  file: { icon: 'F', color: '#ce9178' },
};

interface CodeNodeData {
  label: string;
  type: CGraphNode['type'];
  location: CGraphLocation;
  description?: string;
  dimmed?: boolean;
}

// Get a brief summary from description (first sentence or ~60 chars)
function getSummary(description: string): string {
  // Try to get first sentence
  const firstSentence = description.split(/[.!?]/)[0];
  if (firstSentence && firstSentence.length <= 60) {
    return firstSentence + (description.length > firstSentence.length ? '.' : '');
  }
  // Otherwise truncate at ~60 chars at word boundary
  if (description.length <= 60) return description;
  const truncated = description.slice(0, 60);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated) + '...';
}

function CodeNodeComponent({ data, selected }: NodeProps<CodeNodeData>) {
  const [expanded, setExpanded] = useState(false);
  const config = typeConfig[data.type] || typeConfig.function;

  const classes = [
    'code-node',
    selected ? 'selected' : '',
    data.dimmed ? 'dimmed' : '',
    expanded ? 'expanded' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const hasDescription = !!data.description;
  const summary = hasDescription ? getSummary(data.description!) : '';
  const hasMoreContent = hasDescription && data.description!.length > summary.length;

  const filePath = data.location.file.split('/').pop() || data.location.file;
  const lineRef = data.location.endLine
    ? `L${data.location.startLine}-${data.location.endLine}`
    : `L${data.location.startLine}`;

  return (
    <>
      {/* Handles on all four sides for flexible edge connections */}
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Right} id="right" />
      <div className={classes}>
        <div className="node-header">
          <span
            className="node-icon"
            style={{ backgroundColor: config.color }}
          >
            {config.icon}
          </span>
          <span className="node-label">{data.label}</span>
          {hasMoreContent && (
            <button
              className="expand-btn"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
            >
              {expanded ? '−' : '+'}
            </button>
          )}
        </div>

        {/* Always show summary if description exists */}
        {hasDescription && (
          <div className="node-summary">{summary}</div>
        )}

        <div className="node-location">
          <span className="file-name">{filePath}</span>
          <span className="line-ref">{lineRef}</span>
        </div>

        {/* Full description only shown when expanded */}
        {hasMoreContent && expanded && (
          <div className="node-description show">
            {data.description}
          </div>
        )}
      </div>
    </>
  );
}

export const CodeNode = memo(CodeNodeComponent);
