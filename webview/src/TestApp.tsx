import { useState, useEffect } from 'react';
import { GraphCanvas } from './components/GraphCanvas';
import type { CGraph } from './types/cgraph';
import './styles.css';

// Standalone test app that loads graph data from a global variable or URL param
export function TestApp() {
  const [graph, setGraph] = useState<CGraph | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for graph data injected via global variable
    if ((window as any).__CGRAPH_DATA__) {
      try {
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

  const handleNavigate = (file: string, line: number) => {
    console.log(`Navigate to: ${file}:${line}`);
  };

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
      <GraphCanvas graph={graph} onNavigate={handleNavigate} />
    </div>
  );
}
