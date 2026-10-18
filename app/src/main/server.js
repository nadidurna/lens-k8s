const http = require('http');
const fs = require('fs');
const path = require('path');
const SettingsManager = require('./settingsManager');
const KubeManager = require('./kubeManager');

const settingsManager = new SettingsManager();
const kubeManager = new KubeManager(settingsManager);

const PORT = process.env.PORT || 3721;
const RENDERER_DIR = path.join(__dirname, '..', 'renderer');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // API Routes
  if (pathname.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      if (pathname === '/api/contexts' && req.method === 'GET') {
        const contexts = await kubeManager.getContexts();
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, contexts }));
        return;
      }

      if (pathname === '/api/switch-context' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const data = JSON.parse(body || '{}');
            const result = await kubeManager.switchContext(data.contextName);
            res.writeHead(200);
            res.end(JSON.stringify(result));
          } catch (e) {
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
        return;
      }

      if (pathname === '/api/resources' && req.method === 'GET') {
        const ns = url.searchParams.get('namespace') || 'all';
        const data = await kubeManager.getClusterResources(ns);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data }));
        return;
      }

      if (pathname === '/api/settings' && req.method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, settings: settingsManager.getAll() }));
        return;
      }

      if (pathname === '/api/settings' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            settingsManager.save(data);
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, settings: settingsManager.getAll() }));
          } catch (e) {
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Endpoint not found' }));
      return;
    } catch (apiErr) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: apiErr.message }));
      return;
    }
  }

  // Static File Serving
  let filePath = path.join(RENDERER_DIR, pathname === '/' ? 'index.html' : pathname);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

if (require.main === module) {
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`\n======================================================`);
    console.log(`🚀 K8s Local Lens Server is running!`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`🔒 Mode: Zero-login, 100% Local-first`);
    console.log(`======================================================\n`);
  });
}

module.exports = { server, settingsManager, kubeManager, PORT };
