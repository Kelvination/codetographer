#!/usr/bin/env node

/**
 * Standalone graph renderer for testing
 *
 * Usage: node scripts/render-graph.js <cgraph-file> [--open]
 *
 * Generates an HTML file that renders the graph using pure SVG (no dependencies).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const cgraphFile = process.argv[2];
const shouldOpen = process.argv.includes('--open');

if (!cgraphFile) {
  console.error('Usage: node scripts/render-graph.js <cgraph-file> [--open]');
  process.exit(1);
}

const cgraphPath = path.resolve(cgraphFile);
if (!fs.existsSync(cgraphPath)) {
  console.error(`File not found: ${cgraphPath}`);
  process.exit(1);
}

const graphData = JSON.parse(fs.readFileSync(cgraphPath, 'utf-8'));

// Layout the graph
function layoutGraph(graph) {
  const nodeWidth = 220;
  const nodeHeight = 80;
  const xGap = 100;
  const yGap = 100;

  const positions = new Map();
  const levels = new Map();
  const visited = new Set();

  // Find root nodes
  const hasIncoming = new Set(graph.edges.map(e => e.target));
  const roots = graph.nodes.filter(n => !hasIncoming.has(n.id));
  if (roots.length === 0 && graph.nodes.length > 0) roots.push(graph.nodes[0]);

  // BFS to assign levels
  const queue = roots.map(n => ({ id: n.id, level: 0 }));
  while (queue.length > 0) {
    const { id, level } = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    if (!levels.has(level)) levels.set(level, []);
    levels.get(level).push(id);
    graph.edges.filter(e => e.source === id).forEach(e => {
      if (!visited.has(e.target)) queue.push({ id: e.target, level: level + 1 });
    });
  }

  // Add unvisited
  graph.nodes.forEach(n => {
    if (!visited.has(n.id)) {
      if (!levels.has(0)) levels.set(0, []);
      levels.get(0).push(n.id);
    }
  });

  // Position
  let maxWidth = 0;
  levels.forEach((nodeIds) => {
    const w = nodeIds.length * nodeWidth + (nodeIds.length - 1) * xGap;
    if (w > maxWidth) maxWidth = w;
  });

  levels.forEach((nodeIds, level) => {
    const totalWidth = nodeIds.length * nodeWidth + (nodeIds.length - 1) * xGap;
    const startX = (maxWidth - totalWidth) / 2 + 50;
    nodeIds.forEach((nodeId, idx) => {
      positions.set(nodeId, {
        x: startX + idx * (nodeWidth + xGap),
        y: 80 + level * (nodeHeight + yGap),
        width: nodeWidth,
        height: nodeHeight,
      });
    });
  });

  return { positions, width: maxWidth + 100, height: 80 + levels.size * (nodeHeight + yGap) + 50 };
}

const { positions, width, height } = layoutGraph(graphData);

// Colors
const typeColors = { function: '#4fc1ff', method: '#dcdcaa', class: '#4ec9b0', module: '#c586c0', file: '#ce9178' };
const defaultEdgeColors = { calls: '#4fc1ff', imports: '#8b8b8b', extends: '#4ec9b0', implements: '#c586c0', uses: '#8b8b8b' };

// Escape HTML
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// Render node
function renderNode(node) {
  const pos = positions.get(node.id);
  if (!pos) return '';
  const color = typeColors[node.type] || '#8b8b8b';
  const icon = node.type[0].toUpperCase();
  const desc = node.description ? esc(node.description.slice(0, 45) + (node.description.length > 45 ? '...' : '')) : '';
  const file = esc(node.location.file.split('/').pop());
  const line = `L${node.location.startLine}`;

  return `
    <g transform="translate(${pos.x}, ${pos.y})">
      <rect width="${pos.width}" height="${pos.height}" rx="8" fill="#252526" stroke="#454545"/>
      <rect x="10" y="12" width="20" height="20" rx="4" fill="${color}"/>
      <text x="20" y="27" text-anchor="middle" fill="#1e1e1e" font-size="12" font-weight="bold" font-family="sans-serif">${icon}</text>
      <text x="40" y="27" fill="#d4d4d4" font-size="13" font-weight="500" font-family="sans-serif">${esc(node.label)}</text>
      ${desc ? `<text x="10" y="48" fill="#8b8b8b" font-size="11" font-family="sans-serif">${desc}</text>` : ''}
      <text x="10" y="${pos.height - 12}" fill="#6b6b6b" font-size="10" font-family="sans-serif">${file} · ${line}</text>
    </g>`;
}

// Render edge
function renderEdge(edge, idx) {
  const src = positions.get(edge.source);
  const tgt = positions.get(edge.target);
  if (!src || !tgt) return '';

  const importance = edge.importance || 'secondary';
  const sw = importance === 'primary' ? 3 : importance === 'tertiary' ? 1.5 : 2;
  const op = importance === 'primary' ? 1 : importance === 'tertiary' ? 0.5 : 0.8;
  const color = edge.color || defaultEdgeColors[edge.type] || '#8b8b8b';

  const x1 = src.x + src.width / 2, y1 = src.y + src.height;
  const x2 = tgt.x + tgt.width / 2, y2 = tgt.y;
  const my = (y1 + y2) / 2;

  return `
    <defs><marker id="arr${idx}" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="${color}" opacity="${op}"/></marker></defs>
    <path d="M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}" fill="none" stroke="${color}" stroke-width="${sw}" opacity="${op}" marker-end="url(#arr${idx})" stroke-dasharray="${importance === 'primary' ? '' : '6,3'}">
      <animate attributeName="stroke-dashoffset" from="18" to="0" dur="0.8s" repeatCount="indefinite"/>
    </path>`;
}

// Build SVG
const nodesSvg = graphData.nodes.map(n => renderNode(n)).join('');
const edgesSvg = graphData.edges.map((e, i) => renderEdge(e, i)).join('');

// Legend HTML
let legendHtml = '';
if (graphData.legend) {
  legendHtml = `<div style="position:absolute;bottom:16px;left:16px;background:#252526;border:1px solid #454545;border-radius:8px;padding:12px 16px;font-family:sans-serif;font-size:12px;">
    ${graphData.legend.title ? `<div style="font-weight:600;margin-bottom:10px;color:#d4d4d4;">${esc(graphData.legend.title)}</div>` : ''}
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${graphData.legend.items.map(it => `<div style="display:flex;align-items:center;gap:10px;"><span style="width:24px;height:4px;border-radius:2px;background:${it.color};"></span><span style="color:#8b8b8b;">${esc(it.label)}</span></div>`).join('')}
    </div>
  </div>`;
}

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${esc(graphData.metadata?.title || 'Graph')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #1e1e1e; font-family: -apple-system, sans-serif; }
    .header { padding: 12px 16px; background: #252526; border-bottom: 1px solid #454545; }
    .header h1 { font-size: 16px; font-weight: 500; color: #d4d4d4; margin-bottom: 4px; }
    .header p { font-size: 12px; color: #8b8b8b; }
    .container { position: relative; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${esc(graphData.metadata?.title || 'Graph')}</h1>
    ${graphData.metadata?.description ? `<p>${esc(graphData.metadata.description)}</p>` : ''}
  </div>
  <div class="container">
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${edgesSvg}
      ${nodesSvg}
    </svg>
    ${legendHtml}
  </div>
</body>
</html>`;

// Write
const outputDir = path.join(__dirname, '..', 'test-output');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const baseName = path.basename(cgraphFile, '.cgraph');
const htmlPath = path.join(outputDir, `${baseName}.html`);
fs.writeFileSync(htmlPath, html);
console.log(`✓ Generated: ${htmlPath}`);

if (shouldOpen) {
  try {
    if (process.platform === 'darwin') execSync(`open "${htmlPath}"`);
    else if (process.platform === 'win32') execSync(`start "${htmlPath}"`);
    else execSync(`xdg-open "${htmlPath}"`);
  } catch (e) { console.log(`Please open: ${htmlPath}`); }
}
