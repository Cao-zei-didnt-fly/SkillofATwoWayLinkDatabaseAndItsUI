import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'garden-packaged-mcp-'));
const clients=[];
try{
 for(let i=0;i<2;i++){
  const client=new Client({name:'packaged-test-'+i,version:'1.0'}),transport=new StdioClientTransport({command:path.resolve('dist/win-unpacked/Link Garden.exe'),args:[path.resolve('dist/win-unpacked/resources/app.asar/src/mcp-entry.js'),'--vault',root],env:{ELECTRON_RUN_AS_NODE:'1'},stderr:'inherit'});
  transport.stderr?.on('data',chunk=>process.stderr.write(chunk));await client.connect(transport);clients.push(client);
 }
 const call=async(client,name,args={})=>{const response=await client.callTool({name,arguments:args});assert.ok(!response.isError,response.content?.[0]?.text);return response.structuredContent;};
 assert.equal((await clients[0].listTools()).tools.length,9);
 const note=await call(clients[0],'create_note',{id:'shared',title:'打包版本验证',body:'第一行\n中文检索来自正文\n第三行',tags:['验证']});
 await call(clients[1],'refresh_index');const results=await call(clients[1],'search_notes',{query:'中文检索'});assert.equal(results.items[0].id,'shared');assert.equal(results.items[0].matches[0].line,2);
 assert.equal((await call(clients[1],'read_note',{id:'shared',version:note.version,startLine:2,maxLines:1})).body,'中文检索来自正文');
 await call(clients[1],'update_note',{id:'shared',version:note.version,status:'已完成'});
 const conflict=await clients[0].callTool({name:'update_note',arguments:{id:'shared',version:note.version,body:'old version'}});assert.equal(conflict.isError,true);
 console.log('PASS: packaged exe serves MCP without Node.js; two clients share full-text index and reject stale writes');
}finally{for(const client of clients)await client.close();fs.rmSync(root,{recursive:true,force:true});}
