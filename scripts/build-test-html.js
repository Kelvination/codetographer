#!/usr/bin/env node

/**
 * Build a standalone HTML file with embedded graph data
 *
 * Usage: node scripts/build-test-html.js <cgraph-file>
 *
 * Outputs a self-contained HTML file that renders the graph using React Flow.
 */

const fs = require('fs');
const path = require('path');

const cgraphFile = process.argv[2];

if (!cgraphFile) {
  console.error('Usage: node scripts/build-test-html.js <cgraph-file>');
  process.exit(1);
}

const cgraphPath = path.resolve(cgraphFile);
if (!fs.existsSync(cgraphPath)) {
  console.error(`File not found: ${cgraphPath}`);
  process.exit(1);
}

// Read graph data
const graphData = JSON.parse(fs.readFileSync(cgraphPath, 'utf-8'));

// Read built app files
const appDir = path.join(__dirname, '..', 'test-output', 'app');
const templateHtml = fs.readFileSync(path.join(appDir, 'test.html'), 'utf-8');
const mainJs = fs.readFileSync(path.join(appDir, 'main.js'), 'utf-8');
const css = fs.readFileSync(path.join(appDir, 'test.css'), 'utf-8');

// Create self-contained HTML with embedded graph data
const html = templateHtml
  // Inject graph data before the main script
  .replace(
    '<script type="module"',
    `<script>window.__CGRAPH_DATA__ = ${JSON.stringify(graphData)};</script>\n    <script type="module"`
  )
  // Inline the CSS
  .replace(
    /<link[^>]*href="[^"]*\.css"[^>]*>/,
    `<style>${css}</style>`
  )
  // Inline the JS (convert module to regular script for self-contained HTML)
  .replace(
    /<script type="module"[^>]*src="[^"]*main\.js"[^>]*><\/script>/,
    `<script type="module">${mainJs}</script>`
  );

// Write output
const outputDir = path.join(__dirname, '..', 'test-output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const baseName = path.basename(cgraphFile, '.cgraph');
const htmlPath = path.join(outputDir, `${baseName}.html`);
fs.writeFileSync(htmlPath, html);
console.log(`✓ Generated: ${htmlPath}`);
