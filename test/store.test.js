import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../src/store.js';
function setup(t) {const dir=fs.mkdtempSync(path.join(os.tmpdir(),'link-garden-'));const store=new Store(dir);t.after(()=>{store.close();fs.rmSync(dir,{recursive:true,force:true});});return store;}
test('persists Markdown and derives backlinks; links survive title changes',t=>{
 const s=setup(t);s.execute({action:'create',id:'a',title:'Alpha',tags:['one'],body:'[[b|Beta]]'});s.execute({action:'create',id:'b',title:'Beta'});
 assert.equal(s.get('b').backlinks[0].id,'a');assert.match(s.get('a').html,/#note\/b/);
 s.execute({action:'update',id:'b',title:'Renamed'});assert.equal(s.get('b').backlinks.length,1);
 s.execute({action:'update',id:'a',status:'已完成'});assert.equal(s.get('a').body,'[[b|Beta]]');assert.deepEqual(s.get('a').tags,['one']);
 assert.match(fs.readFileSync(path.join(s.root,'a.md'),'utf8'),/title: Alpha/);
});
test('link is idempotent; unresolved targets and ambiguous titles are explicit',t=>{
 const s=setup(t);for(const id of ['a','b'])s.execute({action:'create',id,title:id});
 s.execute({action:'link',id:'a',target:'b'});s.execute({action:'link',id:'a',target:'b'});assert.equal(s.graph().edges.length,1);
 s.execute({action:'update',id:'a',body:'[[missing]]'});assert.deepEqual(s.graph().unresolved,[{source:'a',ref:'missing'}]);
 assert.throws(()=>s.execute({action:'link',id:'a',target:'missing'}));
 s.execute({action:'update',id:'b',title:'a'});s.execute({action:'create',id:'c',title:'a'});
 assert.equal(s.resolve(s.list(),'nonexistent-title'),undefined);
 s.execute({action:'update',id:'b',title:'duplicate'});s.execute({action:'update',id:'c',title:'duplicate'});assert.throws(()=>s.resolve(s.list(),'duplicate'),/Ambiguous/);
});
test('rejects path traversal, duplicate creation, invalid taxonomy and strips unsafe HTML',t=>{
 const s=setup(t);assert.throws(()=>s.execute({action:'create',id:'../escape',title:'x'}));
 assert.throws(()=>s.execute({action:'create',id:'a',title:'x',category:'one/two'}));
 assert.throws(()=>s.execute({action:'create',id:'a',title:'x',tags:['one/two']}));
 s.execute({action:'create',id:'a',title:'x',body:'<script>alert(1)</script>\n<img src=x onerror="alert(1)">'});
 assert.doesNotMatch(s.get('a').html,/script|onerror/);assert.throws(()=>s.execute({action:'create',id:'a',title:'overwrite'}));
 assert.throws(()=>s.execute({action:'update',id:'missing',body:'x'}));
});
test('code samples do not create links or get rewritten',t=>{
 const s=setup(t);s.execute({action:'create',id:'a',title:'A',body:'`[[example]]`\n\n```md\n[[sample]]\n```\n\n[[real]]'});
 assert.deepEqual(s.graph().unresolved,[{source:'a',ref:'real'}]);assert.match(s.get('a').html,/\[\[example\]\]/);
});
