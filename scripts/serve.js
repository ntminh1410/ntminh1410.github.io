#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const PORT = Number(process.env.PORT || 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

async function tryResolve(urlPath) {
  // Strip query/hash
  let p = urlPath.split('?')[0].split('#')[0];
  // Default to index.html for directory paths
  if (p.endsWith('/')) p += 'index.html';
  // If no extension, try .html or /index.html
  const candidate = join(DIST, normalize(p));
  if (candidate.indexOf(DIST) !== 0) return null;  // path traversal guard
  try {
    const s = await stat(candidate);
    if (s.isDirectory()) {
      return join(candidate, 'index.html');
    }
    return candidate;
  } catch (e) {
    if (!extname(p)) {
      // Try with /index.html
      try {
        const alt = join(DIST, normalize(p), 'index.html');
        await stat(alt);
        return alt;
      } catch (e2) { /* fall through */ }
    }
    return null;
  }
}

const server = createServer(async (req, res) => {
  const path = await tryResolve(req.url);
  if (!path) {
    // Serve 404.html if available
    try {
      const data = await readFile(join(DIST, '404.html'));
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    }
    return;
  }
  try {
    const data = await readFile(path);
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' });
    res.end(data);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(`500: ${err.message}`);
  }
});

server.listen(PORT, () => {
  console.log(`▸ Serving dist/ at http://localhost:${PORT}`);
});
