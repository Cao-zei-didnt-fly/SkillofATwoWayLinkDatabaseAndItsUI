import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'garden-ui-package-'));
for(let i=0;i<40;i++)fs.writeFileSync(path.join(root,'note-'+i+'.md'),'---\n'+JSON.stringify({title:'验证笔记'+i})+'\n---\n正文 [[note-'+((i+1)%40)+']]');
const child=spawn(path.resolve('dist/win-unpacked/Link Garden.exe'),['--remote-debugging-port=9432'],{env:{...process.env,LINK_GARDEN_VAULT:root,LINK_GARDEN_DATA_DIR:path.join(root,'data')},windowsHide:true,stdio:'ignore'});
const exited=new Promise(resolve=>child.once('exit',resolve));let ws;
try{
 let page;for(let i=0;i<100;i++){try{page=(await(await fetch('http://127.0.0.1:9432/json')).json()).find(p=>p.type==='page');if(page)break;}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(page,'Packaged UI did not start');
 ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});let id=0;const pending=new Map();
 ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){pending.get(message.id)?.(message);pending.delete(message.id);}};
 const send=(method,params={})=>new Promise(resolve=>{const seq=++id;pending.set(seq,resolve);ws.send(JSON.stringify({id:seq,method,params}));});
 const evaluated=await send('Runtime.evaluate',{expression:`(async()=>{const wait=async fn=>{for(let i=0;i<150&&!fn();i++)await new Promise(r=>setTimeout(r,40));if(!fn())throw Error('UI wait failed');};await wait(()=>document.querySelector('article'));document.querySelector('[data-view="graph"]').click();await wait(()=>document.querySelector('#network canvas'));await new Promise(r=>setTimeout(r,900));const root=document.querySelector('#network');if(root.dataset.layout!=='worker'||Number(root.dataset.frames)<2)throw Error('Packaged worker did not execute');document.querySelector('#connect').click();await wait(()=>document.querySelector('#connection-dialog').open&&document.querySelectorAll('.agent-item').length===7);if(!document.querySelector('#agent-list').textContent.includes('CodeBuddy'))throw Error('CodeBuddy missing');if(!document.querySelector('.required-registration'))throw Error('Required flow missing');const storage=await window.linkGarden.storage({action:'get'});if(!storage.data.endsWith('data')||!storage.profile.startsWith(storage.data)||!storage.integrations.startsWith(storage.data))throw Error('Storage escaped local data');return {layout:root.dataset.layout,frames:root.dataset.frames,clients:7,storage:storage.data};})()`,awaitPromise:true,returnByValue:true});
 if(evaluated.result?.exceptionDetails)console.error(JSON.stringify(await send('Runtime.evaluate',{expression:JSON.stringify('')+'||JSON.stringify({error:document.querySelector("#error")?.textContent,dialog:document.querySelector("#connection-dialog")?.open,rows:document.querySelectorAll(".agent-item").length})',returnByValue:true})));assert.ok(!evaluated.result?.exceptionDetails,JSON.stringify(evaluated));console.log('Packaged UI verified:',JSON.stringify(evaluated.result.result.value));
 ws.send(JSON.stringify({id:++id,method:'Runtime.evaluate',params:{expression:'window.close()'}}));
 await Promise.race([exited,new Promise((_,reject)=>setTimeout(()=>reject(Error('UI did not exit')),5000))]);console.log('PASS: packaged Worker loads from ASAR, mandatory global registration + CodeBuddy visible, closing window exits');
}catch(error){child.kill();throw error;}finally{ws?.close();await exited;fs.rmSync(root,{recursive:true,force:true});}
