import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import matter from 'gray-matter';

export const bounded = (value, fallback, max) => Number.isInteger(value) && value > 0 ? Math.min(value, max) : fallback;
export function termsFor(text) {
  const chars = Array.from(text.toLowerCase());
  const tokens = [];
  for (let i=0;i<chars.length;i++) {
    if (/\s/u.test(chars[i])) continue;
    tokens.push('c'+chars[i].codePointAt(0).toString(16));
    if (i+1<chars.length && !/\s/u.test(chars[i+1])) tokens.push('g'+chars[i].codePointAt(0).toString(16)+'x'+chars[i+1].codePointAt(0).toString(16));
  }
  return tokens.join(' ');
}
export class NoteIndex {
  constructor(root,parseLinks) {
    this.root=root;this.parseLinks=parseLinks;this.dirty=new Set();this.lastScan=0;this.lastCheck=0;
    const dir=path.join(root,'.link-garden');
    if(fs.existsSync(dir)&&fs.lstatSync(dir).isSymbolicLink())throw Error('Index directory cannot be a symlink');
    fs.mkdirSync(dir,{recursive:true});
    const file=path.join(dir,'index.sqlite');
    if(fs.existsSync(file)&&fs.lstatSync(file).isSymbolicLink())throw Error('Index cannot be a symlink');
    this.db=new DatabaseSync(file);
    this.db.function('fold',{deterministic:true},value=>String(value??'').toLowerCase());
    this.db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS notes(id TEXT PRIMARY KEY,title TEXT NOT NULL,category TEXT,status TEXT,tags TEXT,body TEXT,version TEXT,mtime REAL,size INTEGER);
      CREATE INDEX IF NOT EXISTS title_lookup ON notes(title);
      CREATE TABLE IF NOT EXISTS index_errors(id TEXT PRIMARY KEY,message TEXT);
      CREATE TABLE IF NOT EXISTS refs(source TEXT,ref TEXT,PRIMARY KEY(source,ref));
      CREATE INDEX IF NOT EXISTS refs_lookup ON refs(ref);
      CREATE VIRTUAL TABLE IF NOT EXISTS search USING fts5(id UNINDEXED,title,tags,body);
      CREATE VIEW IF NOT EXISTS edges AS SELECT r.source,COALESCE(exact.id,bytitle.id) AS target,r.ref FROM refs r
      LEFT JOIN notes exact ON exact.id=r.ref LEFT JOIN notes bytitle ON exact.id IS NULL AND bytitle.title=r.ref
      AND (SELECT count(*) FROM notes n WHERE n.title=r.ref)=1;`);
    this.sync(true);
    try {this.watcher=fs.watch(root,(_event,name)=>{if(name&&/^[a-zA-Z0-9_-]{1,80}\.md$/.test(name))this.dirty.add(name);});this.watcher.unref();}catch{}
  }
  close(){this.watcher?.close();this.db.close();}
  refreshId(id){
    const file=path.join(this.root,id+'.md'),old=this.db.prepare('SELECT mtime,size FROM notes WHERE id=?').get(id);
    const stat=fs.existsSync(file)?fs.lstatSync(file):null;
    if(!old||!stat?.isFile()||stat.isSymbolicLink()||old.mtime!==stat.mtimeMs||old.size!==stat.size)this.transaction(()=>this.ingest(id+'.md'));
  }
  transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.db.exec('COMMIT');return result;}catch(error){this.db.exec('ROLLBACK');throw error;}}
  sync(force=false) {
    const now=Date.now();
    // Stat sweep catches editor renames, missed watch events and other processes.
    if(force||now-this.lastScan>30000||now-this.lastCheck>1000){
      const known=new Map(this.db.prepare('SELECT id,mtime,size FROM notes UNION ALL SELECT id,NULL,NULL FROM index_errors').all().map(n=>[n.id,n]));
      for(const name of fs.readdirSync(this.root))if(/^[a-zA-Z0-9_-]{1,80}\.md$/.test(name)){
        const stat=fs.lstatSync(path.join(this.root,name)),id=name.slice(0,-3),old=known.get(id);known.delete(id);
        if(!stat.isFile()||stat.isSymbolicLink()||!old||old.mtime!==stat.mtimeMs||old.size!==stat.size)this.dirty.add(name);
      }
      for(const id of known.keys())this.dirty.add(id+'.md');
      this.lastCheck=now; if(force||now-this.lastScan>30000)this.lastScan=now;
    }
    if(!this.dirty.size)return {updated:0};
    const names=[...this.dirty];
    this.transaction(()=>{for(const name of names){try{this.ingest(name);}catch(error){this.db.prepare('INSERT OR REPLACE INTO index_errors VALUES(?,?)').run(name.slice(0,-3),error.message.slice(0,500));}}});
    for(const name of names)this.dirty.delete(name);
    return {updated:names.length};
  }
  ingest(name) {
    if(!/^[a-zA-Z0-9_-]{1,80}\.md$/.test(name))throw Error('Invalid Markdown filename');
    const id=name.slice(0,-3),file=path.join(this.root,name);
    const stat=fs.existsSync(file)?fs.lstatSync(file):null;
    this.db.prepare('DELETE FROM notes WHERE id=?').run(id);this.db.prepare('DELETE FROM search WHERE id=?').run(id);this.db.prepare('DELETE FROM refs WHERE source=?').run(id);
    this.db.prepare('DELETE FROM index_errors WHERE id=?').run(id);
    if(!stat?.isFile()||stat.isSymbolicLink())return;
    const raw=fs.readFileSync(file,'utf8'),{data,content}=matter(raw),body=content.trim();
    const title=String(data.title||id),tags=Array.isArray(data.tags)?data.tags.filter(t=>typeof t==='string'):[];
    this.db.prepare('INSERT INTO notes VALUES(?,?,?,?,?,?,?,?,?)').run(id,title,String(data.category||'收件箱'),String(data.status||'待整理'),JSON.stringify(tags),body,crypto.createHash('sha256').update(raw).digest('hex'),stat.mtimeMs,stat.size);
    this.db.prepare('INSERT INTO search(id,title,tags,body) VALUES(?,?,?,?)').run(id,termsFor(title),termsFor(tags.join(' ')),termsFor(body));
    for(const ref of new Set(this.parseLinks(body)))this.db.prepare('INSERT INTO refs VALUES(?,?)').run(id,ref);
  }
  metadata(row) {if(!row)return undefined;const {body,mtime,size,...meta}=row;return {...meta,tags:JSON.parse(row.tags)};}
  resolve(ref){const exact=this.db.prepare('SELECT * FROM notes WHERE id=?').get(ref);if(exact)return exact;const hits=this.db.prepare('SELECT * FROM notes WHERE title=? LIMIT 2').all(ref);if(hits.length>1)throw Error('Ambiguous title; use note id: '+ref);return hits[0];}
  catalog(op={}){
    const limit=bounded(op.limit,100,200),offset=Number.isInteger(op.offset)&&op.offset>=0?op.offset:0,query=String(op.query||'').toLowerCase();
    const categorySql='SELECT category AS name,count(*) AS count FROM notes WHERE instr(fold(category),?)>0 GROUP BY category';
    const tagSql='SELECT j.value AS name,count(*) AS count FROM notes n,json_each(n.tags) j WHERE instr(fold(j.value),?)>0 GROUP BY j.value';
    const categories=this.db.prepare(categorySql+' ORDER BY count(*) DESC,name LIMIT ? OFFSET ?').all(query,limit,offset);
    const tags=this.db.prepare(tagSql+' ORDER BY count(*) DESC,name LIMIT ? OFFSET ?').all(query,limit,offset);
    return {total:this.db.prepare('SELECT count(*) AS n FROM notes').get().n,categories,tags,categoryTotal:this.db.prepare('SELECT count(*) AS n FROM ('+categorySql+')').get(query).n,tagTotal:this.db.prepare('SELECT count(*) AS n FROM ('+tagSql+')').get(query).n,indexErrors:this.db.prepare('SELECT * FROM index_errors LIMIT 10').all(),indexErrorTotal:this.db.prepare('SELECT count(*) AS n FROM index_errors').get().n,limit,offset};
  }
  search(op={}) {
    const query=String(op.query||'').trim();if(query.length>500)throw Error('Query is too long (max 500 characters)');
    const terms=(query.match(/"[^"]+"|\S+/gu)||[]).map(t=>t.replace(/^"|"$/g,'').toLowerCase());
    const limit=bounded(op.limit,20,100),offset=Number.isInteger(op.offset)&&op.offset>=0?op.offset:0;
    const clauses=[],params=[];
    if(op.category){clauses.push('n.category=?');params.push(op.category);}
    if(op.tag){clauses.push('EXISTS(SELECT 1 FROM json_each(n.tags) WHERE value=?)');params.push(op.tag);}
    if(op.status){clauses.push('n.status=?');params.push(op.status);}
    let from='notes n',score='0';
    if(terms.length){
      const expressions=terms.map(term=>{
        const chars=Array.from(term);const tokens=chars.length===1?['c'+chars[0].codePointAt(0).toString(16)]:termsFor(term).split(' ').filter(t=>t.startsWith('g'));
        return '('+[...new Set(tokens)].map(t=>'"'+t+'"').join(' AND ')+')';
      }).filter(s=>s!=='()');
      if(!expressions.length)return {items:[],total:0,offset,limit};
      from='search JOIN notes n ON n.id=search.id';score='bm25(search,0,8,4,1)';
      clauses.unshift('search MATCH ?');params.unshift(expressions.join(op.match==='any'?' OR ':' AND '));
      const exact=terms.map(()=>"(instr(fold(n.title),?)>0 OR instr(fold(n.body),?)>0 OR instr(fold(n.tags),?)>0)");
      clauses.push('('+exact.join(op.match==='any'?' OR ':' AND ')+')');for(const term of terms)params.push(term,term,term);
    }
    const where=clauses.length?' WHERE '+clauses.join(' AND '):'';
    const total=this.db.prepare('SELECT count(*) AS n FROM '+from+where).get(...params).n;
    const rows=this.db.prepare(`SELECT n.*,${score} AS rank FROM ${from}${where} ORDER BY rank,n.title,n.id LIMIT ? OFFSET ?`).all(...params,limit,offset);
    const items=rows.map(row=>{
      const {rank,...meta}=this.metadata(row),matches=[];
      if(terms.length){const lines=row.body.split('\n');for(let i=0;i<lines.length&&matches.length<3;i++){
        const lower=lines[i].toLowerCase(),term=terms.find(t=>lower.includes(t));if(term){const at=lower.indexOf(term),start=Math.max(0,at-65);matches.push({line:i+1,text:(start?'…':'')+lines[i].slice(start,start+200)+(lines[i].length>start+200?'…':'')});}
      }}
      return {...meta,score:-rank,matches,matchedFields:terms.length?['title','tags','body'].filter(field=>terms.some(t=>String(field==='tags'?row.tags:row[field]).toLowerCase().includes(t))):[]};
    });
    return {items,total,offset,limit};
  }
}
