import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Store } from './store.js';
const store = new Store(process.env.LINK_GARDEN_VAULT || 'vault');
const port = Number(process.env.PORT || 4317);
const page = fs.readFileSync(fileURLToPath(new URL('../web/index.html',import.meta.url)));
http.createServer(async (req,res) => {
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method==='GET'&&['/app.js','/graph.bundle.js','/graph-worker.bundle.js'].includes(req.url)){res.setHeader('Content-Type','text/javascript; charset=utf-8');return res.end(fs.readFileSync(fileURLToPath(new URL('../web'+req.url,import.meta.url))));}
  if(req.url === '/' && req.method === 'GET') { res.setHeader('Content-Type','text/html; charset=utf-8'); return res.end(page); }
  if(req.url !== '/api' || req.method !== 'POST') {res.writeHead(404);return res.end();}
  res.setHeader('Content-Type','application/json; charset=utf-8');
  try {
    if(req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) throw Error('Cross-origin requests denied');
    if(!req.headers['content-type']?.startsWith('application/json')) throw Error('Expected application/json');
    let body = ''; for await(const chunk of req) { body += chunk; if(Buffer.byteLength(body)>1024*1024) throw Error('Request too large'); }
    res.end(JSON.stringify({ok:true,result:store.execute(JSON.parse(body))}));
  } catch(error) {res.statusCode=400;res.end(JSON.stringify({ok:false,error:error.message}));}
}).listen(port,'127.0.0.1',()=>console.log(`Link Garden: http://127.0.0.1:${port}`));
