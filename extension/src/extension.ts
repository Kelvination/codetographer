import * as vscode from 'vscode';
import { CGraphEditorProvider } from './cgraphEditorProvider';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(CGraphEditorProvider.register(context));
}

export function deactivate() {}
