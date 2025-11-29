# Codetographer

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Interactive code flow visualization for VS Code.

## Features

- **Custom `.cgraph` file format** - JSON-based format for storing code graphs with precise file/line locations
- **Interactive graph visualization** - Uses React Flow for beautiful, navigable diagrams
- **Click-to-navigate** - Cmd+Click (Ctrl+Click) any node to jump to that code location
- **Connection highlighting** - Click a node to see its connected nodes highlighted
- **Claude Code skill** - Automatically generate graphs from natural language queries

## Installation

```bash
# Install dependencies (pnpm recommended, npm/yarn also work)
pnpm install

# One-time setup (installs vsce CLI if needed, runs initial build)
pnpm setup

# Build and install locally (auto-detects VS Code or Cursor)
pnpm build:local
```

> **Note:** This project uses workspaces - only run `install` at the root level. The `extension/` and `webview/` dependencies are handled automatically.

## Usage

### Opening a Graph

1. Create a `.cgraph` file (see format below)
2. Open it in VS Code - it will automatically render as an interactive graph

### Interacting with the Graph

- **Click a node**: Highlights all connected nodes (dims unconnected ones)
- **Cmd+Click / Ctrl+Click a node**: Opens the file and jumps to that line
- **Scroll/pinch**: Zoom in and out
- **Drag**: Pan around the graph
- **Controls (bottom-left)**: Zoom in/out, fit to view

### Using the Claude Code Skill

Copy `skill/SKILL.md` to your project's `.claude/skills/codetographer/` directory.

Then ask Claude Code things like:

- "How does user authentication work?"
- "Show me the data flow for order processing"
- "Create a graph of the API routes"

## `.cgraph` File Format

```json
{
  "version": "1.0",
  "metadata": {
    "title": "Graph Title",
    "description": "What this graph shows",
    "generated": "2025-11-25T00:00:00Z",
    "scope": "src/relevant/path"
  },
  "nodes": [
    {
      "id": "unique-id",
      "label": "functionName()",
      "type": "function",
      "description": "What this does",
      "location": {
        "file": "src/path/to/file.ts",
        "startLine": 42,
        "endLine": 67
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "source-node-id",
      "target": "target-node-id",
      "type": "calls",
      "label": "optional description"
    }
  ],
  "layout": {
    "direction": "TB"
  }
}
```

### Node Types

- `function` - Named functions
- `method` - Class methods
- `class` - Class definitions
- `module` - Files as logical units
- `file` - File-level grouping

### Edge Types

- `calls` - Function/method invocation
- `imports` - Module import
- `extends` - Class inheritance
- `implements` - Interface implementation
- `uses` - General dependency

### Layout Directions

- `TB` - Top to bottom (default)
- `LR` - Left to right
- `BT` - Bottom to top
- `RL` - Right to left

## Development

### Quick Start

```bash
pnpm install           # One-time
pnpm setup             # Installs vsce, runs initial build
pnpm build:local       # Build & install locally
```

### Commands

```bash
pnpm setup                  # One-time dev setup
pnpm build                  # Build everything
pnpm watch                  # Watch mode for development
pnpm build:local            # Build, package, and install locally
pnpm build:local --no-reload  # Same, but skip auto-reload
pnpm package                # Create .vsix package
```

### Testing in VS Code

**Option A: Extension Development Host** (recommended for debugging)
1. Run `pnpm watch`
2. Press F5 in VS Code to launch Extension Development Host
3. Open a `.cgraph` file in the new window

**Option B: Local Installation** (quick testing)
```bash
pnpm build:local            # Auto-detects VS Code vs Cursor
pnpm build:local:cursor     # Force Cursor
pnpm build:local:code       # Force VS Code
```

### Auto-Reload (macOS)

The `build:local` script can automatically reload your editor window after installation. This requires macOS Accessibility permission for your terminal app.

If you see the permission prompt:
1. Open **System Settings > Privacy & Security > Accessibility**
2. Add your terminal app (Terminal, iTerm, Warp, etc.)

Or use `pnpm build:local --no-reload` and manually reload with `Cmd+Shift+P > Reload Window`.

### Project Structure

```
codetographer/
├── extension/          # VS Code extension
│   ├── src/
│   │   ├── extension.ts
│   │   └── cgraphEditorProvider.ts
│   └── media/          # Built webview assets
├── webview/            # React app for rendering
│   └── src/
│       ├── components/
│       │   ├── GraphCanvas.tsx
│       │   └── CodeNode.tsx
│       └── hooks/
│           └── useVSCodeApi.ts
├── skill/              # Claude Code skill
│   └── SKILL.md
├── scripts/            # Build utilities
│   ├── setup.sh        # One-time dev setup
│   └── build-local.sh  # Build & install locally
└── example.cgraph      # Example graph file
```

### Publishing to VS Code Marketplace

To publish to the VS Code Marketplace:

1. Create a publisher at https://marketplace.visualstudio.com/manage
2. Update `extension/package.json` and replace `"publisher": "your-publisher-id"` with your publisher ID
3. Run `pnpm package` to create the `.vsix` file
4. Upload via the marketplace or use `vsce publish`

### Testing in Browser (Standalone)

You can test graph rendering in a browser without VS Code. This is useful for:
- Rapid iteration on graph layout and styling
- Automated screenshot testing
- Viewing graphs without the extension installed

#### One-time setup

```bash
cd webview
npm install
npm run build:test
cd ..
npm install puppeteer  # For automated screenshots
```

#### Open a graph in Chrome

```bash
# Build the HTML file with embedded graph data
node scripts/build-test-html.js path/to/your.cgraph

# Open in browser
open test-output/your.html           # macOS
xdg-open test-output/your.html       # Linux
start test-output/your.html          # Windows
```

The browser version uses the same React Flow + ELK.js renderer as the VS Code extension, so it looks identical.

#### Take automated screenshots

```bash
node scripts/screenshot-graph.js path/to/your.cgraph
# Screenshot saved to test-screenshots/
```

This uses Puppeteer to render the graph headlessly and capture a PNG.

#### Example test graphs

```bash
# Simple 3-node graph with legend
node scripts/screenshot-graph.js test-output/legend.cgraph

# Full demo with groups, all node types, edge importance, colors
node scripts/screenshot-graph.js test-output/full-demo.cgraph
```

### Test Files

- `test-output/legend.cgraph` - Simple graph demonstrating custom colors and legend
- `test-output/full-demo.cgraph` - Complete demo with 20 nodes, 4 groups, all features
- `test-output/app/` - Built standalone React app (generated by `build:test`)
- `test-screenshots/` - Generated PNG screenshots

## License

MIT
