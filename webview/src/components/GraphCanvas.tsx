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

async function layoutGraph(
  graph: CGraph
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  const direction = graph.layout?.direction || 'TB';
  const hasGroups = graph.groups && graph.groups.length > 0;

  // Build ELK graph structure
  let elkGraph: ElkNode;

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
            'elk.algorithm': 'layered',
            'elk.direction': direction,
            'elk.layered.spacing.nodeNodeBetweenLayers': '100',
            'elk.spacing.nodeNode': '60',
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
        'elk.algorithm': 'layered',
        'elk.direction': direction,
        'elk.spacing.nodeNode': '50',
        'elk.layered.spacing.nodeNodeBetweenLayers': '100',
        'elk.spacing.componentComponent': '80',
        'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
        'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      },
      children: elkChildren,
      edges: graph.edges.map((edge) => ({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
      })) as ElkExtendedEdge[],
    };
  } else {
    // Simple flat layout - proper vertical tree with good spacing
    elkGraph = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': direction,
        // Generous vertical spacing between layers for expanded nodes
        'elk.layered.spacing.nodeNodeBetweenLayers': '120',
        // Horizontal spacing between siblings - increased for clarity
        'elk.spacing.nodeNode': '80',
        // Edge spacing to prevent overlaps
        'elk.spacing.edgeNode': '40',
        'elk.spacing.edgeEdge': '20',
        // Better node placement for tree-like appearance
        'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
        'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
        // Center nodes within their layer
        'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
        // Handle cycles/back-edges better - route them around nodes
        'elk.layered.feedbackEdges': 'true',
        'elk.layered.wrapping.strategy': 'OFF',
        // Prefer longer edges over crossing
        'elk.layered.thoroughness': '10',
        // Merge edges going to same target for cleaner look
        'elk.layered.mergeEdges': 'false',
        // Consider node labels in layout
        'elk.nodeLabels.placement': 'INSIDE V_CENTER H_CENTER',
      },
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

  // Create edges with proper pathfinding based on layout direction
  const isVertical = direction === 'TB' || direction === 'BT';
  const edges: Edge[] = graph.edges.map((edge) => {
    // Get source and target positions to determine best handle positions
    const sourcePos = nodePositions.get(edge.source);
    const targetPos = nodePositions.get(edge.target);

    let sourceHandle: string | undefined;
    let targetHandle: string | undefined;
    let isBackEdge = false;

    if (sourcePos && targetPos) {
      if (isVertical) {
        // Detect back-edge: target is above source in TB layout
        isBackEdge = targetPos.y < sourcePos.y - 30;

        if (isBackEdge) {
          // Back-edges go out the left side and curve around
          sourceHandle = 'left';
          targetHandle = 'left';
        } else if (targetPos.y > sourcePos.y + 50) {
          // Normal forward edge: bottom to top
          sourceHandle = 'bottom';
          targetHandle = 'top';
        } else if (targetPos.x > sourcePos.x) {
          // Same layer, target to the right
          sourceHandle = 'right';
          targetHandle = 'left';
        } else {
          // Same layer, target to the left
          sourceHandle = 'left';
          targetHandle = 'right';
        }
      } else {
        // Horizontal layout
        isBackEdge = targetPos.x < sourcePos.x - 30;

        if (isBackEdge) {
          sourceHandle = 'top';
          targetHandle = 'top';
        } else if (targetPos.x > sourcePos.x + 50) {
          sourceHandle = 'right';
          targetHandle = 'left';
        } else if (targetPos.y > sourcePos.y) {
          sourceHandle = 'bottom';
          targetHandle = 'top';
        } else {
          sourceHandle = 'top';
          targetHandle = 'bottom';
        }
      }
    }

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle,
      targetHandle,
      type: 'smoothstep',
      animated: edge.type === 'calls' && !isBackEdge,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 14,
        height: 14,
      },
      style: {
        strokeWidth: isBackEdge ? 1.5 : 2,
        stroke: isBackEdge
          ? 'rgba(139, 139, 139, 0.5)'
          : 'var(--vscode-descriptionForeground)',
        strokeDasharray: isBackEdge ? '6 4' : undefined,
      },
      data: { label: edge.label, edgeType: edge.type, isBackEdge },
      zIndex: isBackEdge ? -1 : 0, // Back-edges render behind
    };
  });

  return { nodes, edges };
}

export function GraphCanvas({ graph, onNavigate }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    layoutGraph(graph).then(({ nodes, edges }) => {
      setNodes(nodes);
      setEdges(edges);
    });
  }, [graph, setNodes, setEdges]);

  // Get connected node IDs for highlighting
  const connectedNodeIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();

    const connected = new Set<string>([selectedNodeId]);
    edges.forEach((edge) => {
      if (edge.source === selectedNodeId) {
        connected.add(edge.target);
      }
      if (edge.target === selectedNodeId) {
        connected.add(edge.source);
      }
    });
    return connected;
  }, [selectedNodeId, edges]);

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
    <div style={{ width: '100%', height: '100vh' }}>
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
    </div>
  );
}
