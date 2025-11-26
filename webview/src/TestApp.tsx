import { useState, useEffect, useCallback } from 'react';
import { GraphCanvas } from './components/GraphCanvas';
import type { CGraph, CGraphLocation } from './types/cgraph';
import './styles.css';

// Standalone test app that loads graph data from a global variable or URL param
export function TestApp() {
  const [graph, setGraph] = useState<CGraph | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for graph data injected via global variable
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).__CGRAPH_DATA__) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setGraph((window as any).__CGRAPH_DATA__);
      } catch (e) {
        setError(`Failed to parse graph data: ${e}`);
      }
      return;
    }

    // Check URL param for cgraph file path
    const params = new URLSearchParams(window.location.search);
    const filePath = params.get('file');

    if (filePath) {
      fetch(filePath)
        .then(res => res.json())
        .then(data => setGraph(data))
        .catch(e => setError(`Failed to load ${filePath}: ${e}`));
    } else {
      setError('No graph data provided. Use ?file=path/to/file.cgraph or inject __CGRAPH_DATA__');
    }
  }, []);

  const handleNavigate = useCallback((location: CGraphLocation) => {
    console.log(`Navigate to: ${location.file}:${location.startLine}`);
  }, []);

  // No-op handlers for test app
  const handleNodePositionChange = useCallback(
    (nodeId: string, position: { x: number; y: number }) => {
      console.log(`Node ${nodeId} moved to`, position);
    },
    []
  );

  const handleGroupPositionChange = useCallback(
    (groupId: string, position: { x: number; y: number }) => {
      console.log(`Group ${groupId} moved to`, position);
    },
    []
  );

  const handleGroupSizeChange = useCallback(
    (groupId: string, size: { width: number; height: number }) => {
      console.log(`Group ${groupId} resized to`, size);
    },
    []
  );

  const handleUndo = useCallback(() => {
    console.log('Undo requested');
  }, []);

  const handleRedo = useCallback(() => {
    console.log('Redo requested');
  }, []);

  if (error) {
    return (
      <div className="error-container">
        <h2>Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!graph) {
    return (
      <div className="loading-container">
        <p>Loading graph...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1>{graph.metadata.title}</h1>
        {graph.metadata.description && (
          <p className="description">{graph.metadata.description}</p>
        )}
      </header>
      <GraphCanvas
        graph={graph}
        onNavigate={handleNavigate}
        onNodePositionChange={handleNodePositionChange}
        onGroupPositionChange={handleGroupPositionChange}
        onGroupSizeChange={handleGroupSizeChange}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />
    </div>
  );
}
