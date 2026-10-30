import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import storage from '../src/paths.cjs';
function setup(t,env={}){const root=fs.mkdtempSync(path.join(os.tmpdir(),'garden-local-')),layout=storage.localLayout({root:path.join(root,'安装 空格'),appData:path.join(root,'roaming'),env});t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return {root,layout};}
test('default installation prefers D and falls back to C only when D is absent',()=>{
 assert.equal(storage.preferredInstallDirectory(p=>p==='D:\\'),'D:\\Link Garden');assert.equal(storage.preferredInstallDirectory(()=>false),'C:\\Link Garden');
});
test('all owned runtime directories stay under installation/data',t=>{
 const {layout}=setup(t);storage.prepareLocalData(layout);for(const key of ['vault','profile','session','integrations','logs','crashDumps','temp']){assert.ok(layout[key].startsWith(layout.data+path.sep));if(key!=='vault')assert.ok(fs.existsSync(layout[key]));}assert.ok(!fs.existsSync(layout.legacy));
});
test('legacy notes migrate once without overwriting, deleting originals or copying a live index',t=>{
 const {layout}=setup(t);fs.mkdirSync(path.join(layout.legacy,'vault/.link-garden'),{recursive:true});fs.mkdirSync(layout.vault,{recursive:true});fs.mkdirSync(path.join(layout.legacy,'integrations'),{recursive:true});
 fs.writeFileSync(path.join(layout.legacy,'vault/a.md'),'old a');fs.writeFileSync(path.join(layout.legacy,'vault/b.md'),'old b');fs.writeFileSync(path.join(layout.legacy,'vault/.link-garden/index.sqlite'),'not a database');fs.writeFileSync(path.join(layout.legacy,'integrations/agents.json'),'{}');fs.writeFileSync(path.join(layout.vault,'a.md'),'new a');
 const report=storage.prepareLocalData(layout);assert.equal(fs.readFileSync(path.join(layout.vault,'a.md'),'utf8'),'new a');assert.equal(fs.readFileSync(path.join(layout.vault,'b.md'),'utf8'),'old b');assert.equal(fs.readFileSync(path.join(layout.legacy,'vault/a.md'),'utf8'),'old a');assert.ok(report.conflicts.includes(path.join('vault','a.md')));assert.ok(!fs.existsSync(path.join(layout.vault,'.link-garden')));assert.ok(fs.existsSync(path.join(layout.integrations,'agents.json')));
 fs.writeFileSync(path.join(layout.legacy,'vault/c.md'),'later');storage.prepareLocalData(layout);assert.ok(!fs.existsSync(path.join(layout.vault,'c.md')));
});
test('an explicit vault is respected and never filled with unrelated legacy notes',t=>{
 const {root,layout}=setup(t,{LINK_GARDEN_VAULT:path.join(os.tmpdir(),'explicit-vault-'+process.pid)});fs.mkdirSync(path.join(layout.legacy,'vault'),{recursive:true});fs.writeFileSync(path.join(layout.legacy,'vault/a.md'),'legacy');const report=storage.prepareLocalData(layout);assert.equal(report.copied,0);assert.equal(layout.customVault,true);assert.ok(!fs.existsSync(path.join(root,'安装 空格/data/vault/a.md')));
});
test('an unusable local data path fails rather than falling back to AppData',t=>{
 const {layout}=setup(t);fs.mkdirSync(layout.root,{recursive:true});fs.writeFileSync(layout.data,'not a directory');assert.throws(()=>storage.prepareLocalData(layout));assert.ok(!fs.existsSync(layout.legacy));
});
test('installer customization keeps data and removes the automatic AppData installer cache',()=>{
 const files=fs.readFileSync('build/lg-install-files.nsh','utf8');assert.ok(!files.includes('!insertmacro copyFile "$EXEPATH" "$LOCALAPPDATA\\${APP_INSTALLER_STORE_FILE}"'));
 const hooks=fs.readFileSync('build/installer.nsh','utf8');assert.match(hooks,/D:\\Link Garden/);assert.match(hooks,/C:\\Link Garden/);assert.ok(hooks.includes('RMDir /r "$INSTDIR\\resources"'));assert.ok(!hooks.includes('RMDir /r "$INSTDIR"'));assert.ok(!hooks.includes('RMDir /r "$INSTDIR\\data"'));
});
