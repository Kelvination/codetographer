import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  PanOnScrollMode,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type EdgeMouseHandler,
  type NodeChange,
  type NodeTypes,
  MarkerType,
} from '@xyflow/react';
import ELK, { type ElkNode, type ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';
import { CodeNode } from './CodeNode';
import { GroupNode } from './GroupNode';
import { Legend } from './Legend';
import type { CGraph, CGraphLocation, CGraphGroup } from '../types/cgraph';
import '@xyflow/react/dist/style.css';

const elk = new ELK();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: NodeTypes = {
  codeNode: CodeNode as any,
  groupNode: GroupNode as any,
};

interface Props {
  graph: CGraph;
  onNavigate: (location: CGraphLocation) => void;
  onNodePositionChange: (nodeId: string, position: { x: number; y: number }) => void;
  onGroupPositionChange: (groupId: string, position: { x: number; y: number }) => void;
  onGroupSizeChange: (groupId: string, size: { width: number; height: number }) => void;
  onUndo: () => void;
  onRedo: () => void;
}

// Default group colors - matching One Dark theme
const GROUP_COLORS = [
  'rgba(97, 175, 239, 0.15)',   // blue
  'rgba(152, 195, 121, 0.15)',  // green
  'rgba(198, 120, 221, 0.15)',  // purple
  'rgba(224, 108, 117, 0.15)',  // red
  'rgba(229, 192, 123, 0.15)',  // yellow
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

// Get layout options - optimized for clean, professional graphs
function getLayoutOptions(direction: string): Record<string, string> {
  return {
    'elk.algorithm': 'layered',
    'elk.direction': direction,
    // Spacing optimized for clarity without excessive whitespace
    'elk.layered.spacing.nodeNodeBetweenLayers': '80',
    'elk.spacing.nodeNode': '35',
    'elk.spacing.edgeNode': '25',
    'elk.spacing.edgeEdge': '12',
    // Advanced placement strategies for cleaner layouts
    'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
    // Orthogonal edge routing for clean right-angle connections
    'elk.edgeRouting': 'ORTHOGONAL',
    // Edge handling
    'elk.layered.feedbackEdges': 'true',
    'elk.layered.mergeEdges': 'false',
    'elk.layered.thoroughness': '7',
  };
}

async function layoutGraph(
  graph: CGraph
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  const direction = graph.layout?.direction || 'TB';
  const hasGroups = graph.groups && graph.groups.length > 0;

  // Build ELK graph structure
  let elkGraph: ElkNode;
  const baseLayoutOptions = getLayoutOptions(direction);

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
            ...getLayoutOptions(direction),
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

          // Use saved position/size if available, otherwise use ELK calculated
          // Round to integers to avoid floating point precision issues
          const finalX = Math.round(groupDef?.position?.x ?? x);
          const finalY = Math.round(groupDef?.position?.y ?? y);
          const finalWidth = Math.round(groupDef?.size?.width ?? child.width ?? 200);
          const finalHeight = Math.round(groupDef?.size?.height ?? child.height ?? 100);

          nodes.push({
            id: child.id,
            type: 'groupNode',
            position: { x: finalX, y: finalY },
            data: {
              label: groupDef?.label || groupId,
              description: groupDef?.description,
              color: groupDef?.color || GROUP_COLORS[groupIndex % GROUP_COLORS.length],
              width: finalWidth,
              height: finalHeight,
              groupId: groupId, // Pass original group ID for updates
            },
            style: {
              width: finalWidth,
              height: finalHeight,
            },
            zIndex: -1,
          });

          // Recurse with offset (use ELK positions for children calculation)
          extractPositions(child, x, y);
        } else {
          // Regular node
          nodePositions.set(child.id, { x, y });
        }
      });
    }
  }

  extractPositions(layoutedGraph);

  // Add code nodes - use saved position if available, otherwise use ELK calculated
  graph.nodes.forEach((node) => {
    const elkPos = nodePositions.get(node.id) || { x: 0, y: 0 };
    const savedPos = node.position;
    // Round to integers to avoid floating point precision issues
    const finalPos = savedPos
      ? { x: Math.round(savedPos.x), y: Math.round(savedPos.y) }
      : { x: Math.round(elkPos.x), y: Math.round(elkPos.y) };
    nodes.push({
      id: node.id,
      type: 'codeNode',
      position: finalPos,
      data: {
        label: node.label,
        type: node.type,
        location: node.location,
        description: node.description,
        dimmed: false,
      },
    });
  });

  // Create edges with smart handle selection based on node positions
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

      if (isVertical) {
        // For vertical layouts (TB/BT), prefer top/bottom connections
        if (dy > 30) {
          // Target is below - standard downward flow
          sourceHandle = 'bottom-source';
          targetHandle = 'top';
        } else if (dy < -30) {
          // Target is above - upward connection (feedback edge)
          sourceHandle = 'top-source';
          targetHandle = 'bottom';
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
        // For horizontal layouts (LR/RL), prefer left/right connections
        if (dx > 30) {
          // Target is to the right - standard rightward flow
          sourceHandle = 'right-source';
          targetHandle = 'left';
        } else if (dx < -30) {
          // Target is to the left - leftward connection (feedback edge)
          sourceHandle = 'left-source';
          targetHandle = 'right';
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

    // Style based on importance (primary = prominent, tertiary = subtle)
    const importance = edge.importance || 'secondary';
    const strokeWidth = importance === 'primary' ? 2.5 : importance === 'tertiary' ? 1.5 : 2;

    // Color: custom color takes precedence, otherwise based on edge type
    const defaultEdgeColors: Record<string, string> = {
      calls: '#61afef',
      imports: '#abb2bf',
      extends: '#98c379',
      implements: '#c678dd',
      uses: '#abb2bf',
    };
    const strokeColor = edge.color || defaultEdgeColors[edge.type] || '#abb2bf';

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle,
      targetHandle,
      type: 'smoothstep',
      animated: false,
      pathOptions: {
        borderRadius: 20,
        offset: 15,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 10,
        height: 10,
        color: strokeColor,
      },
      style: {
        strokeWidth,
        stroke: strokeColor,
      },
      data: { label: edge.label, edgeType: edge.type, importance },
    };
  });

  return { nodes, edges };
}

// Handles cmd/ctrl+scroll to zoom
function KeyboardZoomHandler() {
  const { zoomIn, zoomOut } = useReactFlow();

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      // On Mac trackpads, pinch-to-zoom is sent as wheel events with ctrlKey=true
      // We want to let ReactFlow's native zoomOnPinch handle those
      // Real cmd+scroll will have metaKey=true on Mac
      // Real ctrl+scroll will have ctrlKey=true on Windows

      // Skip if this looks like a pinch gesture (ctrlKey without metaKey on Mac)
      // Pinch gestures typically have ctrlKey set but not metaKey
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

      if (isMac) {
        // On Mac: only respond to Cmd+scroll (metaKey), not Ctrl which is pinch
        if (!event.metaKey) return;
      } else {
        // On Windows/Linux: respond to Ctrl+scroll
        if (!event.ctrlKey) return;
      }

      event.preventDefault();

      // Zoom in or out based on scroll direction
      if (event.deltaY < 0) {
        zoomIn({ duration: 100 });
      } else {
        zoomOut({ duration: 100 });
      }
    };

    // Use passive: false to allow preventDefault
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, [zoomIn, zoomOut]);

  return null;
}

// Custom MiniMap that supports click-to-pan
function ClickableMiniMap({ 
  nodeColor, 
  nodes 
}: { 
  nodeColor: (node: Node) => string;
  nodes: Node[];
}) {
  const { setCenter, getZoom } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseDown = (event: MouseEvent) => {
      // Find the actual minimap SVG element
      const minimapSvg = container.querySelector('.react-flow__minimap');
      if (!minimapSvg) return;

      const rect = minimapSvg.getBoundingClientRect();
      
      // Check if click is inside the minimap
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      ) {
        return;
      }
      
      // Calculate click position relative to minimap (0-1)
      const relativeX = (event.clientX - rect.left) / rect.width;
      const relativeY = (event.clientY - rect.top) / rect.height;

      // Get the bounds of all nodes to calculate the graph extent
      if (nodes.length === 0) return;

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      nodes.forEach(node => {
        const width = (node.style?.width as number) || (node.width as number) || 200;
        const height = (node.style?.height as number) || (node.height as number) || 100;
        minX = Math.min(minX, node.position.x);
        minY = Math.min(minY, node.position.y);
        maxX = Math.max(maxX, node.position.x + width);
        maxY = Math.max(maxY, node.position.y + height);
      });

      // Add some padding to match what the minimap shows
      const padding = 100;
      minX -= padding;
      minY -= padding;
      maxX += padding;
      maxY += padding;

      // Calculate the target position in flow coordinates
      const graphWidth = maxX - minX;
      const graphHeight = maxY - minY;
      const targetX = minX + relativeX * graphWidth;
      const targetY = minY + relativeY * graphHeight;

      // Pan to that location instantly
      setCenter(targetX, targetY, { zoom: getZoom(), duration: 0 });
    };

    // Use capture phase to handle event before MiniMap
    container.addEventListener('mousedown', handleMouseDown, true);
    
    return () => {
      container.removeEventListener('mousedown', handleMouseDown, true);
    };
  }, [nodes, setCenter, getZoom]);

  return (
    <div ref={containerRef}>
      <MiniMap
        nodeColor={nodeColor}
        maskColor="rgba(0, 0, 0, 0.2)"
        pannable
        zoomable
      />
    </div>
  );
}

export function GraphCanvas({
  graph,
  onNavigate,
  onNodePositionChange,
  onGroupPositionChange,
  onGroupSizeChange,
  onUndo,
  onRedo,
}: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedLegendColor, setSelectedLegendColor] = useState<string | null>(null);
  // Track when initial layout is complete to avoid sending updates during setup
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  // Lock state - locked by default (no dragging)
  const [isLocked, setIsLocked] = useState(true);

  useEffect(() => {
    setIsLayoutReady(false);
    layoutGraph(graph).then(({ nodes, edges }) => {
      setNodes(nodes);
      setEdges(edges);
      // Wait for React Flow to finish measuring before enabling updates
      setTimeout(() => setIsLayoutReady(true), 500);
    });
  }, [graph, setNodes, setEdges]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Z (Mac) or Ctrl+Z (Windows) for undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        onUndo();
      }
      // Cmd+Shift+Z (Mac) or Ctrl+Shift+Z (Windows) for redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        onRedo();
      }
      // Also support Cmd+Y / Ctrl+Y for redo (Windows convention)
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        onRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onUndo, onRedo]);

  // Get connected node IDs and edge IDs for highlighting
  // Use graph.edges from props since it's stable and typed correctly
  const { connectedNodeIds, connectedEdgeIds } = useMemo(() => {
    // No selection - nothing highlighted
    if (!selectedNodeId && !selectedEdgeId && !selectedLegendColor) {
      return { 
        connectedNodeIds: new Set<string>(), 
        connectedEdgeIds: new Set<string>(),
      };
    }

    const connectedNodes = new Set<string>();
    const connectedEdges = new Set<string>();

    if (selectedNodeId) {
      // Node selected - highlight node and all connected nodes/edges
      connectedNodes.add(selectedNodeId);
      graph.edges.forEach((edge) => {
        if (edge.source === selectedNodeId || edge.target === selectedNodeId) {
          connectedEdges.add(edge.id);
          connectedNodes.add(edge.source);
          connectedNodes.add(edge.target);
        }
      });
    } else if (selectedEdgeId) {
      // Edge selected - highlight just the two connected nodes and this edge
      connectedEdges.add(selectedEdgeId);
      const selectedEdge = graph.edges.find((e) => e.id === selectedEdgeId);
      if (selectedEdge) {
        connectedNodes.add(selectedEdge.source);
        connectedNodes.add(selectedEdge.target);
      }
    } else if (selectedLegendColor) {
      // Legend color selected - highlight all edges of that color and their connected nodes
      graph.edges.forEach((edge) => {
        // Match by explicit color or by default edge type color
        const defaultEdgeColors: Record<string, string> = {
          calls: '#61afef',
          imports: '#abb2bf',
          extends: '#98c379',
          implements: '#c678dd',
          uses: '#abb2bf',
        };
        const edgeColor = edge.color || defaultEdgeColors[edge.type] || '#abb2bf';
        
        if (edgeColor === selectedLegendColor) {
          connectedEdges.add(edge.id);
          connectedNodes.add(edge.source);
          connectedNodes.add(edge.target);
        }
      });
    }

    return { 
      connectedNodeIds: connectedNodes, 
      connectedEdgeIds: connectedEdges,
    };
  }, [selectedNodeId, selectedEdgeId, selectedLegendColor, graph.edges]);

  // Update node and group dimming when selection changes
  // Groups are always dimmed when there's a selection (they're just containers)
  useEffect(() => {
    const hasSelection = selectedNodeId || selectedEdgeId || selectedLegendColor;
    if (!hasSelection) {
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: { ...n.data, dimmed: false },
        }))
      );
    } else {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.type === 'groupNode') {
            // Always dim groups when there's a selection
            return {
              ...n,
              data: { ...n.data, dimmed: true },
            };
          }
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
  }, [selectedNodeId, selectedEdgeId, selectedLegendColor, connectedNodeIds, setNodes]);

  // Update edge dimming when selection changes
  useEffect(() => {
    const hasSelection = selectedNodeId || selectedEdgeId || selectedLegendColor;
    if (!hasSelection) {
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
  }, [selectedNodeId, selectedEdgeId, selectedLegendColor, connectedEdgeIds, setEdges]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      // Ignore clicks on group nodes
      if (node.type === 'groupNode') return;

      if (event.metaKey || event.ctrlKey) {
        // Cmd+Click: Navigate to code
        const data = node.data as { location: CGraphLocation };
        onNavigate(data.location);
      } else {
        // Single click: Toggle selection for highlighting
        setSelectedEdgeId(null); // Clear edge selection
        setSelectedLegendColor(null); // Clear legend selection
        setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
      }
    },
    [onNavigate]
  );

  const handleEdgeClick: EdgeMouseHandler = useCallback(
    (_event, edge) => {
      // Single click: Toggle selection for highlighting connected nodes
      setSelectedNodeId(null); // Clear node selection
      setSelectedLegendColor(null); // Clear legend selection
      setSelectedEdgeId((prev) => (prev === edge.id ? null : edge.id));
    },
    []
  );

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setSelectedLegendColor(null);
  }, []);

  const handleLegendColorSelect = useCallback((color: string | null) => {
    setSelectedNodeId(null); // Clear node selection
    setSelectedEdgeId(null); // Clear edge selection
    setSelectedLegendColor(color);
  }, []);

  // Round position to avoid floating point precision issues
  const roundPosition = (pos: { x: number; y: number }) => ({
    x: Math.round(pos.x),
    y: Math.round(pos.y),
  });

  // Handle node drag end - save the new position
  const handleNodeDragStop: NodeMouseHandler = useCallback(
    (_event, node) => {
      // Only save positions after initial layout is complete
      if (!isLayoutReady) return;

      const roundedPos = roundPosition(node.position);

      if (node.type === 'groupNode') {
        // Extract original group ID from node ID (remove 'group-' prefix)
        const data = node.data as { groupId?: string };
        const groupId = data.groupId || node.id.replace('group-', '');
        onGroupPositionChange(groupId, roundedPos);
      } else {
        onNodePositionChange(node.id, roundedPos);
      }
    },
    [onNodePositionChange, onGroupPositionChange, isLayoutReady]
  );

  // Custom handler that also detects dimension changes (from resize)
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Call the default handler first
      onNodesChange(changes);

      // Only process resize changes after initial layout is complete
      if (!isLayoutReady) return;

      // Check for dimension changes (from resize) - only when resizing property is true
      changes.forEach((change) => {
        if (
          change.type === 'dimensions' &&
          'dimensions' in change &&
          change.dimensions &&
          'resizing' in change &&
          change.resizing === false // resizing just finished
        ) {
          // Get the updated node with the current position (after resize)
          // We need to use the state updater to access the latest state
          setNodes((currentNodes) => {
            const node = currentNodes.find((n) => n.id === change.id);
            if (node?.type === 'groupNode') {
              const data = node.data as { groupId?: string };
              const groupId = data.groupId || change.id.replace('group-', '');
              
              // When resizing from top/left edges, the position changes too
              // Send both position and size updates
              onGroupPositionChange(groupId, {
                x: Math.round(node.position.x),
                y: Math.round(node.position.y),
              });
              onGroupSizeChange(groupId, {
                width: Math.round(change.dimensions!.width),
                height: Math.round(change.dimensions!.height),
              });
            }
            return currentNodes; // Return unchanged state
          });
        }
      });
    },
    [onNodesChange, onGroupPositionChange, onGroupSizeChange, isLayoutReady, setNodes]
  );

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <button
        onClick={() => setIsLocked(!isLocked)}
        className={`lock-toggle-btn ${isLocked ? 'locked' : 'unlocked'}`}
        title={isLocked ? 'Unlock to enable dragging' : 'Lock to prevent dragging'}
      >
        {isLocked ? '🔒 Locked' : '🔓 Unlocked'}
      </button>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onNodeDragStop={handleNodeDragStop}
        onPaneClick={handlePaneClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        nodesDraggable={!isLocked}
        nodesConnectable={false}
        elementsSelectable={true}
        panOnScroll={true}
        panOnScrollMode={PanOnScrollMode.Free}
        zoomOnScroll={false}
        zoomOnPinch={true}
      >
        <KeyboardZoomHandler />
        <Background />
        <Controls />
        <ClickableMiniMap
          nodeColor={(node) => {
            const data = node.data as { color?: string; dimmed?: boolean };
            if (node.type === 'groupNode') {
              return data.color || 'rgba(100, 100, 100, 0.3)';
            }
            return data.dimmed
              ? 'var(--vscode-editorWidget-background)'
              : 'var(--vscode-button-background)';
          }}
          nodes={nodes}
        />
      </ReactFlow>
      {graph.legend && (
        <Legend
          legend={graph.legend}
          selectedColor={selectedLegendColor}
          onSelectColor={handleLegendColorSelect}
        />
      )}
    </div>
  );
}
