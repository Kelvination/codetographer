import { useVSCodeApi } from './hooks/useVSCodeApi';
import { GraphCanvas } from './components/GraphCanvas';
import './styles.css';

export function App() {
  const {
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
  } = useVSCodeApi();

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
        <div className="header-content">
          <div className="header-text">
            <h1>{graph.metadata.title}</h1>
            {graph.metadata.description && (
              <p className="description">{graph.metadata.description}</p>
            )}
            <p className="hint">
              Drag nodes to reposition. Click to highlight connections. Cmd+Click to jump to code.
            </p>
          </div>
          <div className="header-actions">
            <button
              onClick={revertToSaved}
              className="header-btn"
              title="Revert to last saved state"
            >
              Revert to Saved
            </button>
            <button
              onClick={resetLayout}
              className="header-btn"
              title="Reset to default auto-layout (clears all manual positions)"
            >
              Reset to Default
            </button>
          </div>
        </div>
      </header>
      <GraphCanvas
        graph={graph}
        onNavigate={navigate}
        onNodePositionChange={updateNodePosition}
        onGroupPositionChange={updateGroupPosition}
        onGroupSizeChange={updateGroupSize}
        onUndo={undo}
        onRedo={redo}
      />
    </div>
  );
}
