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
  position?: { x: number; y: number }; // Manual position override
}

export interface CGraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'calls' | 'imports' | 'extends' | 'implements' | 'uses';
  label?: string;
  importance?: 'primary' | 'secondary' | 'tertiary'; // Visual weight of the edge
  color?: string; // Custom color (hex or CSS color name)
}

export interface CGraphGroup {
  id: string;
  label: string;
  description?: string;
  color?: string; // Optional custom color
  position?: { x: number; y: number }; // Manual position override
  size?: { width: number; height: number }; // Manual size override
}

export interface CGraphLayout {
  direction?: 'TB' | 'LR' | 'BT' | 'RL';
}

export interface CGraphLegendItem {
  color: string;
  label: string;
}

export interface CGraphLegend {
  title?: string;
  items: CGraphLegendItem[];
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
  legend?: CGraphLegend;
}
