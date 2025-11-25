export interface CGraphLocation {
  file: string;
  startLine: number;
  endLine?: number;
}

export interface CGraphNode {
  id: string;
  label: string;
  type: 'function' | 'class' | 'module' | 'file' | 'method';
  description?: string;
  location: CGraphLocation;
  group?: string; // Optional group ID for sectioning
}

export interface CGraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'calls' | 'imports' | 'extends' | 'implements' | 'uses';
  label?: string;
}

export interface CGraphGroup {
  id: string;
  label: string;
  description?: string;
  color?: string; // Optional custom color
}

export interface CGraphLayout {
  direction?: 'TB' | 'LR' | 'BT' | 'RL';
}

export interface CGraphMetadata {
  title: string;
  description?: string;
  generated: string;
  scope?: string;
}

export interface CGraph {
  version: string;
  metadata: CGraphMetadata;
  nodes: CGraphNode[];
  edges: CGraphEdge[];
  groups?: CGraphGroup[];
  layout?: CGraphLayout;
}
