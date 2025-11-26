import * as vscode from 'vscode';
import { CGraphEditorProvider } from './cgraphEditorProvider';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(CGraphEditorProvider.register(context));

  // Command to open .cgraph file as raw JSON text
  context.subscriptions.push(
    vscode.commands.registerCommand('codetographer.openAsText', async () => {
      const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;

      // Get the URI from the active custom editor tab
      let uri: vscode.Uri | undefined;

      if (activeTab?.input && 'uri' in (activeTab.input as object)) {
        uri = (activeTab.input as { uri: vscode.Uri }).uri;
      }

      if (uri && uri.fsPath.endsWith('.cgraph')) {
        // Open as plain text editor
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, {
          viewColumn: vscode.ViewColumn.Active,
          preview: false,
        });
        // Set to JSON language mode for syntax highlighting
        await vscode.languages.setTextDocumentLanguage(doc, 'json');
      } else {
        vscode.window.showInformationMessage('No .cgraph file is currently active');
      }
    })
  );
}

export function deactivate() {}
