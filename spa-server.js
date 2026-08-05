import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const DIST_DIR = path.join(__dirname, 'dist');
const MIME_TYPES = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon'};

http.createServer((req, res) => {
  let filePath = path.join(DIST_DIR, req.url.split('?')[0]);
  if (!path.extname(filePath)) { filePath = path.join(DIST_DIR, 'index.html'); }
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        fs.readFile(path.join(DIST_DIR, 'index.html'), (err2, content2) => {
          res.writeHead(err2 ? 500 : 200, {'Content-Type': 'text/html'});
          res.end(err2 ? 'Server Error' : content2);
        });
      } else { res.writeHead(500); res.end('Server Error'); }
    } else { res.writeHead(200, {'Content-Type': contentType}); res.end(content); }
  });
}).listen(PORT, () => console.log('Server running at http://localhost:' + PORT + '/'));
