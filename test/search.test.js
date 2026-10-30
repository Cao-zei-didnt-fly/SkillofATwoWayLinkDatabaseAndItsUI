import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Store} from '../src/store.js';
function setup(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'garden-search-')),s=new Store(root);t.after(()=>{s.close();fs.rmSync(root,{recursive:true,force:true});});return s;}
test('Chinese full-body search returns original bounded excerpts and exact phrase evidence',t=>{
 const s=setup(t);s.execute({action:'create',id:'auth',title:'身份设计',tags:['安全'],body:'# 认证\n\n登录失败五次后锁定。\n使用 SQLite 全文索引。'});
 const result=s.execute({action:'search',query:'登录'});assert.equal(result.total,1);assert.equal(result.items[0].matches[0].line,3);assert.equal(result.items[0].matches[0].text,'登录失败五次后锁定。');assert.equal(result.items[0].body,undefined);
 assert.equal(s.execute({action:'search',query:'锁'}).total,1);assert.equal(s.execute({action:'search',query:'SQLITE 登录'}).total,1);
 assert.equal(s.execute({action:'search',query:'"登录失败"'}).total,1);assert.equal(s.execute({action:'search',query:'"登录锁定"'}).total,0);
 assert.equal(s.execute({action:'search',query:'登录 无此词',match:'all'}).total,0);assert.equal(s.execute({action:'search',query:'登录 无此词',match:'any'}).total,1);
 assert.equal(s.execute({action:'search',query:'登录',tag:'其他'}).total,0);assert.equal(s.execute({action:'search',query:'登录',tag:'安全'}).total,1);
 const read=s.execute({action:'read',id:'auth',startLine:3,maxLines:1,version:result.items[0].version});assert.equal(read.body,'登录失败五次后锁定。');assert.equal(read.next.startLine,4);
});
test('incremental indexing updates changed files, removes deleted files and reopens persistent index',t=>{
 const s=setup(t);for(let i=0;i<8;i++)s.execute({action:'create',id:'n'+i,title:'Note '+i,body:'原始内容'});
 const mtime=s.index.db.prepare('SELECT mtime FROM notes WHERE id=?').get('n1').mtime;
 fs.writeFileSync(s.file('n0'),'---\ntitle: 外部编辑\n---\n新增独特关键词');fs.unlinkSync(s.file('n7'));
 s.execute({action:'reindex'});assert.equal(s.execute({action:'search',query:'独特关键词'}).items[0].id,'n0');assert.equal(s.execute({action:'catalog'}).total,7);
 assert.equal(s.index.db.prepare('SELECT mtime FROM notes WHERE id=?').get('n1').mtime,mtime);
 const other=new Store(s.root);try{assert.equal(other.execute({action:'search',query:'独特'}).total,1);}finally{other.close();}
});
test('optimistic versions protect writes and reads after external changes',t=>{
 const s=setup(t);const n=s.execute({action:'create',id:'a',title:'A',body:'before'});
 s.execute({action:'update',id:'a',body:'after',version:n.version});assert.throws(()=>s.execute({action:'update',id:'a',body:'lost',version:n.version}),/changed/);
 const latest=s.execute({action:'read',id:'a'});fs.writeFileSync(s.file('a'),'---\ntitle: A\n---\nexternal edit');assert.throws(()=>s.execute({action:'read',id:'a',version:latest.version}),/changed/);
});
test('pagination, tag discovery and long-line continuations stay bounded',t=>{
 const s=setup(t);for(let i=0;i<6;i++)s.execute({action:'create',id:'n'+i,title:'笔记'+i,tags:['标签'+i],body:'长'.repeat(100)});
 const page=s.execute({action:'search',query:'长',limit:2,offset:2});assert.equal(page.total,6);assert.equal(page.items.length,2);
 const catalog=s.execute({action:'catalog',limit:2});assert.equal(catalog.tags.length,2);assert.equal(catalog.tagTotal,6);assert.equal(s.execute({action:'catalog',query:'标签3'}).tags[0].name,'标签3');
 let next={startLine:1},text='';do{const part=s.execute({action:'read',id:'n0',maxChars:17,...next});assert.ok(part.body.length<=17);text+=part.body;next=part.next;}while(next);assert.equal(text,'长'.repeat(100));
});
test('malformed Markdown is reported without making healthy notes unavailable',t=>{
 const s=setup(t);s.execute({action:'create',id:'good',title:'Good',body:'仍然可检索'});
 fs.writeFileSync(s.file('broken'),'---\ntitle: [unterminated\n---\nbad');s.execute({action:'reindex'});
 assert.equal(s.execute({action:'search',query:'可检索'}).total,1);assert.equal(s.execute({action:'catalog'}).indexErrorTotal,1);
 fs.unlinkSync(s.file('broken'));s.execute({action:'reindex'});assert.equal(s.execute({action:'catalog'}).indexErrorTotal,0);
});
