import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {parse as parseToml} from 'smol-toml';
import {adapters} from '../src/agents.js';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'garden-packaged-setup-'));
const home=path.join(root,'用户 空格'),appData=path.join(home,'AppData/Roaming'),localAppData=path.join(home,'AppData/Local'),state=path.join(root,'state'),vault=path.join(root,'vault');
const clients=adapters({home,appData,localAppData,codexHome:path.join(home,'.codex')});
for(const client of clients){fs.mkdirSync(path.dirname(client.config),{recursive:true});fs.writeFileSync(client.config,client.format==='toml'?'# retained comment\nmodel="keep"\n[mcp_servers.other]\ncommand="keep.exe"\n':JSON.stringify({[client.section]:{other:{command:'keep.exe'}}}));}
const executable=path.resolve('dist/win-unpacked/Link Garden.exe');
const args=[path.resolve('dist/win-unpacked/resources/app.asar/src/integration-entry.js'),'--home',home,'--app-data',appData,'--local-app-data',localAppData,'--data-dir',path.join(root,'data'),'--state-dir',state,'--vault',vault];
async function invoke(extra=[]){const child=spawn(executable,[...args,...extra],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},windowsHide:true,stdio:['ignore','pipe','pipe']});let out='',err='';child.stdout.on('data',c=>out+=c);child.stderr.on('data',c=>err+=c);const timer=setTimeout(()=>child.kill(),30000);const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});clearTimeout(timer);assert.equal(code,0,err||out);return JSON.parse(out);}
try{
 const before=clients.map(c=>fs.readFileSync(c.config,'utf8'));
 const first=await invoke();assert.equal(first.registrationRequired,true);assert.equal(first.guide.required,true);assert.equal(first.results.length,7);assert.ok(first.results.every(r=>r.status==='awaiting-agent-registration'));
 clients.forEach((c,i)=>assert.equal(fs.readFileSync(c.config,'utf8'),before[i]));await invoke();clients.forEach((c,i)=>assert.equal(fs.readFileSync(c.config,'utf8'),before[i]));
 const guide=fs.readFileSync(path.join(state,'REGISTER-MCP.md'),'utf8');assert.match(guide,/ELECTRON_RUN_AS_NODE/);assert.match(guide,/--scope user/);assert.match(guide,/全局注册/);assert.match(guide,/WorkBuddy 专项/);
 const result=await invoke(['--remove-all']);assert.equal(result.results.length,0);clients.forEach((c,i)=>assert.equal(fs.readFileSync(c.config,'utf8'),before[i]));
 assert.ok(fs.existsSync(path.join(vault,'welcome.md')));console.log('PASS: packaged setup prepares mandatory global agent registration for seven clients; existing configs, trust and notes remain untouched');
}finally{fs.rmSync(root,{recursive:true,force:true});}
