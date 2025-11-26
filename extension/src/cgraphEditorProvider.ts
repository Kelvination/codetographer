import * as vscode from 'vscode';

export class CGraphEditorProvider implements vscode.CustomTextEditorProvider {
  private static readonly viewType = 'codetographer.cgraphEditor';

  // Track URIs we're currently editing to prevent feedback loops
  private editingUris = new Set<string>();
  // Store the last saved state for each document
  private lastSavedContent = new Map<string, string>();

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new CGraphEditorProvider(context);
    return vscode.window.registerCustomEditorProvider(
      CGraphEditorProvider.viewType,
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      }
    );
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    const uriString = document.uri.toString();
    
    // Store the initial saved state
    this.lastSavedContent.set(uriString, document.getText());

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'media'),
      ],
    };

    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    const updateWebview = () => {
      webviewPanel.webview.postMessage({
        type: 'update',
        content: document.getText(),
      });
    };

    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(
      (e) => {
        const docUri = e.document.uri.toString();
        // Skip if this is our own edit (prevents feedback loop)
        if (docUri === uriString && !this.editingUris.has(docUri)) {
          updateWebview();
        }
      }
    );

    // Track document saves to update the "last saved" state
    const saveDocumentSubscription = vscode.workspace.onDidSaveTextDocument(
      (savedDoc) => {
        if (savedDoc.uri.toString() === uriString) {
          this.lastSavedContent.set(uriString, savedDoc.getText());
          // Notify webview of save
          webviewPanel.webview.postMessage({
            type: 'saved',
            content: savedDoc.getText(),
          });
        }
      }
    );

    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
      saveDocumentSubscription.dispose();
      this.lastSavedContent.delete(uriString);
    });

    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'navigate':
          await this.navigateToLocation(message.location);
          break;
        case 'ready':
          updateWebview();
          break;
        case 'updatePositions':
          await this.applyPositionChanges(document, message.changes);
          break;
        case 'resetLayout':
          await this.clearManualPositions(document);
          // Force update the webview after clearing positions
          updateWebview();
          break;
        case 'revertToSaved':
          await this.revertToSavedState(document);
          updateWebview();
          break;
        case 'undo':
          await vscode.commands.executeCommand('undo');
          break;
        case 'redo':
          await vscode.commands.executeCommand('redo');
          break;
      }
    });

    updateWebview();
  }

  private async applyPositionChanges(
    document: vscode.TextDocument,
    changes: {
      nodePositions?: Array<{ id: string; position: { x: number; y: number } }>;
      groupPositions?: Array<{ id: string; position: { x: number; y: number } }>;
      groupSizes?: Array<{ id: string; size: { width: number; height: number } }>;
    }
  ): Promise<void> {
    const uriString = document.uri.toString();
    this.editingUris.add(uriString);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const content = JSON.parse(document.getText()) as any;

      // Apply node position changes
      if (changes.nodePositions) {
        for (const change of changes.nodePositions) {
          const node = content.nodes?.find(
            (n: { id: string }) => n.id === change.id
          );
          if (node) {
            node.position = change.position;
          }
        }
      }

      // Apply group position changes
      if (changes.groupPositions && content.groups) {
        for (const change of changes.groupPositions) {
          const group = content.groups.find(
            (g: { id: string }) => g.id === change.id
          );
          if (group) {
            group.position = change.position;
          }
        }
      }

      // Apply group size changes
      if (changes.groupSizes && content.groups) {
        for (const change of changes.groupSizes) {
          const group = content.groups.find(
            (g: { id: string }) => g.id === change.id
          );
          if (group) {
            group.size = change.size;
          }
        }
      }

      // Create a workspace edit to replace entire document
      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
      );
      edit.replace(document.uri, fullRange, JSON.stringify(content, null, 2));

      await vscode.workspace.applyEdit(edit);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update positions: ${error}`);
    } finally {
      // Use setTimeout to ensure the change event has fired before we remove from set
      setTimeout(() => this.editingUris.delete(uriString), 100);
    }
  }

  private async clearManualPositions(
    document: vscode.TextDocument
  ): Promise<void> {
    const uriString = document.uri.toString();
    this.editingUris.add(uriString);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const content = JSON.parse(document.getText()) as any;

      // Remove position from all nodes
      if (content.nodes) {
        content.nodes.forEach((node: { position?: unknown }) => {
          delete node.position;
        });
      }

      // Remove position and size from all groups
      if (content.groups) {
        content.groups.forEach(
          (group: { position?: unknown; size?: unknown }) => {
            delete group.position;
            delete group.size;
          }
        );
      }

      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
      );
      edit.replace(document.uri, fullRange, JSON.stringify(content, null, 2));

      await vscode.workspace.applyEdit(edit);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to reset layout: ${error}`);
    } finally {
      setTimeout(() => this.editingUris.delete(uriString), 100);
    }
  }

  private async revertToSavedState(
    document: vscode.TextDocument
  ): Promise<void> {
    const uriString = document.uri.toString();
    const savedContent = this.lastSavedContent.get(uriString);
    
    if (!savedContent) {
      vscode.window.showInformationMessage('No saved state to revert to');
      return;
    }

    // Check if there are any changes to revert
    if (document.getText() === savedContent) {
      vscode.window.showInformationMessage('No changes to revert');
      return;
    }

    this.editingUris.add(uriString);
    try {
      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
      );
      edit.replace(document.uri, fullRange, savedContent);

      await vscode.workspace.applyEdit(edit);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to revert: ${error}`);
    } finally {
      setTimeout(() => this.editingUris.delete(uriString), 100);
    }
  }

  private async navigateToLocation(location: {
    file: string;
    startLine: number;
    endLine?: number;
  }): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!workspaceRoot) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    try {
      const fileUri = vscode.Uri.joinPath(workspaceRoot, location.file);
      const doc = await vscode.workspace.openTextDocument(fileUri);

      // Open in an existing editor column if available, otherwise use column one
      // This prevents creating new splits on every navigation
      const existingEditor = vscode.window.visibleTextEditors.find(
        (e) => e.document.languageId !== 'json' // Don't reuse cgraph editors
      );
      const targetColumn = existingEditor?.viewColumn || vscode.ViewColumn.One;

      const editor = await vscode.window.showTextDocument(doc, {
        viewColumn: targetColumn,
        preserveFocus: false,
      });

      const startLine = Math.max(0, location.startLine - 1);
      const endLine = location.endLine
        ? Math.max(0, location.endLine - 1)
        : startLine;

      const startPosition = new vscode.Position(startLine, 0);
      const endPosition = new vscode.Position(
        endLine,
        doc.lineAt(endLine).text.length
      );

      editor.selection = new vscode.Selection(startPosition, startPosition);
      editor.revealRange(
        new vscode.Range(startPosition, endPosition),
        vscode.TextEditorRevealType.InCenter
      );

      // Highlight the range
      const decoration = vscode.window.createTextEditorDecorationType({
        backgroundColor: new vscode.ThemeColor(
          'editor.findMatchHighlightBackground'
        ),
        isWholeLine: true,
      });
      editor.setDecorations(decoration, [
        new vscode.Range(startPosition, endPosition),
      ]);

      // Remove decoration after 2 seconds
      setTimeout(() => decoration.dispose(), 2000);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Could not open file: ${location.file}`
      );
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'main.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'index.css')
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:;">
  <link href="${styleUri}" rel="stylesheet">
  <title>Codetographer</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
