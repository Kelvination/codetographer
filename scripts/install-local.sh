#!/bin/bash
# Quick script to build, package, and install the extension locally

set -e

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

echo "📦 Building extension..."
npm run build

echo "📦 Packaging extension..."
cd extension
vsce package --no-dependencies --allow-missing-repository --skip-license

# Find the .vsix file
VSIX_FILE=$(ls -t *.vsix 2>/dev/null | head -1)

if [ -z "$VSIX_FILE" ]; then
  echo "❌ No .vsix file found"
  exit 1
fi

echo "📥 Installing $VSIX_FILE..."
code --install-extension "$VSIX_FILE" --force

# Clean up the vsix file
rm -f "$VSIX_FILE"

echo "🔄 Reloading VS Code window..."
osascript -e 'tell application "Visual Studio Code" to activate' \
          -e 'delay 0.2' \
          -e 'tell application "System Events" to keystroke "p" using {command down, shift down}' \
          -e 'delay 0.3' \
          -e 'tell application "System Events" to keystroke "Reload Window"' \
          -e 'delay 0.2' \
          -e 'tell application "System Events" to key code 36'

echo "✅ Done!"
