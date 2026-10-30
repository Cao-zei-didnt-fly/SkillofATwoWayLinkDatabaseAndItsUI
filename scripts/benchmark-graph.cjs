// Compare the shipped 0.3 renderer with the new renderer using native input + CPU throttling.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path');
app.on('window-all-closed',()=>app.quit());
app.whenReady().then(async()=>{
 const {extractFile}=await import('@electron/asar');
 const baseline=path.resolve('tmp/graph-benchmark/baseline-0.3.bundle.js');fs.mkdirSync(path.dirname(baseline),{recursive:true});if(!fs.existsSync(baseline))fs.writeFileSync(baseline,extractFile(path.resolve('dist/win-unpacked/resources/app.asar'),'web/graph.bundle.js'));const legacy=fs.readFileSync(baseline,'utf8');
 const current=fs.readFileSync('web/graph.bundle.js','utf8');
 const win=new BrowserWindow({width:1100,height:760,show:true,webPreferences:{backgroundThrottling:false,contextIsolation:true,sandbox:true}});
 const html=path.resolve('tmp/graph-benchmark/harness.html');fs.mkdirSync(path.dirname(html),{recursive:true});
 fs.writeFileSync(html,'<!doctype html><style>body{margin:0;font:14px sans-serif}#network{--accent:#246451;--soft:#edf1e9}canvas{width:100%;height:550px;touch-action:none}.graph-stage{position:relative}.graph-tooltip{position:absolute;left:0;top:0}</style><div id="network"></div>');
 await win.loadFile(html);win.webContents.debugger.attach('1.3');
 const evaluate=code=>win.webContents.executeJavaScript(code);
 await evaluate(`window.__mounts={};${legacy};window.__mounts.legacy=GardenGraph.mountGraph;${current};window.__mounts.current=GardenGraph.mountGraph;void 0;`);
 // Worker URLs are relative to the harness, so provide its exact bundled worker next to it.
 fs.copyFileSync('web/graph-worker.bundle.js',path.join(path.dirname(html),'graph-worker.bundle.js'));
 const report={nodes:1000,edges:3000,baselineVersion:'0.3.0',scenarios:[]};
 for(const rate of [1,6]){await win.webContents.debugger.sendCommand('Emulation.setCPUThrottlingRate',{rate});const scenario={cpuThrottle:rate};
 for(const mode of ['legacy','current']){
  await evaluate(`(()=>{window.__controller?.dispose();const root=document.querySelector('#network');root.dataset.layout='main-thread';root.innerHTML='<button data-graph="fit">Fit</button><button data-graph="in">+</button><button data-graph="out">-</button><button data-graph="pause">Pause</button><input data-graph="repulsion" value="210"><span data-graph="performance"></span><div class="graph-stage"><canvas></canvas><div class="graph-tooltip" hidden></div></div><select data-graph="node"><option></option></select><button data-graph="open">Open</button>';
    window.__paint=0;const ctx=root.querySelector('canvas').getContext('2d');for(const method of ['clearRect','fillRect']){const original=ctx[method].bind(ctx);ctx[method]=(...args)=>{window.__paint++;return original(...args);};}
    const nodes=Array.from({length:1000},(_,i)=>({id:'n'+i,title:'笔记 '+i}));const edges=nodes.flatMap((n,i)=>[1,7,31].map(d=>({source:n.id,target:'n'+((i+d)%1000)})));window.__controller=window.__mounts.${mode}(root,{nodes,edges},{open:()=>{}});
  })()`);
  await new Promise(r=>setTimeout(r,300));
  if(mode==='current'){
   const worker=await evaluate("document.querySelector('#network').dataset.layout");if(worker!=='worker')throw Error('Worker layout did not start');
  }
  const rect=await evaluate(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect();window.__paint=0;window.__started=performance.now();return {x:r.x,y:r.y};})()`);
  const start=Date.now(),x=Math.round(rect.x+12),y=Math.round(rect.y+12);
  win.webContents.sendInputEvent({type:'mouseDown',x,y,button:'left',clickCount:1});
  while(Date.now()-start<2200){const t=Date.now()-start;win.webContents.sendInputEvent({type:'mouseMove',x:x+Math.round(t/15)%90,y:y+Math.round(t/30)%40,movementX:1,movementY:1});await new Promise(r=>setTimeout(r,8));}
  win.webContents.sendInputEvent({type:'mouseUp',x,y,button:'left',clickCount:1});
  scenario[mode]=await evaluate(`({frames:window.__paint,elapsedMs:performance.now()-window.__started,fps:window.__paint*1000/(performance.now()-window.__started),layout:document.querySelector('#network').dataset.layout||'main-thread'})`);
 }
 report.scenarios.push(scenario);}
 await evaluate('window.__controller.dispose()');win.webContents.debugger.detach();fs.mkdirSync('dist',{recursive:true});fs.writeFileSync('dist/graph-performance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));win.close();
 if(report.scenarios.some(s=>s.current.fps<25))process.exitCode=1;
}).catch(error=>{console.error(error);app.exit(1);});
