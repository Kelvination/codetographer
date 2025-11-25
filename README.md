# CodeGrapher

Interactive code flow visualization for VS Code. Similar to Windsurf Codemaps.

## Features

- **Custom `.cgraph` file format** - JSON-based format for storing code graphs with precise file/line locations
- **Interactive graph visualization** - Uses React Flow for beautiful, navigable diagrams
- **Click-to-navigate** - Cmd+Click (Ctrl+Click) any node to jump to that code location
- **Connection highlighting** - Click a node to see its connected nodes highlighted
- **Claude Code skill** - Automatically generate graphs from natural language queries

## Installation

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# For development (watch mode)
npm run watch
```

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

Copy `skill/SKILL.md` to your project's `.claude/skills/codegrapher/` directory.

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

### Project Structure

```
codegrapher/
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
└── example.cgraph      # Example graph file
```

### Commands

```bash
npm run build    # Build everything
npm run watch    # Watch mode for development
npm run package  # Create .vsix package
```

### Testing

1. Run `npm run watch`
2. Press F5 in VS Code to launch Extension Development Host
3. Open `example.cgraph` in the new window

## License

MIT
