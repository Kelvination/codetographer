import { useEffect, useState, useCallback, useRef } from 'react';
import type { CGraph, CGraphLocation } from '../types/cgraph';

interface VSCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VSCodeApi;

const vscode = acquireVsCodeApi();

// Debounce helper for batching rapid position changes
function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
  debounced.cancel = () => {
    if (timeoutId) clearTimeout(timeoutId);
  };
  return debounced as T & { cancel: () => void };
}

interface PositionChanges {
  nodePositions?: Array<{ id: string; position: { x: number; y: number } }>;
  groupPositions?: Array<{ id: string; position: { x: number; y: number } }>;
  groupSizes?: Array<{ id: string; size: { width: number; height: number } }>;
}

// Check if a graph has any custom positions/sizes set
function hasCustomPositions(graph: CGraph | null): boolean {
  if (!graph) return false;
  const hasNodePositions = graph.nodes.some((n) => n.position);
  const hasGroupPositions = graph.groups?.some((g) => g.position || g.size);
  return hasNodePositions || !!hasGroupPositions;
}

// Check if two graphs have the same positions
function graphPositionsEqual(a: CGraph | null, b: CGraph | null): boolean {
  if (!a || !b) return a === b;
  
  // Compare node positions
  for (const nodeA of a.nodes) {
    const nodeB = b.nodes.find((n) => n.id === nodeA.id);
    if (!nodeB) return false;
    if (JSON.stringify(nodeA.position) !== JSON.stringify(nodeB.position)) {
      return false;
    }
  }
  
  // Compare group positions/sizes
  if (a.groups && b.groups) {
    for (const groupA of a.groups) {
      const groupB = b.groups.find((g) => g.id === groupA.id);
      if (!groupB) return false;
      if (JSON.stringify(groupA.position) !== JSON.stringify(groupB.position)) {
        return false;
      }
      if (JSON.stringify(groupA.size) !== JSON.stringify(groupB.size)) {
        return false;
      }
    }
  }
  
  return true;
}

export function useVSCodeApi() {
  const [graph, setGraph] = useState<CGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Track the last saved state for "revert to saved"
  const [lastSavedGraph, setLastSavedGraph] = useState<CGraph | null>(null);

  // Accumulate changes for batching
  const pendingChanges = useRef<PositionChanges>({});

  // Debounced function to send accumulated changes
  const sendChanges = useRef(
    debounce(() => {
      if (
        pendingChanges.current.nodePositions?.length ||
        pendingChanges.current.groupPositions?.length ||
        pendingChanges.current.groupSizes?.length
      ) {
        vscode.postMessage({
          type: 'updatePositions',
          changes: pendingChanges.current,
        });
        pendingChanges.current = {};
      }
    }, 300) // 300ms debounce to batch rapid drags
  ).current;

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'update') {
        try {
          const parsed = JSON.parse(message.content) as CGraph;
          setGraph(parsed);
          setError(null);
          // If no saved state yet, use the initial state as the saved state
          setLastSavedGraph((prev) => prev ?? parsed);
        } catch (e) {
          setError(`Failed to parse .cgraph file: ${e}`);
          setGraph(null);
        }
      } else if (message.type === 'saved') {
        // Document was saved - store the current state as "last saved"
        try {
          const parsed = JSON.parse(message.content) as CGraph;
          setLastSavedGraph(parsed);
        } catch {
          // Ignore parse errors for saved state
        }
      }
    };

    window.addEventListener('message', handler);

    // Signal that we're ready
    vscode.postMessage({ type: 'ready' });

    return () => {
      window.removeEventListener('message', handler);
      sendChanges.cancel();
    };
  }, [sendChanges]);

  const navigate = useCallback((location: CGraphLocation) => {
    vscode.postMessage({ type: 'navigate', location });
  }, []);

  // Update node position
  const updateNodePosition = useCallback(
    (nodeId: string, position: { x: number; y: number }) => {
      if (!pendingChanges.current.nodePositions) {
        pendingChanges.current.nodePositions = [];
      }
      // Replace existing entry for this node or add new
      const existing = pendingChanges.current.nodePositions.findIndex(
        (p) => p.id === nodeId
      );
      if (existing >= 0) {
        pendingChanges.current.nodePositions[existing].position = position;
      } else {
        pendingChanges.current.nodePositions.push({ id: nodeId, position });
      }
      sendChanges();
    },
    [sendChanges]
  );

  // Update group position
  const updateGroupPosition = useCallback(
    (groupId: string, position: { x: number; y: number }) => {
      if (!pendingChanges.current.groupPositions) {
        pendingChanges.current.groupPositions = [];
      }
      const existing = pendingChanges.current.groupPositions.findIndex(
        (p) => p.id === groupId
      );
      if (existing >= 0) {
        pendingChanges.current.groupPositions[existing].position = position;
      } else {
        pendingChanges.current.groupPositions.push({ id: groupId, position });
      }
      sendChanges();
    },
    [sendChanges]
  );

  // Update group size
  const updateGroupSize = useCallback(
    (groupId: string, size: { width: number; height: number }) => {
      if (!pendingChanges.current.groupSizes) {
        pendingChanges.current.groupSizes = [];
      }
      const existing = pendingChanges.current.groupSizes.findIndex(
        (p) => p.id === groupId
      );
      if (existing >= 0) {
        pendingChanges.current.groupSizes[existing].size = size;
      } else {
        pendingChanges.current.groupSizes.push({ id: groupId, size });
      }
      sendChanges();
    },
    [sendChanges]
  );

  // Reset layout (clear all manual positions)
  const resetLayout = useCallback(() => {
    vscode.postMessage({ type: 'resetLayout' });
  }, []);

  // Revert to last saved state
  const revertToSaved = useCallback(() => {
    vscode.postMessage({ type: 'revertToSaved' });
  }, []);

  // Undo last change
  const undo = useCallback(() => {
    vscode.postMessage({ type: 'undo' });
  }, []);

  // Redo last undone change
  const redo = useCallback(() => {
    vscode.postMessage({ type: 'redo' });
  }, []);

  // Computed state for button visibility
  const hasCustomLayout = hasCustomPositions(graph);
  const hasUnsavedChanges = !graphPositionsEqual(graph, lastSavedGraph);

  return {
    graph,
    error,
    navigate,
    updateNodePosition,
    updateGroupPosition,
    updateGroupSize,
    resetLayout,
    revertToSaved,
    undo,
    redo,
    hasCustomLayout,
    hasUnsavedChanges,
  };
}
