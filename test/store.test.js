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
test('deleting a note removes its file and incoming link markup while preserving labels and code',t=>{
 const s=setup(t);
 s.execute({action:'create',id:'a',title:'A',body:'开始 [[b]]、[[b|Bee]]、[[Beta]] 和 `[[b]]`\n\n```md\n[[b]]\n```\n\n[[missing]]'});
 s.execute({action:'create',id:'b',title:'Beta',body:'来自 [[a|Alpha]]'});
 s.execute({action:'create',id:'c',title:'C',body:'[[Beta]]'});
 const result=s.execute({action:'delete',id:'b',version:s.get('b').version});
 assert.equal(result.removedLinks,4);assert.deepEqual(result.updatedNotes.map(n=>n.id).sort(),['a','c']);
 assert.ok(!fs.existsSync(s.file('b')));assert.throws(()=>s.execute({action:'read',id:'b'}),/not found/);
 const a=s.get('a');assert.match(a.body,/开始 b、Bee、Beta/);assert.match(a.body,/`\[\[b\]\]`/);assert.match(a.body,/```md\n\[\[b\]\]\n```/);
 assert.deepEqual(a.links,['missing']);assert.equal(s.get('c').body,'Beta');
 assert.deepEqual(s.graph().unresolved,[{source:'a',ref:'missing'}]);assert.deepEqual(s.graph().edges,[]);
});
test('delete requires the current version and rejects missing or stale notes',t=>{
 const s=setup(t);s.execute({action:'create',id:'a',title:'A',body:'v1'});const old=s.get('a').version;
 s.execute({action:'update',id:'a',body:'v2',version:old});
 assert.throws(()=>s.execute({action:'delete',id:'a',version:old}),/changed/);assert.ok(fs.existsSync(s.file('a')));
 assert.throws(()=>s.execute({action:'delete',id:'missing'}),/not found/);
 s.execute({action:'delete',id:'a',version:s.get('a').version});assert.ok(!fs.existsSync(s.file('a')));
 assert.throws(()=>s.execute({action:'delete',id:'a'}),/not found/);
});
