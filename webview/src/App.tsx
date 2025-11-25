import { useVSCodeApi } from './hooks/useVSCodeApi';
import { GraphCanvas } from './components/GraphCanvas';
import './styles.css';

export function App() {
  const { graph, error, navigate } = useVSCodeApi();

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
        <p className="hint">
          Click a node to highlight connections. Cmd+Click to jump to code.
        </p>
      </header>
      <GraphCanvas graph={graph} onNavigate={navigate} />
    </div>
  );
}
