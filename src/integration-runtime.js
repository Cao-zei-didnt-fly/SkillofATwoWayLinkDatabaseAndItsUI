import fs from 'node:fs';
import path from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';

export async function verifyMcp(manager){
 const config=manager.service,client=new Client({name:'link-garden-setup',version:'0.5.0'});
 const transport=new StdioClientTransport({command:config.command,args:config.args,env:config.env,stderr:'pipe'});transport.stderr?.on('data',()=>{});
 try{
  await client.connect(transport,{timeout:120000});const {tools}=await client.listTools({}, {timeout:60000});
  if(!['search_notes','read_note','catalog','create_note','update_note','delete_note','neighbors','link_notes','refresh_index'].every(name=>tools.some(tool=>tool.name===name)))throw Error('MCP 工具不完整');
  const response=await client.callTool({name:'catalog',arguments:{limit:1}},undefined,{timeout:120000});if(response.isError)throw Error('知识库无法读取，请检查目录权限');
  return {ok:true,toolCount:tools.length,checkedAt:new Date().toISOString(),message:'独立工具握手与只读检查通过；客户端加载状态待客户端确认。'};
 }finally{await client.close();}
}
export async function installAgents(manager,ids,{detectedOnly=true,verify=true}={}){
 const verification=verify?await verifyMcp(manager):null,results=[];
 for(const id of ids){try{const found=manager.list().find(c=>c.id===id);if(!found)throw Error('未知客户端');if(detectedOnly&&!found.detected){results.push({id,status:'missing',message:'未发现，未修改配置'});continue;}results.push(manager.install(id));}catch(error){results.push({id,status:'error',message:error.message});}}
 const report={at:new Date().toISOString(),verification,results};fs.mkdirSync(manager.stateDir,{recursive:true});fs.writeFileSync(path.join(manager.stateDir,'last-report.json'),JSON.stringify(report,null,2));return report;
}

// Default product flow: prepare instructions, never impersonate client trust or mutate its global config.
export function prepareAgents(manager,ids=manager.clients.map(c=>c.id)){
 const guide=manager.exportGuide(),clients=manager.list();
 const results=ids.map(id=>{const client=clients.find(c=>c.id===id);if(!client)throw Error('未知客户端');return {id,status:'awaiting-agent-registration',scope:'user-global',required:true,detected:client.detected,message:'必做：让该 Agent 读取注册指南，在用户级全局完成注册、信任核验和只读工具调用。'};});
 const report={at:new Date().toISOString(),registrationRequired:true,scope:'user-global',guide,verification:null,results};
 fs.mkdirSync(manager.stateDir,{recursive:true});fs.writeFileSync(path.join(manager.stateDir,'last-report.json'),JSON.stringify(report,null,2));return report;
}
