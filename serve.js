// Servidor local simples (sem dependências): node serve.js [porta]
const http = require('http');
const fs = require('fs');
const path = require('path');
const porta = +process.argv[2] || 5173;
const raiz = __dirname;
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const arq = path.join(raiz, path.normalize(p));
  if (!arq.startsWith(raiz)) { res.writeHead(403); return res.end(); }
  fs.readFile(arq, (err, data) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': (tipos[path.extname(arq)] || 'application/octet-stream') + '; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(porta, '0.0.0.0', () => console.log(`Prof rodando em http://localhost:${porta}`));
