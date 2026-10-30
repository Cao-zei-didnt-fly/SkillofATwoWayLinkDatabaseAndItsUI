import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const executable=process.env.LMS_PATH||path.join(os.homedir(),'.lmstudio/bin/lms.exe');
const model=process.env.LMS_MODEL||'3.8';
const output=path.resolve(process.argv[2]||'dist/fixtures');fs.mkdirSync(output,{recursive:true});
const prompt='生成24篇用于Markdown知识库检索测试的中文笔记，只返回JSON数组，不要思考过程，不要代码围栏。每项字段为title（简短标题）、category（从工程、研究、产品、知识管理选择）、tags（2个扁平中文标签）、body（80到120个中文字，有具体概念和操作细节，包含Markdown标题与两段正文）。主题要覆盖身份认证、登录失败、访问控制、全文搜索、中文分词、SQLite索引、双向链接、力导向网络、节点斥力、上下文管理、MCP、本地模型、版本冲突、文件同步、产品设计、研究记录、备份、数据迁移、看板、测试、缓存、增量更新、知识分类、检索评估。不要生成摘要。';
const child=spawn(executable,['chat',model,'--dont-fetch-catalog','--reasoning','off','--prompt',prompt],{stdio:['ignore','pipe','pipe'],windowsHide:true});
let stdout='',stderr='';child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);
const timer=setTimeout(()=>{child.kill();console.error('Local generation timed out');},240000);
child.on('error',error=>{clearTimeout(timer);console.error(error);process.exitCode=1;});
child.on('close',code=>{clearTimeout(timer);fs.writeFileSync(path.join(output,'lmstudio-response.txt'),stdout);if(code!==0){console.error(stderr.slice(-2000));process.exitCode=1;return;}
 const clean=stdout.replace(/\x1b\[[0-9;]*m/g,'').replace(/<think>[\s\S]*?<\/think>/g,'');let notes;
 for(let a=clean.indexOf('[');a>=0&&!notes;a=clean.indexOf('[',a+1)){for(let b=clean.lastIndexOf(']');b>a;b=clean.lastIndexOf(']',b-1)){try{const data=JSON.parse(clean.slice(a,b+1));if(Array.isArray(data)&&data.length>=12&&data.every(n=>typeof n.title==='string'&&typeof n.body==='string'&&Array.isArray(n.tags))){notes=data;break;}}catch{}}}
 if(!notes){console.error('Model did not return valid note JSON; raw output preserved');process.exitCode=1;return;}
 fs.writeFileSync(path.join(output,'local-model-notes.json'),JSON.stringify({model,executable,generatedAt:new Date().toISOString(),notes},null,2));console.log(`Generated ${notes.length} local-model notes in ${output}`);
});
