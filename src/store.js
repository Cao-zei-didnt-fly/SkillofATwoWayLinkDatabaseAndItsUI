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
const sha256=text=>crypto.createHash('sha256').update(text).digest('hex');
function mergeRanges(ranges) {
 const sorted=ranges.filter(([from,to])=>to>from).sort((a,b)=>a[0]-b[0]);
 if(!sorted.length)return [];
 const merged=[sorted[0]];
 for(const range of sorted.slice(1)){
  const last=merged[merged.length-1];
  if(range[0]<=last[1])last[1]=Math.max(last[1],range[1]);
  else merged.push(range);
 }
 return merged;
}
// Keep fenced blocks, inline code, HTML comments and <pre>/<code> content intact
// while rewriting wikilinks. This mirrors the link parser's "code is not a link" rule.
function codeRanges(body) {
 const ranges=[];
 const lines=body.split('\n');
 let offset=0,fence=null;
 for(const line of lines){
  const start=offset;offset+=line.length+1;
  if(fence){
   const close=new RegExp('^ {0,3}'+fence.char+'{'+fence.len+',}\\s*$');
   if(close.test(line)){ranges.push([fence.start,Math.min(start+line.length,body.length)]);fence=null;}
   continue;
  }
  const open=/^ {0,3}(`{3,}|~{3,})/.exec(line);
  if(open)fence={char:open[1][0],len:open[1].length,start};
 }
 if(fence)ranges.push([fence.start,body.length]);
 const protectedAt=index=>ranges.some(([from,to])=>index>=from&&index<to);
 for(let i=0;i<body.length;){
  if(body[i]!=='`'||protectedAt(i)){i++;continue;}
  let len=1;while(body[i+len]==='`')len++;
  const token='`'.repeat(len);
  let close=body.indexOf(token,i+len);
  while(close>=0&&protectedAt(close))close=body.indexOf(token,close+len);
  if(close>=0){ranges.push([i,close+len]);i=close+len;}
  else i+=len;
 }
 const html=/<!--[\s\S]*?-->|<pre\b[^>]*>[\s\S]*?<\/pre>|<code\b[^>]*>[\s\S]*?<\/code>/gi;
 for(const match of body.matchAll(html))if(!protectedAt(match.index))ranges.push([match.index,match.index+match[0].length]);
 return mergeRanges(ranges);
}
function rewriteSegment(segment,replace) {
 return segment.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,(all,ref,label)=>replace(all,ref.trim(),label));
}
function stripLinksTo(body,targetId,resolve) {
 let count=0;
 const replace=(all,ref,label)=>{
  let target;try{target=resolve(ref);}catch{return all;}
  if(!target||target.id!==targetId)return all;
  count++;
  return label===undefined?ref:label;
 };
 const ranges=codeRanges(body);
 let output='',position=0;
 for(const [from,to] of ranges){
  output+=rewriteSegment(body.slice(position,from),replace)+body.slice(from,to);
  position=to;
 }
 output+=rewriteSegment(body.slice(position),replace);
 return {body:output,count};
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
 writeFile(file,text){
  const temp=file+'.'+crypto.randomUUID()+'.tmp';
  try{fs.writeFileSync(temp,text,{flag:'wx'});fs.renameSync(temp,file);}
  finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
 }
 remove(id,op={}){
  this.index.sync();
  const row=this.index.resolve(id);if(!row)throw Error('Note not found');
  const file=this.file(row.id);
  if(!fs.existsSync(file)||fs.lstatSync(file).isSymbolicLink())throw Error('Note not found or symlink notes are not supported');
  const raw=fs.readFileSync(file,'utf8');
  if(op.version&&sha256(raw)!==op.version)throw Error('Document changed; read before deleting');
  // Clean incoming wikilinks before deleting the file. Labels are preserved as
  // plain text; code samples are left untouched by stripLinksTo.
  const sources=this.index.db.prepare('SELECT DISTINCT source FROM edges WHERE target=?').all(row.id).map(entry=>entry.source).filter(source=>source!==row.id);
  const changes=[];
  for(const sourceId of sources){
   const sourceFile=this.file(sourceId);
   if(!fs.existsSync(sourceFile)||fs.lstatSync(sourceFile).isSymbolicLink())continue;
   const before=fs.readFileSync(sourceFile,'utf8');
   const indexedVersion=this.index.db.prepare('SELECT version FROM notes WHERE id=?').get(sourceId)?.version;
   if(indexedVersion&&sha256(before)!==indexedVersion)throw Error('Linked note changed; refresh before deleting: '+sourceId);
   const parsed=matter(before);
   const stripped=stripLinksTo(parsed.content,row.id,ref=>this.index.resolve(ref));
   if(!stripped.count)continue;
   // Preserve the original frontmatter bytes (comments included) and replace only the body.
   const prefix=before.endsWith(parsed.content)?before.slice(0,before.length-parsed.content.length):matter.stringify('',parsed.data);
   const after=prefix+stripped.body;
   changes.push({id:sourceId,before,after,count:stripped.count});
  }
  const applied=[];let deleted=false;
  try{
   for(const change of changes){this.writeFile(this.file(change.id),change.after);applied.push(change);}
   if(sha256(fs.readFileSync(file,'utf8'))!==sha256(raw))throw Error('Document changed; read before deleting');
   fs.unlinkSync(file);deleted=true;
   this.index.transaction(()=>{
    for(const change of changes)this.index.ingest(change.id+'.md');
    this.index.ingest(row.id+'.md');
   });
  }catch(error){
   let rollbackFailed=false;
   for(const change of applied.reverse())try{this.writeFile(this.file(change.id),change.before);this.index.ingest(change.id+'.md');}catch{rollbackFailed=true;}
   if(deleted)try{this.writeFile(file,raw);this.index.ingest(row.id+'.md');}catch{rollbackFailed=true;}
   throw Error(error.message+(rollbackFailed?'；部分文件已改动，请检查备份。':'；本次删除已回滚。'));
  }
  const updatedNotes=changes.map(change=>this.index.metadata(this.index.resolve(change.id))).filter(Boolean).map(note=>({id:note.id,title:note.title}));
  return {id:row.id,title:row.title,removedLinks:changes.reduce((total,change)=>total+change.count,0),updatedNotes};
 }
 execute(op){
  if(!op||typeof op!=='object')throw Error('Expected an operation object');
  if(op.action==='reindex')return this.index.sync(true);
  this.index.sync();
  if(op.action==='catalog')return this.index.catalog(op);
  if(op.action==='search'||op.action==='list')return this.index.search(op);
  if(op.action==='graph')return this.graph(op);
  if(op.action==='read')return this.get(op.id,op);
  if(op.action==='delete')return this.remove(op.id,op);
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
   data.updated=new Date().toISOString();
   this.writeFile(file,matter.stringify(op.body??previous.content,data));
   this.index.ingest(id+'.md');return {...this.index.metadata(this.index.resolve(id)),body:op.body??previous.content};
  });
 }
}
