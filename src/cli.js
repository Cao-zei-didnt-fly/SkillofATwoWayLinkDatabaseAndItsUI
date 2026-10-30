import { Store } from './store.js';
import fs from 'node:fs';
// One JSON operation in, one JSON envelope out; no running server needed.
try {
  const args = process.argv.slice(2), index = args.indexOf('--vault');
  const root = index >= 0 ? args.splice(index,2)[1] : process.env.LINK_GARDEN_VAULT || 'vault';
  const input = args[0] || fs.readFileSync(0, 'utf8');
  const store=new Store(root);
  try{console.log(JSON.stringify({ok:true,result:store.execute(JSON.parse(input.replace(/^\uFEFF/,'')))}));}finally{store.close();}
} catch(error) { console.log(JSON.stringify({ok:false,error:error.message})); process.exitCode = 1; }
