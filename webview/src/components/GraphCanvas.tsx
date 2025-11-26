import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeMouseHandler,
  MarkerType,
} from '@xyflow/react';
import ELK, { type ElkNode, type ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';
import { CodeNode } from './CodeNode';
import { GroupNode } from './GroupNode';
import { Legend } from './Legend';
import type { CGraph, CGraphLocation, CGraphGroup } from '../types/cgraph';
import '@xyflow/react/dist/style.css';

const elk = new ELK();

const nodeTypes = {
  codeNode: CodeNode,
  groupNode: GroupNode,
};

interface Props {
  graph: CGraph;
  onNavigate: (location: CGraphLocation) => void;
}

// Default group colors
const GROUP_COLORS = [
  'rgba(79, 193, 255, 0.12)',   // blue
  'rgba(78, 201, 176, 0.12)',   // teal
  'rgba(197, 134, 192, 0.12)',  // purple
  'rgba(206, 145, 120, 0.12)',  // orange
  'rgba(220, 220, 170, 0.12)',  // yellow
];

// Calculate node dimensions based on content
// Now accounts for always-visible summary text
function getNodeDimensions(label: string, description?: string): { width: number; height: number } {
  // Width based on label length, but also consider description summary
  const labelWidth = label.length * 8 + 80;
  const descWidth = description ? Math.min(description.length * 6, 280) : 0;
  const baseWidth = Math.max(220, Math.min(320, Math.max(labelWidth, descWidth)));

  // Height: header (32) + location (20) + summary line if description (24) + padding
  const baseHeight = description ? 90 : 60;
  return { width: baseWidth, height: baseHeight };
}

// Get layout options based on layout type
function getLayoutOptions(
  layoutType: 'layered' | 'force' | 'stress',
  direction: string
): Record<string, string> {
  if (layoutType === 'force') {
    // Force-directed layout - compact, web-like
    // Uses layered algorithm with loose settings for more organic feel
    return {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.layered.spacing.nodeNodeBetweenLayers': '150',
      'elk.spacing.nodeNode': '100',
      'elk.spacing.edgeNode': '60',
      'elk.spacing.edgeEdge': '30',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.compaction.postCompaction.strategy': 'EDGE_LENGTH',
      'elk.layered.wrapping.strategy': 'MULTI_EDGE',
      'elk.layered.wrapping.additionalEdgeSpacing': '40',
      'elk.aspectRatio': '1.6',
      'elk.edgeRouting': 'ORTHOGONAL',
    };
  } else if (layoutType === 'stress') {
    // Stress-based layout with edge routing via separate pass
    // Note: stress algorithm doesn't support edge routing directly,
    // so we increase spacing to minimize overlaps
    return {
      'elk.algorithm': 'stress',
      'elk.stress.desiredEdgeLength': '250',
      'elk.stress.iterations': '400',
      'elk.spacing.nodeNode': '150',
      'elk.spacing.edgeNode': '80',
    };
  } else {
    // Default: layered layout - hierarchical tree
    return {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.layered.spacing.nodeNodeBetweenLayers': '120',
      'elk.spacing.nodeNode': '80',
      'elk.spacing.edgeNode': '50',
      'elk.spacing.edgeEdge': '25',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
      'elk.layered.feedbackEdges': 'true',
      'elk.layered.wrapping.strategy': 'OFF',
      'elk.layered.thoroughness': '10',
      'elk.layered.mergeEdges': 'false',
      'elk.nodeLabels.placement': 'INSIDE V_CENTER H_CENTER',
      'elk.edgeRouting': 'ORTHOGONAL',
    };
  }
}

async function layoutGraph(
  graph: CGraph
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  const direction = graph.layout?.direction || 'TB';
  const layoutType = graph.layout?.type || 'layered';
  const hasGroups = graph.groups && graph.groups.length > 0;

  // Build ELK graph structure
  let elkGraph: ElkNode;
  const baseLayoutOptions = getLayoutOptions(layoutType, direction);

  if (hasGroups && graph.groups) {
    // Create hierarchical structure with groups as parent nodes
    const groupMap = new Map<string, CGraphGroup & { color: string }>();
    graph.groups.forEach((g, i) => {
      groupMap.set(g.id, { ...g, color: g.color || GROUP_COLORS[i % GROUP_COLORS.length] });
    });

    // Group nodes by their group
    const nodesByGroup = new Map<string, typeof graph.nodes>();
    const ungroupedNodes: typeof graph.nodes = [];

    graph.nodes.forEach((node) => {
      if (node.group && groupMap.has(node.group)) {
        const existing = nodesByGroup.get(node.group) || [];
        existing.push(node);
        nodesByGroup.set(node.group, existing);
      } else {
        ungroupedNodes.push(node);
      }
    });

    // Create ELK children (groups as compound nodes)
    const elkChildren: ElkNode[] = [];

    // Add group containers with their children
    graph.groups.forEach((group) => {
      const groupNodes = nodesByGroup.get(group.id) || [];
      if (groupNodes.length > 0) {
        elkChildren.push({
          id: `group-${group.id}`,
          layoutOptions: {
            'elk.padding': '[top=50,left=25,bottom=25,right=25]',
            ...getLayoutOptions(layoutType, direction),
          },
          children: groupNodes.map((node) => {
            const dims = getNodeDimensions(node.label, node.description);
            return {
              id: node.id,
              width: dims.width,
              height: dims.height,
            };
          }),
        });
      }
    });

    // Add ungrouped nodes at root level
    ungroupedNodes.forEach((node) => {
      const dims = getNodeDimensions(node.label, node.description);
      elkChildren.push({
        id: node.id,
        width: dims.width,
        height: dims.height,
      });
    });

    elkGraph = {
      id: 'root',
      layoutOptions: {
        ...baseLayoutOptions,
        'elk.spacing.componentComponent': '80',
        'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      },
      children: elkChildren,
      edges: graph.edges.map((edge) => ({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
      })) as ElkExtendedEdge[],
    };
  } else {
    // Simple flat layout
    elkGraph = {
      id: 'root',
      layoutOptions: baseLayoutOptions,
      children: graph.nodes.map((node) => {
        const dims = getNodeDimensions(node.label, node.description);
        return {
          id: node.id,
          width: dims.width,
          height: dims.height,
        };
      }),
      edges: graph.edges.map((edge) => ({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
      })) as ElkExtendedEdge[],
    };
  }

  const layoutedGraph = await elk.layout(elkGraph);

  // Convert ELK result to React Flow nodes
  const nodes: Node[] = [];
  const nodePositions = new Map<string, { x: number; y: number }>();

  // Helper to recursively extract node positions
  function extractPositions(elkNode: ElkNode, offsetX = 0, offsetY = 0) {
    if (elkNode.children) {
      elkNode.children.forEach((child) => {
        const x = (child.x || 0) + offsetX;
        const y = (child.y || 0) + offsetY;

        if (child.id.startsWith('group-')) {
          // This is a group node - add it and recurse into children
          const groupId = child.id.replace('group-', '');
          const groupDef = graph.groups?.find((g) => g.id === groupId);
          const groupIndex = graph.groups?.findIndex((g) => g.id === groupId) || 0;

          nodes.push({
            id: child.id,
            type: 'groupNode',
            position: { x, y },
            data: {
              label: groupDef?.label || groupId,
              description: groupDef?.description,
              color: groupDef?.color || GROUP_COLORS[groupIndex % GROUP_COLORS.length],
              width: child.width || 200,
              height: child.height || 100,
            },
            style: {
              width: child.width,
              height: child.height,
            },
            zIndex: -1,
          });

          // Recurse with offset
          extractPositions(child, x, y);
        } else {
          // Regular node
          nodePositions.set(child.id, { x, y });
        }
      });
    }
  }

  extractPositions(layoutedGraph);

  // Add code nodes
  graph.nodes.forEach((node) => {
    const pos = nodePositions.get(node.id) || { x: 0, y: 0 };
    nodes.push({
      id: node.id,
      type: 'codeNode',
      position: pos,
      data: {
        label: node.label,
        type: node.type,
        location: node.location,
        description: node.description,
        dimmed: false,
      },
    });
  });

  // Create edges with handle positions based on relative node positions
  const isStressLayout = layoutType === 'stress';
  const isVertical = direction === 'TB' || direction === 'BT';

  const edges: Edge[] = graph.edges.map((edge) => {
    // Get source and target positions to determine best handle positions
    const sourcePos = nodePositions.get(edge.source);
    const targetPos = nodePositions.get(edge.target);

    let sourceHandle: string | undefined;
    let targetHandle: string | undefined;

    if (sourcePos && targetPos) {
      const dx = targetPos.x - sourcePos.x;
      const dy = targetPos.y - sourcePos.y;

      if (isStressLayout) {
        // For stress layouts, connect to nearest sides based on position
        if (Math.abs(dx) > Math.abs(dy)) {
          if (dx > 0) {
            sourceHandle = 'right-source';
            targetHandle = 'left';
          } else {
            sourceHandle = 'left-source';
            targetHandle = 'right';
          }
        } else {
          if (dy > 0) {
            sourceHandle = 'bottom-source';
            targetHandle = 'top';
          } else {
            sourceHandle = 'top-source';
            targetHandle = 'bottom';
          }
        }
      } else if (isVertical) {
        // For vertical layouts, prefer top/bottom but handle sideways too
        if (dy > 30) {
          // Target is below - standard flow
          sourceHandle = 'bottom-source';
          targetHandle = 'top';
        } else if (dy < -30) {
          // Target is above - use side handles to curve around
          sourceHandle = 'left-source';
          targetHandle = 'left';
        } else if (dx > 0) {
          // Same level, target to the right
          sourceHandle = 'right-source';
          targetHandle = 'left';
        } else {
          // Same level, target to the left
          sourceHandle = 'left-source';
          targetHandle = 'right';
        }
      } else {
        // For horizontal layouts, prefer left/right but handle vertical too
        if (dx > 30) {
          // Target is to the right - standard flow
          sourceHandle = 'right-source';
          targetHandle = 'left';
        } else if (dx < -30) {
          // Target is to the left - use top handles to curve around
          sourceHandle = 'top-source';
          targetHandle = 'top';
        } else if (dy > 0) {
          // Same column, target below
          sourceHandle = 'bottom-source';
          targetHandle = 'top';
        } else {
          // Same column, target above
          sourceHandle = 'top-source';
          targetHandle = 'bottom';
        }
      }
    }

    // Style based on importance (primary = thick/bright, tertiary = thin/dim)
    const importance = edge.importance || 'secondary';
    const strokeWidth = importance === 'primary' ? 3 : importance === 'tertiary' ? 1.5 : 2;
    const strokeOpacity = importance === 'primary' ? 1 : importance === 'tertiary' ? 0.5 : 0.8;

    // Color: custom color takes precedence, otherwise based on edge type
    const defaultEdgeColors: Record<string, string> = {
      calls: 'var(--vscode-charts-blue)',
      imports: 'var(--vscode-descriptionForeground)',
      extends: 'var(--vscode-charts-green)',
      implements: 'var(--vscode-charts-purple)',
      uses: 'var(--vscode-descriptionForeground)',
    };
    const strokeColor = edge.color || defaultEdgeColors[edge.type] || 'var(--vscode-descriptionForeground)';

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle,
      targetHandle,
      type: 'smoothstep',
      animated: true, // All edges animated to show flow direction
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: importance === 'primary' ? 16 : importance === 'tertiary' ? 12 : 14,
        height: importance === 'primary' ? 16 : importance === 'tertiary' ? 12 : 14,
      },
      style: {
        strokeWidth,
        stroke: strokeColor,
        opacity: strokeOpacity,
      },
      data: { label: edge.label, edgeType: edge.type, importance },
      zIndex: importance === 'primary' ? 1 : importance === 'tertiary' ? -1 : 0,
    };
  });

  return { nodes, edges };
}

export function GraphCanvas({ graph, onNavigate }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    layoutGraph(graph).then(({ nodes, edges }) => {
      setNodes(nodes);
      setEdges(edges);
    });
  }, [graph, setNodes, setEdges]);

  // Get connected node IDs and edge IDs for highlighting
  // Use graph.edges from props since it's stable and typed correctly
  const { connectedNodeIds, connectedEdgeIds } = useMemo(() => {
    if (!selectedNodeId) {
      return { connectedNodeIds: new Set<string>(), connectedEdgeIds: new Set<string>() };
    }

    const connectedNodes = new Set<string>([selectedNodeId]);
    const connectedEdges = new Set<string>();

    graph.edges.forEach((edge) => {
      if (edge.source === selectedNodeId || edge.target === selectedNodeId) {
        connectedEdges.add(edge.id);
        connectedNodes.add(edge.source);
        connectedNodes.add(edge.target);
      }
    });

    return { connectedNodeIds: connectedNodes, connectedEdgeIds: connectedEdges };
  }, [selectedNodeId, graph.edges]);

  // Update node dimming when selection changes
  useEffect(() => {
    if (!selectedNodeId) {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.type === 'groupNode') return n;
          return {
            ...n,
            data: { ...n.data, dimmed: false },
          };
        })
      );
    } else {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.type === 'groupNode') return n;
          return {
            ...n,
            data: {
              ...n.data,
              dimmed: !connectedNodeIds.has(n.id),
            },
          };
        })
      );
    }
  }, [selectedNodeId, connectedNodeIds, setNodes]);

  // Update edge dimming when selection changes
  useEffect(() => {
    if (!selectedNodeId) {
      setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          style: {
            ...e.style,
            opacity: 1,
          },
        }))
      );
    } else {
      setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          style: {
            ...e.style,
            opacity: connectedEdgeIds.has(e.id) ? 1 : 0.15,
          },
        }))
      );
    }
  }, [selectedNodeId, connectedEdgeIds, setEdges]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      // Ignore clicks on group nodes
      if (node.type === 'groupNode') return;

      if (event.metaKey || event.ctrlKey) {
        // Cmd+Click: Navigate to code
        onNavigate(node.data.location);
      } else {
        // Single click: Toggle selection for highlighting
        setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
      }
    },
    [onNavigate]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
      >
        <Background />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === 'groupNode') {
              return node.data.color || 'rgba(100, 100, 100, 0.3)';
            }
            return node.data.dimmed
              ? 'var(--vscode-editorWidget-background)'
              : 'var(--vscode-button-background)';
          }}
          maskColor="rgba(0, 0, 0, 0.2)"
        />
      </ReactFlow>
      {graph.legend && <Legend legend={graph.legend} />}
    </div>
  );
}
