import {quadtree} from 'd3-quadtree';

export function mountGraph(root,graph,{open,selected}={}) {
 const canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d',{alpha:false}),tip=root.querySelector('.graph-tooltip');
 const nodes=graph.nodes.map((n,i)=>({...n,index:i,x:Math.cos(i*2.399963)*Math.sqrt(i+1)*22,y:Math.sin(i*2.399963)*Math.sqrt(i+1)*22})),map=new Map(nodes.map(n=>[n.id,n]));
 const edges=graph.edges.filter(e=>map.has(e.source)&&map.has(e.target)).map(e=>({source:map.get(e.source),target:map.get(e.target)}));
 const adjacent=nodes.map(()=>new Set());for(const e of edges){adjacent[e.source.index].add(e.target.index);adjacent[e.target.index].add(e.source.index);}
 for(const n of nodes)n.radius=5+Math.min(7,Math.sqrt(adjacent[n.index].size)*1.5);
 let width=800,height=500,scale=1,panX=400,panY=250,hover=null,gesture=null,disposed=false,frame=0,paused=false,worker=null,tree=null,treeDirty=true,epoch=0;
 let rect=canvas.getBoundingClientRect(),accent='#246451',background='#f5f7f3',pendingPointer=null,hoverX=0,hoverY=0;
 const stats={frames:0,maxRenderMs:0,totalRenderMs:0,workerUpdates:0};let publishedAt=0,lastPublishedFrames=0;
 function theme(){const style=getComputedStyle(root);accent=style.getPropertyValue('--accent').trim()||'#246451';background=style.getPropertyValue('--soft').trim()||'#f5f7f3';draw();}
 function draw(){if(disposed||frame)return;frame=requestAnimationFrame(()=>{frame=0;render();});}
 function point(e){return {x:e.clientX-rect.left,y:e.clientY-rect.top};}
 function hit(p){if(treeDirty){tree=quadtree(nodes,n=>n.x,n=>n.y);treeDirty=false;}return tree.find((p.x-panX)/scale,(p.y-panY)/scale,18/scale);}
 function setHover(n,p){tip.hidden=!n;if(hover!==n){hover=n||null;tip.textContent=n?n.title+' · '+adjacent[n.index].size+' 条关联':'';tip.hidden=!n;canvas.style.cursor=n?'pointer':'grab';}
  if(n){const x=Math.max(8,Math.min(width-210,p.x+12)),y=Math.max(8,p.y-40);if(x!==hoverX||y!==hoverY){hoverX=x;hoverY=y;tip.style.transform=`translate(${x}px,${y}px)`;}}
 }
 function render(){if(disposed)return;const started=performance.now();
  if(pendingPointer&&!gesture){const p=pendingPointer;pendingPointer=null;setHover(hit(p),p);}
  ctx.fillStyle=background;ctx.fillRect(0,0,width,height);ctx.save();ctx.translate(panX,panY);ctx.scale(scale,scale);
  const neighbors=hover?adjacent[hover.index]:null;const active=e=>hover&&(e.source===hover||e.target===hover);
  ctx.lineWidth=1/scale;ctx.strokeStyle='#a6b9ae';ctx.globalAlpha=hover?.16:.42;ctx.beginPath();
  for(const e of edges)if(!active(e)){ctx.moveTo(e.source.x,e.source.y);ctx.lineTo(e.target.x,e.target.y);}ctx.stroke();
  if(hover){ctx.globalAlpha=.85;ctx.strokeStyle=accent;ctx.beginPath();for(const e of edges)if(active(e)){ctx.moveTo(e.source.x,e.source.y);ctx.lineTo(e.target.x,e.target.y);}ctx.stroke();}
  const visible=n=>{const x=n.x*scale+panX,y=n.y*scale+panY;return x>-40&&x<width+40&&y>-40&&y<height+40;};
  const circle=n=>{const r=Math.max(n.radius,2.2/scale);ctx.moveTo(n.x+r,n.y);ctx.arc(n.x,n.y,r,0,Math.PI*2);};
  ctx.fillStyle=accent;ctx.globalAlpha=hover?.32:1;ctx.beginPath();for(const n of nodes)if(n.id!==selected&&visible(n)&&(!hover||(n!==hover&&!neighbors.has(n.index))))circle(n);ctx.fill();
  if(hover){ctx.globalAlpha=1;ctx.beginPath();for(const index of neighbors){const n=nodes[index];if(n.id!==selected&&visible(n))circle(n);}if(hover.id!==selected)circle(hover);ctx.fill();}
  const current=map.get(selected);if(current&&visible(current)){ctx.fillStyle='#c78d3f';ctx.globalAlpha=1;ctx.beginPath();circle(current);ctx.fill();}
  ctx.globalAlpha=1;ctx.font=`${12/scale}px "Microsoft YaHei",sans-serif`;ctx.textAlign='center';ctx.textBaseline='top';ctx.fillStyle='#34473d';
  let labels=0;for(const n of nodes)if(visible(n)&&(n===hover||n.id===selected||(!gesture&&labels<30&&(nodes.length<35||scale>1.7)))){ctx.fillText(n.title,n.x,n.y+n.radius+8/scale);labels++;}
  if(hover){ctx.strokeStyle=accent;ctx.lineWidth=1.5/scale;ctx.beginPath();ctx.arc(hover.x,hover.y,Math.max(hover.radius,2.2/scale)+5/scale,0,Math.PI*2);ctx.stroke();}
  ctx.restore();stats.frames++;const elapsed=performance.now()-started;stats.maxRenderMs=Math.max(stats.maxRenderMs,elapsed);stats.totalRenderMs+=elapsed;
  root.dataset.scale=scale.toFixed(3);root.dataset.pan=`${panX.toFixed(1)},${panY.toFixed(1)}`;
  if(performance.now()-publishedAt>500){const dt=performance.now()-publishedAt;root.dataset.frames=String(stats.frames);root.dataset.maxRenderMs=stats.maxRenderMs.toFixed(2);const status=root.querySelector('[data-graph="performance"]');if(status)status.textContent=`${worker?'后台布局':'静态布局'} · ${Math.round((stats.frames-lastPublishedFrames)*1000/dt)} 帧/秒`;lastPublishedFrames=stats.frames;publishedAt=performance.now();}
 }
 function fit(){if(!nodes.length){scale=1;panX=width/2;panY=height/2;}else{let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(const n of nodes){minX=Math.min(minX,n.x);maxX=Math.max(maxX,n.x);minY=Math.min(minY,n.y);maxY=Math.max(maxY,n.y);}scale=Math.max(.06,Math.min(2,width/(maxX-minX+100),height/(maxY-minY+100))*.85);panX=width/2-(minX+maxX)/2*scale;panY=height/2-(minY+maxY)/2*scale;}draw();}
 try{worker=new Worker(new URL('./graph-worker.bundle.js',document.baseURI));root.dataset.layout='worker';
  worker.onmessage=({data})=>{if(disposed||data.type!=='positions')return;stats.workerUpdates++;if(gesture||paused||data.epoch!==epoch)return;for(let i=0;i<nodes.length;i++){nodes[i].x=data.positions[i*2];nodes[i].y=data.positions[i*2+1];}treeDirty=true;draw();};
  worker.onerror=()=>{worker?.terminate();worker=null;root.dataset.layout='static';root.querySelector('[data-graph="pause"]').textContent='静态布局';draw();};
  worker.postMessage({type:'init',nodes:nodes.map(n=>({id:n.id,x:n.x,y:n.y,radius:n.radius})),edges:edges.map(e=>({source:e.source.id,target:e.target.id}))});
 }catch{root.dataset.layout='static';}
 const resize=new ResizeObserver(()=>{rect=canvas.getBoundingClientRect();const oldW=width,oldH=height;width=rect.width;height=rect.height;const dpr=Math.min(devicePixelRatio||1,nodes.length>300?1:1.5);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);panX+=(width-oldW)/2;panY+=(height-oldH)/2;draw();});resize.observe(canvas);
 const onScroll=()=>{rect=canvas.getBoundingClientRect();};window.addEventListener('scroll',onScroll,{capture:true,passive:true});
 canvas.onpointerdown=e=>{if(e.button!==0)return;rect=canvas.getBoundingClientRect();const p=point(e);pendingPointer=null;gesture={id:e.pointerId,x:p.x,y:p.y,last:p,node:hit(p),moved:false};canvas.setPointerCapture(e.pointerId);tip.hidden=true;canvas.style.cursor='grabbing';worker?.postMessage({type:'interaction',active:true,epoch:++epoch});};
 canvas.onpointermove=e=>{const p=point(e);if(!gesture){pendingPointer=p;draw();return;}if(e.pointerId!==gesture.id)return;const g=gesture;if(Math.hypot(p.x-g.x,p.y-g.y)>4)g.moved=true;
  if(g.node){g.node.x=(p.x-panX)/scale;g.node.y=(p.y-panY)/scale;treeDirty=true;}else{panX+=p.x-g.last.x;panY+=p.y-g.last.y;}g.last=p;draw();};
 function release(e,cancel=false){if(!gesture||e.pointerId!==gesture.id)return;const g=gesture;gesture=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);canvas.style.cursor='grab';worker?.postMessage({type:'interaction',active:false,epoch,node:g.node?{index:g.node.index,x:g.node.x,y:g.node.y}:undefined});if(!cancel&&!g.moved&&g.node)open(g.node.id);draw();}
 canvas.onpointerup=e=>release(e);canvas.onpointercancel=e=>release(e,true);canvas.onpointerleave=()=>{if(!gesture){pendingPointer=null;hover=null;tip.hidden=true;draw();}};
 function zoom(factor,p={x:width/2,y:height/2}){const next=Math.max(.05,Math.min(8,scale*factor));panX=p.x-(p.x-panX)*next/scale;panY=p.y-(p.y-panY)*next/scale;scale=next;draw();}
 const wheel=e=>{e.preventDefault();rect=canvas.getBoundingClientRect();zoom(Math.exp(-e.deltaY*.0015),point(e));};canvas.addEventListener('wheel',wheel,{passive:false});
 canvas.onkeydown=e=>{if(['+','=','-','0','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();if(e.key==='0')fit();else if(['-','+','='].includes(e.key))zoom(e.key==='-'?.8:1.25);else{panX+=e.key==='ArrowLeft'?40:e.key==='ArrowRight'?-40:0;panY+=e.key==='ArrowUp'?40:e.key==='ArrowDown'?-40:0;draw();}}};
 root.querySelector('[data-graph="fit"]').onclick=fit;root.querySelector('[data-graph="in"]').onclick=()=>zoom(1.25);root.querySelector('[data-graph="out"]').onclick=()=>zoom(.8);
 root.querySelector('[data-graph="pause"]').onclick=e=>{paused=!paused;e.target.textContent=paused?'继续布局':'暂停布局';worker?.postMessage({type:'pause',paused});};
 root.querySelector('[data-graph="repulsion"]').oninput=e=>worker?.postMessage({type:'repulsion',value:Number(e.target.value)});
 const picker=root.querySelector('[data-graph="node"]'),fragment=document.createDocumentFragment();for(const n of nodes){const option=document.createElement('option');option.value=n.id;option.textContent=n.title;fragment.append(option);}picker.append(fragment);
 picker.onchange=()=>{const n=map.get(picker.value);if(n){panX=width/2-n.x*scale;panY=height/2-n.y*scale;setHover(n,{x:width/2,y:height/2});draw();}};root.querySelector('[data-graph="open"]').onclick=()=>{if(picker.value)open(picker.value);};
 const themeObserver=new MutationObserver(theme);themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['style']});theme();fit();
 return {dispose(){disposed=true;worker?.terminate();resize.disconnect();themeObserver.disconnect();window.removeEventListener('scroll',onScroll,true);canvas.removeEventListener('wheel',wheel);cancelAnimationFrame(frame);},snapshot(){return {nodes:nodes.map(n=>({id:n.id,x:n.x,y:n.y})),scale,panX,panY,stats:{...stats}};}};
}
