import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parse as parseToml} from 'smol-toml';
import {parse as parseJson} from 'jsonc-parser';
import {AgentManager} from '../src/agents.js';
import {installAgents,verifyMcp,prepareAgents} from '../src/integration-runtime.js';

function setup(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'garden-agents-')),home=path.join(root,'用户 空格'),skill=path.join(root,'source-skill');fs.mkdirSync(skill,{recursive:true});fs.writeFileSync(path.join(skill,'SKILL.md'),'---\nname: link-garden\ndescription: Test skill\n---\nSearch before reading.\n');
 const options={home,codexHome:path.join(home,'.codex'),appData:path.join(home,'AppData/Roaming'),localAppData:path.join(home,'AppData/Local'),executable:path.join(root,'程序 空格/Link Garden.exe'),vault:path.join(root,'笔记 库'),skill,stateDir:path.join(root,'state')};
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return {root,home,options,manager:new AgentManager(options)};
}
function enable(client){fs.mkdirSync(path.dirname(client.config),{recursive:true});if(client.id==='cline')fs.writeFileSync(client.config,'{"mcpServers":{"other":{"command":"other.exe"}}}');}
test('seven adapters merge configurations, preserve unrelated content and install idempotently',t=>{
 const {manager}=setup(t);assert.equal(manager.list().length,7);
 for(const client of manager.clients){enable(client);if(client.id==='codex')fs.writeFileSync(client.config,'# Keep this comment\nmodel = "existing"\n[mcp_servers.other]\ncommand = "other.exe"\n');else if(client.id==='vscode')fs.writeFileSync(client.config,'{\n // Keep this comment\n "servers": {"other":{"command":"other.exe"}},\n "inputs": []\n}\n');}
 for(const client of manager.clients){manager.install(client.id);const before=fs.readFileSync(client.config,'utf8');manager.install(client.id);assert.equal(fs.readFileSync(client.config,'utf8'),before);const parsed=client.format==='toml'?parseToml(before):parseJson(before);assert.equal(parsed[client.section].link_garden.command,manager.service.command);if(client.id==='codex'||client.id==='vscode'){assert.equal(parsed[client.section].other.command,'other.exe');assert.match(before,/Keep this comment/);}}
 assert.ok(manager.list().every(c=>c.status==='registered'));
 const shared=path.join(manager.options.home,'.agents/skills/link-garden/SKILL.md');manager.remove('codex');assert.ok(fs.existsSync(shared));manager.remove('cursor');assert.ok(fs.existsSync(shared));manager.remove('vscode');assert.ok(!fs.existsSync(shared));
});
test('unknown, missing, malformed or conflicting clients are not overwritten',t=>{
 const {manager}=setup(t),codex=manager.client('codex');assert.throws(()=>manager.install('codex'),/未发现/);assert.throws(()=>manager.install('unknown'),/尚未适配/);
 enable(codex);const foreign='[mcp_servers.link_garden]\ncommand="foreign.exe"\n';fs.writeFileSync(codex.config,foreign);assert.throws(()=>manager.install('codex'),/同名/);assert.equal(fs.readFileSync(codex.config,'utf8'),foreign);
 const wb=manager.client('workbuddy');enable(wb);fs.writeFileSync(wb.config,'{broken');assert.throws(()=>manager.install('workbuddy'),/无法解析/);assert.equal(fs.readFileSync(wb.config,'utf8'),'{broken');
});
test('upgrades replace only owned settings, and removal preserves user modifications',t=>{
 const {manager,options}=setup(t),client=manager.client('codex');enable(client);manager.install('codex');
 const next=new AgentManager({...options,executable:path.join(options.home,'新目录/Link Garden.exe')});assert.equal(next.inspect(next.client('codex')).status,'outdated');next.install('codex');assert.equal(parseToml(fs.readFileSync(client.config,'utf8')).mcp_servers.link_garden.command,next.service.command);
 const edited=fs.readFileSync(client.config,'utf8').replace('tool_timeout_sec = 60','tool_timeout_sec = 90');fs.writeFileSync(client.config,edited);assert.equal(next.remove('codex').status,'preserved');assert.equal(fs.readFileSync(client.config,'utf8'),edited);
});
test('skill conflicts roll back without writing an MCP config; unrelated later edits survive removal',t=>{
 const {manager}=setup(t),client=manager.client('workbuddy');enable(client);fs.mkdirSync(client.skill,{recursive:true});fs.writeFileSync(path.join(client.skill,'SKILL.md'),'User-owned skill');assert.throws(()=>manager.install(client.id),/skill/);assert.ok(!fs.existsSync(client.config));
 fs.unlinkSync(path.join(client.skill,'SKILL.md'));manager.install(client.id);const data=parseJson(fs.readFileSync(client.config,'utf8'));data.mcpServers.other={command:'keep.exe'};fs.writeFileSync(client.config,JSON.stringify(data));manager.remove(client.id);assert.equal(parseJson(fs.readFileSync(client.config,'utf8')).mcpServers.other.command,'keep.exe');
});
test('unsupported-client guide has expanded local paths and a usable self-registration prompt',t=>{
 const {manager}=setup(t);const guide=manager.exportGuide(),text=fs.readFileSync(guide.path,'utf8');assert.match(text,/ELECTRON_RUN_AS_NODE/);assert.ok(text.includes(manager.options.vault));assert.match(text,/没有本机文件/);assert.ok(guide.prompt.includes(guide.path));assert.ok(manager.list().every(c=>c.status==='missing'));
});
test('a failed multi-file commit rolls back earlier writes',t=>{
 const {manager,root}=setup(t),first=path.join(root,'config.json'),blocker=path.join(root,'not-a-directory');fs.writeFileSync(blocker,'keep');
 assert.throws(()=>manager.commit([{file:first,before:null,after:'{}'},{file:path.join(blocker,'skill.md'),before:null,after:'x'}],{version:1,clients:{}}),/回滚/);assert.ok(!fs.existsSync(first));assert.equal(fs.readFileSync(blocker,'utf8'),'keep');
});
test('setup checks the actual MCP runtime and registers only detected clients',{timeout:20000},async t=>{
 const {options}=setup(t),manager=new AgentManager({...options,executable:process.execPath,entry:path.resolve('src/mcp-entry.js')});enable(manager.client('codex'));
 const result=await installAgents(manager,['codex','cursor']);assert.equal(result.verification.toolCount,8);assert.equal(result.results[0].status,'registered');assert.equal(result.results[1].status,'missing');
 assert.ok(!fs.existsSync(manager.client('cursor').config));assert.equal((await verifyMcp(manager)).ok,true);
});

test('default setup requires agent global registration and does not modify client files',t=>{
 const {manager}=setup(t);for(const client of manager.clients)enable(client);
 const before=new Map(manager.clients.map(c=>[c.config,fs.existsSync(c.config)?fs.readFileSync(c.config,'utf8'):null]));
 const result=prepareAgents(manager);assert.equal(result.registrationRequired,true);assert.equal(result.scope,'user-global');assert.equal(result.guide.required,true);assert.equal(result.results.length,7);
 for(const client of manager.clients)assert.equal(fs.existsSync(client.config)?fs.readFileSync(client.config,'utf8'):null,before.get(client.config));
 const guide=fs.readFileSync(result.guide.path,'utf8');assert.match(guide,/--scope user/);assert.match(guide,/不能仅注册到当前工作区/);assert.match(guide,/不得伪造信任/);assert.match(guide,/WorkBuddy 专项/);assert.match(guide,/CodeBuddy/);
 const cb=manager.client('codebuddy');assert.ok(cb.config.endsWith(path.join('.codebuddy','mcp.json')));
});
test('generated registration guide recovers from EXDEV without weakening client-config writes',t=>{
 const {manager}=setup(t);const guide=manager.exportGuide();fs.writeFileSync(guide.path,'old generated guide');
 const rename=fs.renameSync;try{fs.renameSync=(from,to)=>{if(to===guide.path){const error=Error('cross-device');error.code='EXDEV';throw error;}return rename(from,to);};assert.equal(manager.exportGuide().required,true);}finally{fs.renameSync=rename;}
 assert.match(fs.readFileSync(guide.path,'utf8'),/必须执行的步骤/);assert.ok(manager.clients.every(c=>!fs.existsSync(c.config)));
});
