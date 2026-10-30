import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import matter from 'gray-matter';
import { marked, Marked } from 'marked';
import sanitize from 'sanitize-html';
import { NoteIndex, bounded } from './index.js';

function links(body) {
 const result=[];
 const walk=tokens=>{for(const token of tokens){
  if(['code','codespan','html'].includes(token.type))continue;
  if(token.tokens)walk(token.tokens);
  else if(token.type==='text')for(const m of token.text.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g))result.push(m[1].trim());
  if(token.items)for(const item of token.items)walk(item.tokens);
  if(token.type==='table')for(const row of [token.header,...token.rows])for(const cell of row)walk(cell.tokens);
 }};
 walk(marked.lexer(body));return [...new Set(result)];
}
export class Store {
 constructor(root){this.root=path.resolve(root);fs.mkdirSync(this.root,{recursive:true});this.index=new NoteIndex(this.root,links);}
 close(){this.index.close();}
 file(id){if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(id))throw Error('Invalid note id');return path.join(this.root,id+'.md');}
 list(){this.index.sync();return this.index.db.prepare('SELECT id,title,category,status,tags,version FROM notes ORDER BY title,id').all().map(row=>this.index.metadata(row));}
 resolve(notes,ref){const exact=notes.find(n=>n.id===ref);if(exact)return exact;const hits=notes.filter(n=>n.title===ref);if(hits.length>1)throw Error('Ambiguous title; use note id: '+ref);return hits[0];}
 graph(op={}){
  this.index.sync();const limit=bounded(op.limit,1000,5000),page=this.index.search({...op,query:op.query||'',offset:0,limit:Math.min(100,limit)});
  let nodes=page.items;
  for(let offset=100;offset<Math.min(page.total,limit);offset+=100)nodes.push(...this.index.search({...op,offset,limit:Math.min(100,limit-offset)}).items);
  nodes=nodes.slice(0,limit).map(({matches,score,matchedFields,...meta})=>meta);
  const ids=new Set(nodes.map(n=>n.id)),edges=[],unresolved=[];
  if(ids.size){const placeholders=nodes.map(()=>'?').join(',');for(const row of this.index.db.prepare(`SELECT * FROM edges WHERE source IN (${placeholders})`).all(...ids)){
   if(row.target){if(ids.has(row.target))edges.push({source:row.source,target:row.target});}
   else unresolved.push({source:row.source,ref:row.ref});
  }}
  return {nodes,edges,unresolved,total:page.total,truncated:page.total>limit};
 }
 neighbors(id,op={}){
  const row=this.index.resolve(id);if(!row)throw Error('Note not found');
  const limit=bounded(op.limit,50,200),offset=Number.isInteger(op.offset)&&op.offset>=0?op.offset:0;
  const rows=this.index.db.prepare('SELECT * FROM edges WHERE source=? OR target=? ORDER BY source,ref LIMIT ? OFFSET ?').all(row.id,row.id,limit,offset);
  const total=this.index.db.prepare('SELECT count(*) AS n FROM edges WHERE source=? OR target=?').get(row.id,row.id).n;
  return {id:row.id,items:rows.map(e=>({direction:e.source===row.id?'outgoing':'incoming',source:e.source,target:e.target,ref:e.ref})),total,offset,limit};
 }
 get(id,op={ui:true}){
  this.index.sync();let row=this.index.resolve(id);if(!row)throw Error('Note not found');
  this.index.refreshId(row.id);row=this.index.resolve(id);if(!row)throw Error('Note not found');
  if(op.version&&op.version!==row.version)throw Error('Document changed; search or read again');
  const fullLines=row.body.split('\n'),start=bounded(op.startLine,1,Math.max(1,fullLines.length)),max=op.ui?fullLines.length:bounded(op.maxLines,200,1000);
  if(start>fullLines.length)throw Error('startLine exceeds document length');
  const column=Number.isInteger(op.startColumn)&&op.startColumn>=0?op.startColumn:0;
  if(column>fullLines[start-1].length)throw Error('startColumn exceeds line length');
  let end=Math.min(fullLines.length,start-1+max),body=fullLines.slice(start-1,end).join('\n').slice(column),next;
  const chars=bounded(op.maxChars,16000,64000);
  if(!op.ui&&body.length>chars){body=body.slice(0,chars);const pieces=body.split('\n');end=start+pieces.length-1;next={startLine:end,startColumn:pieces.length===1?column+pieces[0].length:pieces.at(-1).length};}
  else if(end<fullLines.length)next={startLine:end+1,startColumn:0};
  const backlinks=this.index.db.prepare('SELECT DISTINCT n.id,n.title,n.category,n.status,n.tags,n.version FROM edges e JOIN notes n ON n.id=e.source WHERE e.target=? ORDER BY n.title LIMIT 100').all(row.id).map(n=>this.index.metadata(n));
  let html;
  if(op.ui){const parser=new Marked({extensions:[{name:'wikilink',level:'inline',start:src=>src.indexOf('[['),tokenizer(src){const m=/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/.exec(src);if(m)return {type:'wikilink',raw:m[0],ref:m[1].trim(),label:m[2]||m[1]};},renderer:token=>{
   let target;try{target=this.index.resolve(token.ref);}catch{}
   const label=token.label.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
   return target?`<a href="#note/${target.id}">${label}</a>`:`${label}（未创建）`;
  }}]});html=sanitize(parser.parse(body));}
  return {...this.index.metadata(row),body,...(html!==undefined?{html}:{}),links:this.index.db.prepare('SELECT ref FROM refs WHERE source=? LIMIT 100').all(row.id).map(r=>r.ref),linksTotal:this.index.db.prepare('SELECT count(*) AS n FROM refs WHERE source=?').get(row.id).n,backlinks,startLine:start,startColumn:column,endLine:end,totalLines:fullLines.length,truncated:!!next,...(next?{next}:{})};
 }
 execute(op){
  if(!op||typeof op!=='object')throw Error('Expected an operation object');
  if(op.action==='reindex')return this.index.sync(true);
  this.index.sync();
  if(op.action==='catalog')return this.index.catalog(op);
  if(op.action==='search'||op.action==='list')return this.index.search(op);
  if(op.action==='graph')return this.graph(op);
  if(op.action==='read')return this.get(op.id,op);
  if(op.action==='neighbors')return this.neighbors(op.id,op);
  if(!['create','update','link'].includes(op.action))throw Error('Unknown action');
  return this.index.transaction(()=>{
   if(op.action==='link'){
    const source=this.index.resolve(op.id),target=this.index.resolve(op.target);if(!source||!target)throw Error('Both link endpoints must exist');
    const sourceFile=this.file(source.id);if(fs.lstatSync(sourceFile).isSymbolicLink())throw Error('Symlink notes are not supported');
    const currentBody=matter(fs.readFileSync(sourceFile,'utf8')).content.trim();
    if(links(currentBody).some(ref=>this.index.resolve(ref)?.id===target.id))return this.index.metadata(source);
    op={action:'update',id:source.id,body:currentBody+'\n\n[['+target.id+']]',version:op.version};
   }
   const id=op.id||(op.action==='create'?crypto.randomUUID():'');const file=this.file(id);
   const exists=fs.existsSync(file);if(exists&&fs.lstatSync(file).isSymbolicLink())throw Error('Symlink notes are not supported');
   if(op.action==='create'&&exists)throw Error('Note already exists');if(op.action==='update'&&!exists)throw Error('Note not found');
   const raw=exists?fs.readFileSync(file,'utf8'):'';
   if(op.version&&crypto.createHash('sha256').update(raw).digest('hex')!==op.version)throw Error('Document changed; read before updating');
   const previous=exists?matter(raw):{data:{},content:''},data={...previous.data};
   for(const key of ['title','category','status'])if(op[key]!==undefined){if(typeof op[key]!=='string'||!op[key].trim())throw Error(key+' must be a nonempty string');data[key]=op[key].trim();}
   if(!data.title)throw Error('title is required');
   if(op.tags!==undefined){if(!Array.isArray(op.tags)||op.tags.some(t=>typeof t!=='string'||!t.trim()||t.includes('/')))throw Error('tags must be flat nonempty strings');data.tags=[...new Set(op.tags.map(t=>t.trim()))];}
   data.tags||=[];data.category||='收件箱';data.status||='待整理';
   if(data.category.includes('/')||data.category.includes('\\'))throw Error('Use one category level');
   if(op.body!==undefined&&typeof op.body!=='string')throw Error('body must be a string');
   data.updated=new Date().toISOString();const temp=file+'.'+crypto.randomUUID()+'.tmp';
   try{fs.writeFileSync(temp,matter.stringify(op.body??previous.content,data),{flag:'wx'});fs.renameSync(temp,file);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
   this.index.ingest(id+'.md');return {...this.index.metadata(this.index.resolve(id)),body:op.body??previous.content};
  });
 }
}
