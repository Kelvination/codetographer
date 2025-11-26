#!/usr/bin/env node

/**
 * Headless screenshot of a cgraph using Puppeteer
 *
 * Usage: node scripts/screenshot-graph.js <cgraph-file>
 *
 * Uses the full React Flow + ELK.js renderer (same as VS Code extension).
 */

const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

async function main() {
  const cgraphFile = process.argv[2];

  if (!cgraphFile) {
    console.error('Usage: node scripts/screenshot-graph.js <cgraph-file>');
    process.exit(1);
  }

  const cgraphPath = path.resolve(cgraphFile);
  if (!fs.existsSync(cgraphPath)) {
    console.error(`File not found: ${cgraphPath}`);
    process.exit(1);
  }

  // Read graph data
  const graphData = JSON.parse(fs.readFileSync(cgraphPath, 'utf-8'));

  // Load built app files
  const appDir = path.join(__dirname, '..', 'test-output', 'app');
  if (!fs.existsSync(path.join(appDir, 'main.js'))) {
    console.error('Test app not built. Run: cd webview && npm run build:test');
    process.exit(1);
  }

  const files = {
    '/': fs.readFileSync(path.join(appDir, 'test.html'), 'utf-8'),
    '/main.js': fs.readFileSync(path.join(appDir, 'main.js'), 'utf-8'),
    '/test.css': fs.readFileSync(path.join(appDir, 'test.css'), 'utf-8'),
  };

  // Inject graph data into HTML
  files['/'] = files['/'].replace(
    '<div id="root">',
    `<script>window.__CGRAPH_DATA__ = ${JSON.stringify(graphData)};</script>\n    <div id="root">`
  );

  // Start server
  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    const content = files[url];

    if (content) {
      const ext = path.extname(url) || '.html';
      const mimeTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
      };
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
      res.end(content);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  console.log(`Started server on port ${port}`);

  console.log('Launching headless browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  // Log console messages for debugging
  page.on('console', msg => console.log('Browser:', msg.text()));
  page.on('pageerror', err => console.log('Page error:', err.message));

  console.log(`Loading http://localhost:${port}...`);
  await page.goto(`http://localhost:${port}`, { waitUntil: 'networkidle0', timeout: 30000 });

  // Wait for React Flow to render and ELK layout to complete
  console.log('Waiting for graph to render...');
  await new Promise(r => setTimeout(r, 3000));

  // Take screenshot
  const screenshotDir = path.join(__dirname, '..', 'test-screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const baseName = path.basename(cgraphFile, '.cgraph');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const screenshotPath = path.join(screenshotDir, `${baseName}-${timestamp}.png`);

  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`✓ Screenshot saved: ${screenshotPath}`);

  await browser.close();
  server.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
