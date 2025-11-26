#!/bin/bash

# Test and screenshot script for Codetographer
# Usage: ./scripts/test-and-screenshot.sh [test-name]

set -e

TEST_NAME="${1:-basic}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TEST_OUTPUT_DIR="$PROJECT_DIR/test-output"
SCREENSHOT_DIR="$PROJECT_DIR/test-screenshots"

# Create directories
mkdir -p "$TEST_OUTPUT_DIR"
mkdir -p "$SCREENSHOT_DIR"

# Generate test graph using node
echo "Generating test graph: $TEST_NAME"
node -e "
const fs = require('fs');
const path = require('path');

const testGraphs = {
  basic: {
    version: '1.0',
    metadata: { title: 'Basic Test', description: 'Tests basic rendering', generated: new Date().toISOString(), scope: 'test' },
    nodes: [
      { id: 'entry', label: 'entryPoint()', type: 'function', description: 'Main entry point for the application.', location: { file: 'test/entry.ts', startLine: 1, endLine: 10 } },
      { id: 'service', label: 'MainService', type: 'class', description: 'Core service class.', location: { file: 'test/service.ts', startLine: 1, endLine: 50 } },
      { id: 'helper', label: 'helperFn()', type: 'function', description: 'Helper utility function.', location: { file: 'test/helper.ts', startLine: 1, endLine: 5 } },
    ],
    edges: [
      { id: 'e1', source: 'entry', target: 'service', type: 'calls', importance: 'primary' },
      { id: 'e2', source: 'service', target: 'helper', type: 'calls' },
    ],
    layout: { direction: 'TB' }
  },
  legend: {
    version: '1.0',
    metadata: { title: 'Legend Test', description: 'Tests legend and custom colors', generated: new Date().toISOString(), scope: 'test' },
    nodes: [
      { id: 'api', label: 'API Gateway', type: 'module', description: 'Entry point.', location: { file: 'api.ts', startLine: 1 } },
      { id: 'cache', label: 'Cache', type: 'class', description: 'Redis cache.', location: { file: 'cache.ts', startLine: 1 } },
      { id: 'db', label: 'Database', type: 'module', description: 'PostgreSQL.', location: { file: 'db.ts', startLine: 1 } },
    ],
    edges: [
      { id: 'e1', source: 'api', target: 'cache', type: 'calls', color: '#4ecdc4', importance: 'primary' },
      { id: 'e2', source: 'api', target: 'db', type: 'calls', color: '#ff6b6b' },
      { id: 'e3', source: 'cache', target: 'db', type: 'calls', color: '#ff6b6b' },
    ],
    legend: { title: 'Data Flow', items: [{ color: '#4ecdc4', label: 'Cache access' }, { color: '#ff6b6b', label: 'DB query' }] },
    layout: { direction: 'TB' }
  },
  groups: {
    version: '1.0',
    metadata: { title: 'Groups Test', description: 'Tests grouped nodes', generated: new Date().toISOString(), scope: 'test' },
    groups: [
      { id: 'api', label: 'API Layer' },
      { id: 'service', label: 'Service Layer' },
    ],
    nodes: [
      { id: 'handler', label: 'handler()', type: 'function', description: 'HTTP handler.', location: { file: 'handler.ts', startLine: 1 }, group: 'api' },
      { id: 'validator', label: 'validate()', type: 'function', description: 'Validation.', location: { file: 'validator.ts', startLine: 1 }, group: 'api' },
      { id: 'userSvc', label: 'UserService', type: 'class', description: 'User ops.', location: { file: 'user.ts', startLine: 1 }, group: 'service' },
    ],
    edges: [
      { id: 'e1', source: 'handler', target: 'validator', type: 'calls' },
      { id: 'e2', source: 'handler', target: 'userSvc', type: 'calls', importance: 'primary' },
    ],
    layout: { direction: 'TB' }
  },
  force: {
    version: '1.0',
    metadata: { title: 'Force Layout', description: 'Tests force layout', generated: new Date().toISOString(), scope: 'test' },
    nodes: [
      { id: 'a', label: 'ModuleA', type: 'module', description: 'First.', location: { file: 'a.ts', startLine: 1 } },
      { id: 'b', label: 'ModuleB', type: 'module', description: 'Second.', location: { file: 'b.ts', startLine: 1 } },
      { id: 'c', label: 'ModuleC', type: 'module', description: 'Third.', location: { file: 'c.ts', startLine: 1 } },
      { id: 'd', label: 'ModuleD', type: 'module', description: 'Fourth.', location: { file: 'd.ts', startLine: 1 } },
    ],
    edges: [
      { id: 'e1', source: 'a', target: 'b', type: 'imports' },
      { id: 'e2', source: 'a', target: 'c', type: 'imports' },
      { id: 'e3', source: 'b', target: 'd', type: 'calls', importance: 'primary' },
      { id: 'e4', source: 'c', target: 'd', type: 'calls' },
    ],
    layout: { type: 'force', direction: 'TB' }
  }
};

const testName = '$TEST_NAME';
if (testName === 'list') {
  console.log('Available: ' + Object.keys(testGraphs).join(', '));
  process.exit(0);
}

const graph = testGraphs[testName];
if (!graph) {
  console.error('Unknown test: ' + testName);
  console.log('Available: ' + Object.keys(testGraphs).join(', '));
  process.exit(1);
}

fs.writeFileSync('$TEST_OUTPUT_DIR/' + testName + '.cgraph', JSON.stringify(graph, null, 2));
console.log('Created: $TEST_OUTPUT_DIR/' + testName + '.cgraph');
"

TEST_FILE="$TEST_OUTPUT_DIR/$TEST_NAME.cgraph"

echo ""
echo "Opening in VS Code..."
code "$TEST_FILE"

echo ""
echo "Waiting 3 seconds for graph to render..."
sleep 3

# Take screenshot of the frontmost window
SCREENSHOT_FILE="$SCREENSHOT_DIR/$TEST_NAME-$(date +%Y%m%d-%H%M%S).png"

# On macOS, capture the frontmost window interactively
if [[ "$OSTYPE" == "darwin"* ]]; then
  echo ""
  echo "Taking screenshot in 2 seconds..."
  echo "Make sure the VS Code window with the graph is visible!"
  sleep 2

  # Use -w for window selection mode (interactive)
  # Or -x -o for silent full screen capture
  if screencapture -x "$SCREENSHOT_FILE" 2>/dev/null; then
    echo "✓ Screenshot saved: $SCREENSHOT_FILE"
  else
    echo ""
    echo "Automatic screenshot failed (may need screen recording permission)."
    echo ""
    echo "To take a manual screenshot:"
    echo "  1. Press Cmd+Shift+4, then Space, then click the VS Code window"
    echo "  2. Or run in VS Code: Cmd+Shift+P > 'Developer: Capture Editor Screenshot'"
    echo ""
    echo "Screenshot will be saved to: $SCREENSHOT_DIR/"
  fi
else
  echo "Screenshot not supported on this OS. Please take a manual screenshot."
fi

echo ""
echo "Test file: $TEST_FILE"
echo "Available tests: basic, legend, groups, force"
