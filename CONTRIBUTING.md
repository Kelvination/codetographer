# Contributing to Codetographer

Thanks for your interest in contributing! Here's how to get started.

## Quick Start

```bash
git clone https://github.com/Kelvination/codetographer.git
cd codetographer
pnpm install        # Or npm install / yarn install
pnpm setup          # Installs vsce, runs initial build
pnpm build:local    # Build and install locally
```

## Prerequisites

- **Node.js 18+**
- **pnpm** (recommended) or npm/yarn
- **VS Code** or **Cursor**

## Development Setup

### 1. Install Dependencies

```bash
pnpm install
```

> **Important:** This project uses workspaces. Only run `install` at the root level - the `extension/` and `webview/` dependencies are handled automatically.

### 2. One-Time Setup

```bash
pnpm setup
```

This will:
- Install the `vsce` CLI globally (if not already installed)
- Run an initial build to verify everything works

### 3. Build and Install Locally

```bash
pnpm build:local
```

This command:
- Builds the extension and webview
- Packages the extension as a `.vsix` file
- Installs it into VS Code or Cursor (auto-detected)
- Reloads the editor window

## Development Workflow

### Local Installation (Primary)

```bash
pnpm build:local              # Auto-detects VS Code vs Cursor
pnpm build:local:cursor       # Force Cursor
pnpm build:local:code         # Force VS Code
pnpm build:local --no-reload  # Skip auto-reload
```

### Extension Development Host (For Debugging)

1. Open the Run and Debug panel in VS Code
2. Select **"Run Extension (Watch)"** from the dropdown
3. Press **F5** to launch the Extension Development Host
4. Open a `.cgraph` file in the new window
5. Changes auto-rebuild; use **Cmd+R** to reload the dev host

## Auto-Reload Permission (macOS)

The `build:local` script uses macOS Accessibility to automatically reload your editor window after installation. The first time you run it, you'll see a permission prompt.

**To enable:**
1. Open **System Settings > Privacy & Security > Accessibility**
2. Click **+** and add your terminal app (Terminal, iTerm, Warp, etc.)
3. Enable the checkbox next to it
4. Run the script again

**If you prefer not to grant this permission:**
```bash
pnpm build:local --no-reload
```
Then manually reload with **Cmd+Shift+P > Reload Window**.

## Testing in Browser (Standalone)

You can test graph rendering in a browser without VS Code. This is useful for:
- Rapid iteration on graph layout and styling
- Automated screenshot testing
- AI-assisted development workflows

### Setup

```bash
cd webview
pnpm build:test
cd ..
pnpm install puppeteer  # Optional: for automated screenshots
```

### View a Graph in Browser

```bash
node scripts/build-test-html.js path/to/your.cgraph
open test-output/your.html           # macOS
xdg-open test-output/your.html       # Linux
start test-output/your.html          # Windows
```

The browser version uses the same React Flow + ELK.js renderer as the VS Code extension.

### Automated Screenshots

```bash
node scripts/screenshot-graph.js path/to/your.cgraph
# Screenshot saved to test-screenshots/
```

Uses Puppeteer to render the graph headlessly and capture a PNG.

### Test Files

- `test-output/legend.cgraph` - Simple graph with custom colors and legend
- `test-output/full-demo.cgraph` - Complete demo with groups, all node types, edge importance

## Project Structure

```
codetographer/
├── extension/          # VS Code extension
│   ├── src/            # TypeScript source
│   └── media/          # Built webview assets (output)
├── webview/            # React app for graph rendering
│   └── src/            # React components, hooks
├── skill/              # Claude Code skill
├── scripts/            # Build utilities
│   ├── setup.sh        # One-time dev setup
│   └── build-local.sh  # Build & install locally
└── test-output/        # Example .cgraph files
```

## Available Commands

| Command | Description |
|---------|-------------|
| `pnpm setup` | One-time setup (installs vsce, builds) |
| `pnpm build` | Build everything |
| `pnpm build:local` | Build, package, and install locally |
| `pnpm package` | Create `.vsix` package |

## Submitting Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Test with `pnpm build:local`
5. Commit with clear messages
6. Push to your fork
7. Open a Pull Request

## Code Style

- TypeScript for all source code
- Follow existing patterns in the codebase
- Run `pnpm build` to check for type errors

## Reporting Issues

- Check existing issues first
- Include steps to reproduce
- Include the `.cgraph` file if relevant (sanitize any sensitive data)

## Questions?

Open an issue for any questions about contributing.
