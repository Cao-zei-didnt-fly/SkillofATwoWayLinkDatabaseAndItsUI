import fs from 'node:fs';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {Store} from '../src/store.js';
const count=Number(process.argv[2]||5000),root=path.resolve('dist/fixtures/large-vault');
if(!Number.isInteger(count)||count<100||count>50000)throw Error('Choose 100–50000 documents');
const source=JSON.parse(fs.readFileSync('dist/fixtures/local-model-notes.json','utf8'));
fs.mkdirSync(root,{recursive:true});
for(let i=0;i<count;i++){
 const n=source.notes[i%source.notes.length],id='sample-'+String(i).padStart(5,'0'),target=j=>'sample-'+String((j+count)%count).padStart(5,'0');
 const metadata=JSON.stringify({title:n.title+' · '+i,category:n.category,tags:n.tags,status:['待整理','进行中','已完成'][i%3]});
 fs.writeFileSync(path.join(root,id+'.md'),'---\n'+metadata+'\n---\n'+n.body+`\n\n测试编号：${i}，批次：${Math.floor(i/24)}。\n\n关联：[[${target(i-1)}]] · [[${target(i-24)}]] · [[${target(i+7)}]]\n`);
}
let start=performance.now();const store=new Store(root);const indexingMs=performance.now()-start;
const queries=['登录','索引','全文','MCP','节点','中文','备份','文件','版本','测试编号'];const timings=[];let excerptCount=0;
for(let i=0;i<40;i++){start=performance.now();const result=store.execute({action:'search',query:queries[i%queries.length],limit:20});timings.push(performance.now()-start);excerptCount+=result.items.reduce((n,r)=>n+r.matches.length,0);}
timings.sort((a,b)=>a-b);start=performance.now();const graph=store.execute({action:'graph',limit:1000});const graphMs=performance.now()-start;
fs.appendFileSync(path.join(root,'sample-00000.md'),'\n增量验证唯一短语\n');start=performance.now();const sync=store.execute({action:'reindex'});const incrementalMs=performance.now()-start;
if(store.execute({action:'search',query:'增量验证唯一短语'}).total!==1)throw Error('Incremental search failed');
store.close();start=performance.now();const reopened=new Store(root);const reopenMs=performance.now()-start;reopened.close();
const report={documents:count,localModel:source.model,localModelSeedNotes:source.notes.length,fixtureMethod:'Deterministic expansion of local-model seeds; not all documents independently model-authored',indexingMs,p50SearchMs:timings[20],p95SearchMs:timings[38],excerptCount,graphMs,graphNodes:graph.nodes.length,graphEdges:graph.edges.length,incrementalMs,updatedFiles:sync.updated,reopenMs};
fs.writeFileSync('dist/fixtures/benchmark.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
