import { useEffect, useState, useCallback } from 'react';
import type { CGraph, CGraphLocation } from '../types/cgraph';

interface VSCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VSCodeApi;

const vscode = acquireVsCodeApi();

export function useVSCodeApi() {
  const [graph, setGraph] = useState<CGraph | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'update') {
        try {
          const parsed = JSON.parse(message.content) as CGraph;
          setGraph(parsed);
          setError(null);
        } catch (e) {
          setError(`Failed to parse .cgraph file: ${e}`);
          setGraph(null);
        }
      }
    };

    window.addEventListener('message', handler);

    // Signal that we're ready
    vscode.postMessage({ type: 'ready' });

    return () => window.removeEventListener('message', handler);
  }, []);

  const navigate = useCallback((location: CGraphLocation) => {
    vscode.postMessage({ type: 'navigate', location });
  }, []);

  return { graph, error, navigate };
}
