#!/bin/bash
# One-time setup script for Codetographer development
#
# This script:
# 1. Installs project dependencies (using pnpm/npm/yarn)
# 2. Installs vsce CLI if not already installed
# 3. Runs an initial build to verify everything works

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

echo "==================================="
echo "  Codetographer Development Setup"
echo "==================================="
echo ""

# Detect package manager based on lockfile
detect_pkg_manager() {
    if [ -f "pnpm-lock.yaml" ] && command -v pnpm &> /dev/null; then
        echo "pnpm"
    elif [ -f "yarn.lock" ] && command -v yarn &> /dev/null; then
        echo "yarn"
    else
        echo "npm"
    fi
}

PKG_MGR=$(detect_pkg_manager)
echo "Using package manager: $PKG_MGR"
echo ""

# Step 1: Install project dependencies
echo "Step 1/3: Installing project dependencies..."
echo "(This uses workspaces - no need to install in subdirectories)"
$PKG_MGR install
echo "Done."
echo ""

# Step 2: Check/install vsce
echo "Step 2/3: Checking for vsce CLI..."
if ! command -v vsce &> /dev/null; then
    echo "vsce not found. Installing globally..."
    if [ "$PKG_MGR" = "pnpm" ]; then
        pnpm add -g @vscode/vsce
    elif [ "$PKG_MGR" = "yarn" ]; then
        yarn global add @vscode/vsce
    else
        npm install -g @vscode/vsce
    fi
    echo "vsce installed."
else
    echo "vsce already installed: $(vsce --version)"
fi
echo ""

# Step 3: Build to verify setup
echo "Step 3/3: Running initial build..."
if [ "$PKG_MGR" = "pnpm" ]; then
    pnpm build
elif [ "$PKG_MGR" = "yarn" ]; then
    yarn build
else
    npm run build
fi
echo ""

echo "==================================="
echo "  Setup Complete!"
echo "==================================="
echo ""
echo "Next steps:"
echo ""
echo "  For quick local install (auto-detects VS Code/Cursor):"
if [ "$PKG_MGR" = "pnpm" ]; then
    echo "    pnpm build:local"
else
    echo "    $PKG_MGR run build:local"
fi
echo ""
echo "  For development with hot reload:"
if [ "$PKG_MGR" = "pnpm" ]; then
    echo "    pnpm watch"
else
    echo "    $PKG_MGR run watch"
fi
echo "    Then press F5 in VS Code to launch Extension Development Host"
echo ""
