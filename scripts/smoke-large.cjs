const {app}=require('electron');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'garden-large-ui-'));
fs.cpSync(path.resolve('dist/fixtures/large-vault'),path.join(root,'vault'),{recursive:true,preserveTimestamps:true});
process.env.LINK_GARDEN_VAULT=path.join(root,'vault');
process.env.LINK_GARDEN_DATA_DIR=path.join(root,'data');
require('../desktop/main.cjs');app.setPath('userData',path.join(root,'settings'));
let passed=false;const timer=setTimeout(()=>{console.error('Large UI timed out');app.exit(1);},60000);
app.on('browser-window-created',(_event,win)=>win.webContents.once('did-finish-load',async()=>{
 try{
  const evaluate=code=>win.webContents.executeJavaScript(code);
  await evaluate(`(async()=>{for(let i=0;i<200&&!document.querySelector('article');i++)await new Promise(r=>setTimeout(r,50));document.querySelector('[data-view="graph"]').click();for(let i=0;i<200&&!document.querySelector('#network canvas');i++)await new Promise(r=>setTimeout(r,50));if(!document.querySelector('#network canvas'))throw Error('Graph not rendered');})()`);
  await new Promise(r=>setTimeout(r,400));
  const initial=await evaluate(`({scale:Number(document.querySelector('#network').dataset.scale),pan:document.querySelector('#network').dataset.pan})`);
  await evaluate(`document.querySelector('[data-graph="in"]').click()`);await new Promise(r=>setTimeout(r,50));
  const zoomed=await evaluate(`Number(document.querySelector('#network').dataset.scale)`);if(zoomed<=initial.scale)throw Error('Zoom did not increase');
  const rect=await evaluate(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};})()`);
  const beforePan=await evaluate(`document.querySelector('#network').dataset.pan`);
  const x=Math.round(rect.x+20),y=Math.round(rect.y+20);
  win.webContents.sendInputEvent({type:'mouseMove',x,y});win.webContents.sendInputEvent({type:'mouseDown',x,y,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseMove',x:x+50,y:y+30,movementX:50,movementY:30});win.webContents.sendInputEvent({type:'mouseUp',x:x+50,y:y+30,button:'left',clickCount:1});
  await new Promise(r=>setTimeout(r,80));if(await evaluate(`document.querySelector('#network').dataset.pan`)===beforePan)throw Error('Background drag did not pan');
  await evaluate(`document.querySelector('[data-graph="pause"]').click();const p=document.querySelector('[data-graph="node"]');p.selectedIndex=1;p.dispatchEvent(new Event('change'));`);
  const center={x:Math.round(rect.x+rect.width/2),y:Math.round(rect.y+rect.height/2)};
  win.webContents.sendInputEvent({type:'mouseMove',...center});await new Promise(r=>setTimeout(r,80));
  if(!await evaluate(`!document.querySelector('.graph-tooltip').hidden&&document.querySelector('.graph-tooltip').textContent.length>0`))throw Error('Hover title missing');
  // Dragging a node must not open it.
  win.webContents.sendInputEvent({type:'mouseDown',...center,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseMove',x:center.x+45,y:center.y+20,movementX:45,movementY:20});win.webContents.sendInputEvent({type:'mouseUp',x:center.x+45,y:center.y+20,button:'left',clickCount:1});await new Promise(r=>setTimeout(r,80));
  if(!await evaluate(`!!document.querySelector('#network canvas')`))throw Error('Node drag opened document');
  await evaluate(`document.querySelector('[data-graph="fit"]').click()`);await new Promise(r=>setTimeout(r,50));
  fs.mkdirSync('dist',{recursive:true});fs.writeFileSync('dist/network-preview.png',(await win.webContents.capturePage()).toPNG());
  const expected=await evaluate(`(()=>{const p=document.querySelector('[data-graph="node"]');p.dispatchEvent(new Event('change'));return p.options[p.selectedIndex].textContent;})()`);
  win.webContents.sendInputEvent({type:'mouseMove',...center});win.webContents.sendInputEvent({type:'mouseDown',...center,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseUp',...center,button:'left',clickCount:1});
  await evaluate(`(async()=>{for(let i=0;i<100&&!document.querySelector('article h1');i++)await new Promise(r=>setTimeout(r,50));})()`);
  if(await evaluate(`document.querySelector('article h1')?.textContent`)!==expected)throw Error('Node click did not read expected document');
  await evaluate(`document.querySelector('#search').value='测试编号';document.querySelector('#search').dispatchEvent(new Event('input'));`);
  await evaluate(`(async()=>{for(let i=0;i<100&&!document.querySelector('.excerpt');i++)await new Promise(r=>setTimeout(r,50));if(!document.querySelector('.excerpt'))throw Error('Body search excerpts missing');})()`);
  passed=true;console.log('PASS: 5000-note UI, 1000-node force graph, drag pan, zoom, hover title, node drag/click, full-body search');win.close();
 }catch(error){console.error(error);app.exit(1);}
}));
app.on('will-quit',()=>{clearTimeout(timer);if(!passed)process.exitCode=1;});
