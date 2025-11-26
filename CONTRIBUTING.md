# Contributing to Codetographer

Thanks for your interest in contributing! Here's how you can help.

## Development Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build everything:
   ```bash
   npm run build
   ```
4. For development with watch mode:
   ```bash
   npm run watch
   ```

## Testing in VS Code

1. Run `npm run watch`
2. Press F5 in VS Code to launch the Extension Development Host
3. Open a `.cgraph` file in the new window

## Testing in Browser

You can test graph rendering in a browser without VS Code:

```bash
cd webview
npm install
npm run build:test
cd ..
node scripts/build-test-html.js test-output/full-demo.cgraph
open test-output/full-demo.html
```

## Project Structure

- `extension/` - VS Code extension code
- `webview/` - React app for graph rendering
- `skill/` - Claude Code skill for generating graphs
- `scripts/` - Build and test utilities
- `test-output/` - Example `.cgraph` files

## Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Test thoroughly
5. Commit with clear messages
6. Push to your fork
7. Open a Pull Request

## Code Style

- TypeScript for all source code
- Use the existing patterns in the codebase
- Run the build to check for type errors

## Reporting Issues

- Check existing issues first
- Include steps to reproduce
- Include the `.cgraph` file if relevant (sanitize any sensitive data)

## Questions?

Open an issue for any questions about contributing.

