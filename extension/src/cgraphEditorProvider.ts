import * as vscode from 'vscode';

export class CGraphEditorProvider implements vscode.CustomTextEditorProvider {
  private static readonly viewType = 'codegrapher.cgraphEditor';

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
        if (e.document.uri.toString() === document.uri.toString()) {
          updateWebview();
        }
      }
    );

    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
    });

    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'navigate':
          await this.navigateToLocation(message.location);
          break;
        case 'ready':
          updateWebview();
          break;
      }
    });

    updateWebview();
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
  <title>CodeGrapher</title>
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
