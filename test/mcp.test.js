import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
test('MCP client discovers tools, searches body, reads ranges and checks write versions',{timeout:20000},async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'garden-mcp-'));
 const transport=new StdioClientTransport({command:process.execPath,args:['src/mcp-entry.js','--vault',root],stderr:'pipe'});
 const client=new Client({name:'integration-test',version:'1.0'});
 try{await client.connect(transport);const tools=await client.listTools();assert.equal(tools.tools.length,9);
  const call=async(name,args={})=>{const result=await client.callTool({name,arguments:args});if(result.isError)throw Error(result.content[0].text);return result.structuredContent;};
  const a=await call('create_note',{id:'a',title:'登录策略',body:'第一行\n第二行登录失败\n第三行'});assert.equal(a.body,undefined);
  const results=await call('search_notes',{query:'失败'});assert.equal(results.items[0].matches[0].line,2);
  const read=await call('read_note',{id:'a',version:a.version,startLine:2,maxLines:1});assert.equal(read.body,'第二行登录失败');
  await call('update_note',{id:'a',version:a.version,status:'已完成'});
  const conflict=await client.callTool({name:'update_note',arguments:{id:'a',version:a.version,body:'overwrite'}});assert.equal(conflict.isError,true);
  assert.equal((await call('catalog')).total,1);
  const c=await call('create_note',{id:'c',title:'C',body:'指向 [[d|D 笔记]]'});const d=await call('create_note',{id:'d',title:'D'});
  const deleted=await call('delete_note',{id:'d',version:d.version});assert.equal(deleted.id,'d');assert.equal(deleted.removedLinks,1);
  const cleaned=await call('read_note',{id:'c'});assert.equal(cleaned.body,'指向 D 笔记');
 }finally{await client.close();fs.rmSync(root,{recursive:true,force:true});}
});
