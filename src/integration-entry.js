import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {AgentManager} from './agents.js';
import storage from './paths.cjs';
import {prepareAgents} from './integration-runtime.js';

const args=process.argv.slice(2),value=key=>{const at=args.indexOf(key);return at>=0?args[at+1]:undefined;};
const home=value('--home')||os.homedir(),appData=value('--app-data')||process.env.APPDATA||path.join(home,'AppData/Roaming');
const bundle=path.resolve(fileURLToPath(new URL('..',import.meta.url))),resources=path.dirname(bundle);
const layout=storage.localLayout({root:bundle.endsWith('.asar')?path.dirname(resources):bundle,appData,env:{...process.env,...(value('--data-dir')?{LINK_GARDEN_DATA_DIR:value('--data-dir')} : {}),...(value('--vault')?{LINK_GARDEN_VAULT:value('--vault')}: {})}});
if(!args.includes('--remove-all'))storage.prepareLocalData(layout);
const stateDir=value('--state-dir')||layout.integrations;
const executable=value('--executable')||process.execPath;
const skill=value('--skill')||(bundle.endsWith('.asar')?path.join(resources,'skills/link-garden'):path.join(bundle,'skills/link-garden'));
const manager=new AgentManager({home,appData,localAppData:value('--local-app-data')||process.env.LOCALAPPDATA,codexHome:value('--home')?path.join(home,'.codex'):process.env.CODEX_HOME,executable,entry:path.join(bundle,'src/mcp-entry.js'),vault:layout.vault,skill,stateDir});
try{
 if(args.includes('--remove-all')){
  const results=[];for(const id of Object.keys(manager.state().clients)){try{results.push(manager.remove(id));}catch(error){results.push({id,status:'error',message:error.message});}}
  const failed=results.some(r=>['error','preserved'].includes(r.status));fs.mkdirSync(stateDir,{recursive:true});fs.writeFileSync(path.join(stateDir,'uninstall-report.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({results}));if(failed)process.exitCode=2;
 }else{
  const seed=bundle.endsWith('.asar')?path.join(resources,'vault'):path.join(bundle,'vault');if(!fs.existsSync(manager.options.vault)&&fs.existsSync(seed))fs.cpSync(seed,manager.options.vault,{recursive:true});
  const guide=manager.exportGuide();const ids=(value('--clients')??manager.clients.map(c=>c.id).join(',')).split(',').filter(Boolean);
  const report=prepareAgents(manager,ids);console.log(JSON.stringify({...report,guidePath:guide.path}));if(report.results.some(r=>r.status==='error'))process.exitCode=2;
 }
}catch(error){fs.mkdirSync(stateDir,{recursive:true});fs.writeFileSync(path.join(stateDir,'last-error.txt'),error.message);console.error(error.message);process.exitCode=1;}
