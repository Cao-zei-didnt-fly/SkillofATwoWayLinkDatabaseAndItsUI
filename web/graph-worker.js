import {forceSimulation,forceManyBody,forceLink,forceCenter,forceCollide} from 'd3-force';

let simulation,nodes=[],timer=0,paused=false,interacting=false,repulsion=210,epoch=0;
function publish(){const positions=new Float32Array(nodes.length*2);for(let i=0;i<nodes.length;i++){positions[i*2]=nodes[i].x;positions[i*2+1]=nodes[i].y;}postMessage({type:'positions',positions,epoch},[positions.buffer]);}
function schedule(){if(timer||paused||interacting||!simulation||simulation.alpha()<.02)return;timer=setTimeout(tick,40);}
function tick(){timer=0;if(paused||interacting)return;simulation.tick();publish();schedule();}
self.onmessage=({data})=>{
 if(data.type==='init'){
  clearTimeout(timer);timer=0;nodes=data.nodes;
  simulation=forceSimulation(nodes).stop().alphaDecay(.045).alphaMin(.02).velocityDecay(.45)
   .force('charge',forceManyBody().strength(-repulsion).theta(1.1).distanceMax(650))
   .force('link',forceLink(data.edges).id(n=>n.id).distance(90).strength(.16))
   .force('center',forceCenter()).force('collide',forceCollide(n=>n.radius+10).iterations(1));
  publish();schedule();
 }else if(data.type==='interaction'){
  interacting=data.active;epoch=data.epoch;if(interacting){clearTimeout(timer);timer=0;}else{if(data.node){const n=nodes[data.node.index];n.x=data.node.x;n.y=data.node.y;n.vx=0;n.vy=0;simulation.alpha(.25);}schedule();}
 }else if(data.type==='pause'){paused=data.paused;clearTimeout(timer);timer=0;if(!paused){simulation.alpha(.35);schedule();}}
 else if(data.type==='repulsion'){repulsion=data.value;simulation.force('charge').strength(-repulsion);simulation.alpha(.4);schedule();}
};
