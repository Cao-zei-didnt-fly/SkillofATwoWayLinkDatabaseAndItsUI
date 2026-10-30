import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {parse as parseToml} from 'smol-toml';
import {parse as parseJson,modify,applyEdits} from 'jsonc-parser';
import {connectionConfig} from './connection.js';

const KEY='link_garden';
const BEGIN='# BEGIN LINK GARDEN MANAGED MCP';
const END='# END LINK GARDEN MANAGED MCP';
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));return value;}
function read(file){if(!fs.existsSync(file))return null;if(fs.lstatSync(file).isSymbolicLink())throw Error('配置或技能文件是符号链接，请使用手动接入指南');return fs.readFileSync(file,'utf8');}
function atomic(file,text,expected){
 fs.mkdirSync(path.dirname(file),{recursive:true});if(read(file)!==expected)throw Error('文件已被其他进程修改，请刷新后重试');
 const temp=file+'.'+crypto.randomUUID()+'.tmp';
 try{fs.writeFileSync(temp,text,{flag:'wx',mode:0o600});if(read(file)!==expected)throw Error('文件已被其他进程修改，请刷新后重试');fs.renameSync(temp,file);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
}
function jsonDocument(text){const errors=[];const data=parseJson((text||'{}').replace(/^\uFEFF/,''),errors,{allowTrailingComma:true});if(errors.length||!data||typeof data!=='object'||Array.isArray(data))throw Error('现有 JSON/JSONC 配置无法解析，请先修复配置');return data;}
function document(text,format){if(format==='toml'){try{return parseToml((text||'').replace(/^\uFEFF/,''));}catch{throw Error('现有 TOML 配置无法解析，请先修复配置');}}return jsonDocument(text);}

export function adapters({home=os.homedir(),appData=process.env.APPDATA||path.join(home,'AppData/Roaming'),localAppData=process.env.LOCALAPPDATA||path.join(home,'AppData/Local'),codexHome=process.env.CODEX_HOME||path.join(home,'.codex')}={}){
 const sharedSkill=path.join(home,'.agents/skills/link-garden');
 const legacy=path.join(codexHome,'skills/link-garden');
 return [
  {id:'codex',name:'Codex',format:'toml',section:'mcp_servers',config:path.join(codexHome,'config.toml'),evidence:[codexHome],skill:fs.existsSync(legacy)?legacy:sharedSkill,note:'用户级配置；重载 MCP 或开启新会话后使用。'},
  {id:'workbuddy',name:'WorkBuddy',section:'mcpServers',config:path.join(home,'.workbuddy/mcp.json'),evidence:[path.join(home,'.workbuddy')],skill:path.join(home,'.workbuddy/skills/link-garden'),note:'WorkBuddy 用户级配置，不改动 CodeBuddy 配置。'},
  {id:'codebuddy',name:'CodeBuddy / CodeBuddy Code',section:'mcpServers',config:path.join(home,'.codebuddy/mcp.json'),evidence:[path.join(home,'.codebuddy')],skill:path.join(home,'.codebuddy/skills/link-garden'),note:'用户级全局 MCP；由 Agent 使用 --scope user 注册，并在 /mcp 或客户端工具管理中确认信任。'},
  {id:'cursor',name:'Cursor',section:'mcpServers',config:path.join(home,'.cursor/mcp.json'),evidence:[path.join(home,'.cursor'),path.join(localAppData,'Programs/cursor/Cursor.exe')],skill:sharedSkill,note:'注册本地全局工具；远程及云端会话需单独配置。'},
  {id:'claude-desktop',name:'Claude Desktop',section:'mcpServers',config:path.join(appData,'Claude/claude_desktop_config.json'),evidence:[path.join(appData,'Claude')],note:'本地 Desktop MCP；不等同于云端连接器或 Cowork。使用说明由 MCP 提供。'},
  {id:'vscode',name:'VS Code / Copilot',section:'servers',config:path.join(appData,'Code/User/mcp.json'),evidence:[path.join(appData,'Code/User'),path.join(localAppData,'Programs/Microsoft VS Code/Code.exe')],skill:sharedSkill,note:'默认本地用户配置；自定义 Profile、Insiders、远程环境请使用注册指南。'},
  {id:'cline',name:'Cline（VS Code）',section:'mcpServers',config:path.join(appData,'Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json'),evidence:[path.join(appData,'Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json')],note:'仅自动处理已存在的扩展 MCP 文件；其他 Cline 宿主或版本请使用注册指南。'}
 ];
}

export class AgentManager {
 constructor(options){
  this.options=options;this.clients=adapters(options);this.stateDir=path.resolve(options.stateDir);this.stateFile=path.join(this.stateDir,'agents.json');
  this.config=connectionConfig(options);this.service=JSON.parse(this.config.workbuddy).mcpServers[KEY];this.skillSource=path.join(options.skill,'SKILL.md');
 }
 state(){const text=read(this.stateFile);if(!text)return {version:1,clients:{}};const state=JSON.parse(text);if(state.version!==1||!state.clients)throw Error('接入管理记录无法识别，请保留记录并联系维护者');return state;}
 lock(fn){fs.mkdirSync(this.stateDir,{recursive:true});const file=path.join(this.stateDir,'agents.lock');let fd;try{fd=fs.openSync(file,'wx');}catch{throw Error('接入管理正在执行其他操作，请稍后重试');}try{return fn();}finally{fs.closeSync(fd);fs.unlinkSync(file);}}
 client(id){const client=this.clients.find(c=>c.id===id);if(!client)throw Error('尚未适配该客户端，请使用 REGISTER-MCP.md');return client;}
 expected(client){return client.format==='toml'?{...this.service,startup_timeout_sec:120,tool_timeout_sec:60}:['vscode','codebuddy'].includes(client.id)?{type:'stdio',...this.service}:this.service;}
 inspect(client,state=this.state()){
  const detected=client.evidence.some(file=>fs.existsSync(file)),owned=state.clients[client.id];let status='missing',message='未发现本地配置；可将注册指南交给此 agent。';
  try{const text=read(client.config),data=document(text,client.format),current=data[client.section]?.[KEY];
   if(current!==undefined){if(owned&&same(current,owned.service)&&client.config===owned.config){status=same(current,this.expected(client))?'registered':'outdated';message=status==='registered'?'已注册；客户端是否已加载需在客户端确认。':'安装位置或库路径已变化，可以修复。';}else if(same({command:current.command,args:current.args,env:current.env},{command:this.service.command,args:this.service.args,env:this.service.env})){status='external-pending';message='Agent 或用户已配置该服务；仍需在客户端完成全局作用域、信任与只读调用核验。';}else{status='conflict';message='已有同名配置或配置已被用户修改，保留它并让 Agent 核对全局配置。';}}
   else if(detected){status='available';message='发现配置目录或程序，可关联；不代表客户端当前正在运行。';}
   if(status==='registered'&&client.skill){const record=owned?.skills?.find(s=>s.file===path.join(client.skill,'SKILL.md'));const value=read(path.join(client.skill,'SKILL.md'));if(!record||value===null||hash(value)!==record.hash){status='modified';message='配置已注册，但技能缺失或已修改，请检查后修复。';}}
  }catch(error){status='error';message=error.message;}
  return {id:client.id,name:client.name,config:client.config,skill:client.skill,detected,managed:!!owned,registrationRequired:true,status,message,note:client.note};
 }
 list(){const state=this.state();return this.clients.map(c=>this.inspect(c,state));}
 tomlBlock(text){const start=text.indexOf(BEGIN),end=text.indexOf(END);if(start<0||end<start||text.indexOf(BEGIN,start+1)>=0)throw Error('找不到唯一的受管理配置块，请使用手动指南');return {start,end:end+END.length,text:text.slice(start,end+END.length)};}
 patched(client,text,service,owned){
  if(client.format==='toml'){
   const block=BEGIN+'\n'+this.config.codex.trim()+'\n'+END;
   if(owned){const previous=this.tomlBlock(text);if(hash(previous.text)!==owned.blockHash)throw Error('受管理 TOML 块已被修改，保留现有配置');return {text:text.slice(0,previous.start)+(service?block:'')+text.slice(previous.end),blockHash:service?hash(block):undefined};}
   return {text:(text||'').trimEnd()+'\n\n'+block+'\n',blockHash:hash(block)};
  }
  const base=(text||'{}\n').replace(/^\uFEFF/,'');return {text:applyEdits(base,modify(base,[client.section,KEY],service,{formattingOptions:{insertSpaces:true,tabSize:2,eol:base.includes('\r\n')?'\r\n':'\n'}}))};
 }
 commit(changes,nextState){
  const applied=[];const previousState=read(this.stateFile);
  try{
   for(const change of changes){if(change.before===change.after)continue;
    if(change.before!==null){fs.mkdirSync(path.join(this.stateDir,'backups'),{recursive:true});fs.writeFileSync(path.join(this.stateDir,'backups',Date.now()+'-'+crypto.randomUUID()+'.bak'),change.before,{mode:0o600});}
    if(change.after===null){if(read(change.file)!==change.before)throw Error('文件已变化，取消清理');fs.unlinkSync(change.file);}else atomic(change.file,change.after,change.before);
    applied.push(change);
   }
   atomic(this.stateFile,JSON.stringify(nextState,null,2)+'\n',previousState);
  }catch(error){
   let rollbackFailed=false;for(const change of applied.reverse()){try{if(read(change.file)!==change.after){rollbackFailed=true;continue;}if(change.before===null)fs.unlinkSync(change.file);else atomic(change.file,change.before,change.after);}catch{rollbackFailed=true;}}
   throw Error(error.message+(rollbackFailed?'；部分文件已被其他进程改动，未覆盖，请检查备份。':'；本次变更已回滚。'));
  }
 }
 install(id){return this.lock(()=>{
  const client=this.client(id),state=this.state(),inspection=this.inspect(client,state);if(!inspection.detected)throw Error('未发现该客户端，请使用注册指南或先安装客户端');
  if(['conflict','error'].includes(inspection.status))throw Error(inspection.message);
  const before=read(client.config),data=document(before,client.format),current=data[client.section]?.[KEY],owned=state.clients[id];
  if(current!==undefined&&(!owned||!same(current,owned.service)))throw Error('已有同名 MCP 配置，保留现有设置');
  const service=this.expected(client),patch=this.patched(client,before,service,current===undefined?null:owned),changes=[{file:client.config,before,after:patch.text}],skills=[];
  const parsedPatch=document(patch.text,client.format);if(!same(parsedPatch[client.section]?.[KEY],service))throw Error('合并配置验证失败，未修改文件');
  if(client.skill){
   const file=path.join(client.skill,'SKILL.md'),existing=read(file),content=fs.readFileSync(this.skillSource,'utf8');
   const owners=Object.values(state.clients).flatMap(entry=>entry.skills||[]).filter(record=>record.file===file);
   if(existing!==null&&!owners.some(record=>hash(existing)===record.hash))throw Error('已有同名 skill 或用户已修改 skill，自动关联会保留它');
   changes.push({file,before:existing,after:content});skills.push({file,hash:hash(content)});
  }
  const next=structuredClone(state);next.clients[id]={config:client.config,service,skills,blockHash:patch.blockHash,updated:new Date().toISOString()};
  // A shared .agents skill has several consumers; update all ownership hashes together.
  for(const record of Object.values(next.clients))for(const skill of record.skills||[]){const replacement=skills.find(s=>s.file===skill.file);if(replacement)skill.hash=replacement.hash;}
  this.commit(changes,next);return {id,status:'registered',message:'已写入 MCP'+(client.skill?' 与 skill':'（使用说明由 MCP 提供）')+'；请在客户端重载或新开会话。'};
 });}
 remove(id){return this.lock(()=>{
  const client=this.client(id),state=this.state(),owned=state.clients[id];if(!owned)return {id,status:'not-managed',message:'没有本产品的接入记录，未修改任何配置'};
  const next=structuredClone(state),changes=[],preserved=[];delete next.clients[id];
  const before=read(owned.config),data=document(before,client.format),current=data[client.section]?.[KEY];
  if(current!==undefined){if(same(current,owned.service)){try{const patch=this.patched(client,before,undefined,owned);changes.push({file:owned.config,before,after:patch.text});}catch{preserved.push(owned.config);}}else preserved.push(owned.config);}
  for(const record of owned.skills||[]){if(Object.values(next.clients).some(entry=>(entry.skills||[]).some(s=>s.file===record.file)))continue;const value=read(record.file);if(value!==null){if(hash(value)===record.hash)changes.push({file:record.file,before:value,after:null});else preserved.push(record.file);}}
  if(preserved.length){next.clients[id]={...owned,preserved:true};}
  this.commit(changes,next);return {id,status:preserved.length?'preserved':'removed',preserved,message:preserved.length?'保留了用户修改过的内容；详情已记录，需手动检查。':'已解除本产品的关联，其他配置及笔记保留。'};
 });}
 exportGuide(){
  fs.mkdirSync(this.stateDir,{recursive:true});const file=path.join(this.stateDir,'REGISTER-MCP.md');
  const rows=this.clients.map(c=>`| ${c.name} | \`${c.config}\` |`).join('\n');
  const text=`# 必做：由 Agent 在当前用户全局注册并核验 Link Garden

这是每个客户端都必须完成的接入步骤，不是自动注册失败后的可选回退。全局指当前用户的所有项目，不是所有 Windows 账户。安装器仅准备本说明，不再默认修改 Agent 配置或替你写入信任设置。

## 实际路径

- 知识库：\`${this.options.vault}\`
- Skill：\`${this.skillSource}\`
- 服务键：\`link_garden\`

## 通用 stdio 配置

\`\`\`json
${this.config.workbuddy}
\`\`\`

## Codex 全局 TOML

\`\`\`toml
${this.config.codex}\`\`\`

## 客户端用户级全局文件

| 客户端 | 默认路径 |
|---|---|
${rows}

VS Code/Copilot 使用 servers 顶层并添加 type: stdio；自定义 Profile/远程环境须查官方文档，不在任意项目创建配置代替全局配置。

## 必须执行的步骤

1. 确认当前客户端、版本、用户，使用其原生全局注册接口；没有原生接口时备份并局部合并上表对应用户级配置。明确选择 user/global，不能仅注册到当前工作区。若已存在 Link Garden 条目，比较程序、args、env 与知识库路径；相同则复用并继续核验，不重复添加。不同则报告冲突，保留其他服务、注释和凭证。还应检查同名项目级配置是否遮蔽全局配置，不能自动删除其他项目配置。
2. command、args、env 必须完整保留，尤其 ELECTRON_RUN_AS_NODE=1。无需安装 Node.js，不设置开机启动、不向局域网开端口。
3. 如支持本地 skill，按该客户端规范加载上述 SKILL.md；否则遵循 MCP 初始化的先搜索、再按需读取规则。
4. 在客户端刷新 MCP/新开会话。若提示不受信任、MCP 被禁用或进程/目录访问被拒，向用户准确报告所需的授权，只通过客户端自身的信任/安全界面完成。不得伪造信任记录、跳过授权、全局关闭沙箱或把所有 MCP 工具自动放行。用户确认仍是客户端要求时的必要步骤，Agent 自己注册不能保证自动获得信任。
5. 在当前客户端实际查看 tools/list，确认 search_notes、read_note、catalog，再只读调用 catalog 或 search_notes。分别报告：全局配置位置、客户端信任状态、握手结果、实际工具调用结果；没有证据时标记待确认，不得声称成功。独立诊断通过不等于客户端已经授权。
6. 没有本机文件/注册权限或不支持本地 stdio MCP 时，说明限制和需要用户操作的准确位置；此时不能声称已注册。

## WorkBuddy 专项

使用 ~/.workbuddy/mcp.json 的当前用户全局配置。注册后在连接器/MCP 管理与安全中心确认 Link Garden 服务已启用且受信任；自定义 MCP 总开关、单服务/工具开关都可能阻止调用。遇到工作区信任提示应按客户端提示由用户确认，并在生效后新开会话。不要把改为全局作用域当成可以绕过客户端授权。

## CodeBuddy / CodeBuddy Code 专项

用户全局配置是 ~/.codebuddy/mcp.json，区别于 WorkBuddy。优先使用其原生 codebuddy mcp add-json --scope user 注册能力，服务对象含 type: stdio、command、args、env（内容见上面的通用配置，按执行环境安全传参，不要将路径直接拼接成 shell 代码）。使用 codebuddy mcp list / codebuddy mcp get link_garden 或 /mcp 检查作用域、连接和工具权限。需要用户确认时停在该客户端授权流程，不改写全局 permissions 来掩盖失败。

官方说明：
- https://www.codebuddy.cn/docs/cli/mcp
- https://www.codebuddy.cn/docs/cli/codebuddy-dir
- https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Permission-Modes

## 升级与移除

Agent 直接注册的条目由用户和客户端管理，安装器不会擅自认领或卸载它。程序路径或知识库变化时重新执行本步骤。0.3 版本预写过的配置可在应用解除旧关联，但不能因此删除新接入的客户端信任或其他服务。
`;
  const before=read(file);if(before!==text){try{atomic(file,text,before);}catch(error){if(error.code!=='EXDEV')throw error;if(read(file)!==before)throw Error('注册指南已变化，请重试');fs.writeFileSync(file,text,{mode:0o600});}}return {path:file,required:true,scope:'user-global',prompt:`请读取本机文件 ${file}，必须由你在当前客户端的用户级全局（所有项目）注册或核验 Link Garden MCP，不要只注册到当前工作区。保留其他配置；在客户端完成信任/权限检查并实际执行 catalog 或搜索。请分别报告全局配置路径、信任状态、握手和工具调用结果；需要我确认授权时准确指出位置，不要绕过安全设置或声称已成功。`};
 }
}
