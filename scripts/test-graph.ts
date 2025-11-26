#!/usr/bin/env npx ts-node

/**
 * Test script for CodeGrapher
 *
 * Usage: npx ts-node scripts/test-graph.ts [test-name]
 *
 * This script:
 * 1. Generates a test .cgraph file
 * 2. Opens it in VS Code
 * 3. Waits for rendering
 * 4. Takes a screenshot (if supported)
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawn } from 'child_process';

// Test graph definitions
const testGraphs: Record<string, object> = {
  // Basic test with all edge types and importance levels
  'basic': {
    version: '1.0',
    metadata: {
      title: 'Basic Test Graph',
      description: 'Tests all edge types and importance levels',
      generated: new Date().toISOString(),
      scope: 'test'
    },
    nodes: [
      { id: 'entry', label: 'entryPoint()', type: 'function', description: 'The main entry point.', location: { file: 'test/entry.ts', startLine: 1, endLine: 10 } },
      { id: 'service', label: 'MainService', type: 'class', description: 'Core service class that handles business logic.', location: { file: 'test/service.ts', startLine: 1, endLine: 50 } },
      { id: 'helper', label: 'helperFn()', type: 'function', description: 'Helper function.', location: { file: 'test/helper.ts', startLine: 1, endLine: 5 } },
      { id: 'util', label: 'UtilModule', type: 'module', description: 'Utility module with shared functions.', location: { file: 'test/util.ts', startLine: 1, endLine: 20 } },
    ],
    edges: [
      { id: 'e1', source: 'entry', target: 'service', type: 'calls', importance: 'primary' },
      { id: 'e2', source: 'service', target: 'helper', type: 'calls', importance: 'secondary' },
      { id: 'e3', source: 'helper', target: 'util', type: 'imports', importance: 'tertiary' },
    ],
    layout: { direction: 'TB' }
  },

  // Test with groups
  'groups': {
    version: '1.0',
    metadata: {
      title: 'Groups Test',
      description: 'Tests group/section rendering',
      generated: new Date().toISOString(),
      scope: 'test'
    },
    groups: [
      { id: 'api', label: 'API Layer', description: 'HTTP handlers' },
      { id: 'service', label: 'Service Layer', description: 'Business logic' },
    ],
    nodes: [
      { id: 'handler', label: 'handleRequest()', type: 'function', description: 'HTTP handler.', location: { file: 'api/handler.ts', startLine: 1 }, group: 'api' },
      { id: 'validator', label: 'validateInput()', type: 'function', description: 'Input validation.', location: { file: 'api/validator.ts', startLine: 1 }, group: 'api' },
      { id: 'userService', label: 'UserService', type: 'class', description: 'User operations.', location: { file: 'services/user.ts', startLine: 1 }, group: 'service' },
      { id: 'dbService', label: 'DatabaseService', type: 'class', description: 'Database operations.', location: { file: 'services/db.ts', startLine: 1 }, group: 'service' },
    ],
    edges: [
      { id: 'e1', source: 'handler', target: 'validator', type: 'calls' },
      { id: 'e2', source: 'handler', target: 'userService', type: 'calls', importance: 'primary' },
      { id: 'e3', source: 'userService', target: 'dbService', type: 'calls' },
    ],
    layout: { direction: 'TB' }
  },

  // Test with custom colors and legend
  'legend': {
    version: '1.0',
    metadata: {
      title: 'Legend Test',
      description: 'Tests custom colors and legend',
      generated: new Date().toISOString(),
      scope: 'test'
    },
    nodes: [
      { id: 'api', label: 'API Gateway', type: 'module', description: 'Entry point for all requests.', location: { file: 'api/gateway.ts', startLine: 1 } },
      { id: 'cache', label: 'CacheLayer', type: 'class', description: 'Redis cache.', location: { file: 'cache/redis.ts', startLine: 1 } },
      { id: 'db', label: 'Database', type: 'module', description: 'PostgreSQL database.', location: { file: 'db/postgres.ts', startLine: 1 } },
      { id: 'queue', label: 'MessageQueue', type: 'class', description: 'RabbitMQ queue.', location: { file: 'queue/rabbit.ts', startLine: 1 } },
    ],
    edges: [
      { id: 'e1', source: 'api', target: 'cache', type: 'calls', color: '#4ecdc4', importance: 'primary' },
      { id: 'e2', source: 'api', target: 'db', type: 'calls', color: '#ff6b6b', importance: 'primary' },
      { id: 'e3', source: 'cache', target: 'db', type: 'calls', color: '#ff6b6b' },
      { id: 'e4', source: 'api', target: 'queue', type: 'calls', color: '#ffe66d' },
    ],
    legend: {
      title: 'Data Flow',
      items: [
        { color: '#4ecdc4', label: 'Cache read' },
        { color: '#ff6b6b', label: 'Database access' },
        { color: '#ffe66d', label: 'Async message' },
      ]
    },
    layout: { direction: 'TB' }
  },

  // Test force layout
  'force': {
    version: '1.0',
    metadata: {
      title: 'Force Layout Test',
      description: 'Tests compact force-directed layout',
      generated: new Date().toISOString(),
      scope: 'test'
    },
    nodes: [
      { id: 'a', label: 'ModuleA', type: 'module', description: 'First module.', location: { file: 'a.ts', startLine: 1 } },
      { id: 'b', label: 'ModuleB', type: 'module', description: 'Second module.', location: { file: 'b.ts', startLine: 1 } },
      { id: 'c', label: 'ModuleC', type: 'module', description: 'Third module.', location: { file: 'c.ts', startLine: 1 } },
      { id: 'd', label: 'ModuleD', type: 'module', description: 'Fourth module.', location: { file: 'd.ts', startLine: 1 } },
      { id: 'e', label: 'ModuleE', type: 'module', description: 'Fifth module.', location: { file: 'e.ts', startLine: 1 } },
    ],
    edges: [
      { id: 'e1', source: 'a', target: 'b', type: 'imports' },
      { id: 'e2', source: 'a', target: 'c', type: 'imports' },
      { id: 'e3', source: 'b', target: 'd', type: 'imports' },
      { id: 'e4', source: 'c', target: 'd', type: 'imports' },
      { id: 'e5', source: 'd', target: 'e', type: 'calls', importance: 'primary' },
      { id: 'e6', source: 'b', target: 'e', type: 'calls' },
      { id: 'e7', source: 'c', target: 'e', type: 'uses' },
    ],
    layout: { type: 'force', direction: 'TB' }
  },

  // Complex test with everything
  'complex': {
    version: '1.0',
    metadata: {
      title: 'Complex Test',
      description: 'Tests all features together',
      generated: new Date().toISOString(),
      scope: 'test'
    },
    groups: [
      { id: 'frontend', label: 'Frontend', description: 'React components' },
      { id: 'backend', label: 'Backend', description: 'API and services' },
    ],
    nodes: [
      { id: 'app', label: 'App', type: 'module', description: 'Root React component.', location: { file: 'src/App.tsx', startLine: 1 }, group: 'frontend' },
      { id: 'dashboard', label: 'Dashboard', type: 'module', description: 'Dashboard view.', location: { file: 'src/Dashboard.tsx', startLine: 1 }, group: 'frontend' },
      { id: 'api', label: 'APIClient', type: 'class', description: 'HTTP client for backend.', location: { file: 'src/api.ts', startLine: 1 }, group: 'frontend' },
      { id: 'handler', label: 'RequestHandler', type: 'class', description: 'Express route handler.', location: { file: 'server/handler.ts', startLine: 1 }, group: 'backend' },
      { id: 'service', label: 'DataService', type: 'class', description: 'Business logic layer.', location: { file: 'server/service.ts', startLine: 1 }, group: 'backend' },
      { id: 'db', label: 'Database', type: 'module', description: 'Database connection.', location: { file: 'server/db.ts', startLine: 1 }, group: 'backend' },
    ],
    edges: [
      { id: 'e1', source: 'app', target: 'dashboard', type: 'imports' },
      { id: 'e2', source: 'dashboard', target: 'api', type: 'calls', color: '#4ecdc4', importance: 'primary' },
      { id: 'e3', source: 'api', target: 'handler', type: 'calls', color: '#4ecdc4', importance: 'primary' },
      { id: 'e4', source: 'handler', target: 'service', type: 'calls' },
      { id: 'e5', source: 'service', target: 'db', type: 'calls', color: '#ff6b6b' },
    ],
    legend: {
      title: 'Request Flow',
      items: [
        { color: '#4ecdc4', label: 'HTTP request' },
        { color: '#ff6b6b', label: 'Database query' },
      ]
    },
    layout: { direction: 'TB' }
  },
};

async function main() {
  const testName = process.argv[2] || 'basic';

  if (testName === 'list') {
    console.log('Available tests:', Object.keys(testGraphs).join(', '));
    return;
  }

  const graph = testGraphs[testName];
  if (!graph) {
    console.error(`Unknown test: ${testName}`);
    console.log('Available tests:', Object.keys(testGraphs).join(', '));
    process.exit(1);
  }

  // Write test file
  const testDir = path.join(__dirname, '..', 'test-output');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  const testFile = path.join(testDir, `${testName}.cgraph`);
  fs.writeFileSync(testFile, JSON.stringify(graph, null, 2));
  console.log(`✓ Created ${testFile}`);

  // Open in VS Code
  console.log('Opening in VS Code...');
  try {
    execSync(`code "${testFile}"`, { stdio: 'inherit' });
    console.log('✓ Opened in VS Code');
    console.log('\nTo take a screenshot:');
    console.log('  1. Wait for the graph to render');
    console.log('  2. Run: Cmd+Shift+P > "Developer: Take Screenshot"');
    console.log('  3. Or use: npx ts-node scripts/screenshot.ts');
  } catch (e) {
    console.log('Could not open VS Code automatically. Please open:', testFile);
  }
}

main().catch(console.error);
