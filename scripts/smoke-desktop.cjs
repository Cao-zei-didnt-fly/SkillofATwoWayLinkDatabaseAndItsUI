// Runs the real desktop entry point with an isolated vault and settings profile.
const {app} = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'garden-desktop-'));
process.env.LINK_GARDEN_VAULT=path.join(root,'vault');
process.env.LINK_GARDEN_DATA_DIR=path.join(root,'data');
require('../desktop/main.cjs');
app.setPath('userData',path.join(root,'settings'));
let passed=false;
const timer=setTimeout(()=>{console.error('Desktop smoke timed out');app.exit(1);},30000);
app.on('browser-window-created',(_event,win)=>{
  win.webContents.once('did-finish-load',async()=>{
    try {
      await win.webContents.executeJavaScript(`(async()=>{
        for(let i=0;i<100&&!document.querySelector('#files .note');i++)await new Promise(r=>setTimeout(r,50));
        if(!document.querySelector('#files .note'))throw Error('Notes did not render');
        const result=await window.linkGarden.execute({action:'create',id:'desktop-test',title:'Desktop test',body:'[[welcome]]'});
        if(!result.ok)throw Error(result.error);
        const read=await window.linkGarden.execute({action:'read',id:'welcome'});
        if(!read.result.backlinks.some(n=>n.id==='desktop-test'))throw Error('IPC backlink failed');
        document.querySelector('[data-skin="violet"]').click();
        if(localStorage.getItem('link-garden-skin')!=='violet')throw Error('Theme not saved');
      })()`);
      win.webContents.once('did-finish-load',async()=>{
        try {
          await win.webContents.executeJavaScript(`(async()=>{
            if(document.documentElement.style.getPropertyValue('--accent')!=='#7948a3')throw Error('Theme not restored');
            const wait=async selector=>{for(let i=0;i<100&&!document.querySelector(selector);i++)await new Promise(r=>setTimeout(r,50));if(!document.querySelector(selector))throw Error('Missing rendered view: '+selector);};
            await wait('article h1');
            document.querySelector('[data-view="board"]').click();await wait('#board .card');
            document.querySelector('[data-view="graph"]').click();await wait('#network canvas');
            const canvas=document.querySelector('#network canvas');const scale=Number(document.querySelector('#network').dataset.scale);document.querySelector('[data-graph="in"]').click();await new Promise(r=>setTimeout(r,100));if(Number(document.querySelector('#network').dataset.scale)<=scale)throw Error('Graph zoom failed');
            canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));
            document.querySelector('#connect').click();await wait('#connection-dialog[open]');await wait('.agent-item');if(document.querySelectorAll('.agent-item').length!==7)throw Error('Missing client adapters');if(!document.querySelector('#guide-path').value.endsWith('REGISTER-MCP.md'))throw Error('Missing agent guide');if(!document.querySelector('#codex-config').value.includes('mcp-entry.js'))throw Error('MCP config export failed');document.querySelector('#close-connection').click();
            document.querySelector('[data-view="read"]').click();await wait('article h1');
          })()`);
          await win.webContents.executeJavaScript(`(async()=>{document.querySelector('#connect').click();for(let i=0;i<100&&!document.querySelector('#connection-dialog').open;i++)await new Promise(r=>setTimeout(r,50));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));})()`);
          fs.mkdirSync(path.join(__dirname,'../dist'),{recursive:true});
          fs.writeFileSync(path.join(__dirname,'../dist/agent-setup-preview.png'),(await win.webContents.capturePage()).toPNG());
          await win.webContents.executeJavaScript("document.querySelector('#close-connection').click()");
          fs.writeFileSync(path.join(__dirname,'../dist/desktop-preview.png'),(await win.webContents.capturePage()).toPNG());
          passed=true;console.log('PASS: desktop rendering, IPC writes/backlinks, skin persistence; closing window');win.close();
        }catch(error){console.error(error);app.exit(1);}
      });
      win.webContents.reload();
    }catch(error){console.error(error);app.exit(1);}
  });
});
app.on('will-quit',()=>{clearTimeout(timer);if(!passed)process.exitCode=1;});
