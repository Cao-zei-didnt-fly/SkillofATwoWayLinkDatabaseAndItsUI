const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');

function preferredInstallDirectory(exists=fs.existsSync){return exists('D:\\')?'D:\\Link Garden':'C:\\Link Garden';}
function localLayout({root,env=process.env,appData=env.APPDATA||path.join(os.homedir(),'AppData/Roaming')}={}){
 if(!root)throw Error('Application root is required');
 const data=path.resolve(env.LINK_GARDEN_DATA_DIR||path.join(root,'data'));
 return {root:path.resolve(root),data,vault:path.resolve(env.LINK_GARDEN_VAULT||path.join(data,'vault')),customVault:!!env.LINK_GARDEN_VAULT,
  profile:path.join(data,'profile'),session:path.join(data,'profile/session'),integrations:path.join(data,'integrations'),
  logs:path.join(data,'logs'),crashDumps:path.join(data,'crash-dumps'),temp:path.join(data,'tmp'),
  legacy:path.join(appData,'Link Garden'),marker:path.join(data,'.layout.json')};
}
function copyMissing(source,target,report,prefix=''){
 if(!fs.existsSync(source))return;
 if(fs.lstatSync(source).isSymbolicLink()){report.skipped.push(prefix||source);return;}
 fs.mkdirSync(target,{recursive:true});
 for(const entry of fs.readdirSync(source,{withFileTypes:true})){
  if(entry.name==='.link-garden')continue; // Rebuild indexes; never copy a live SQLite WAL database.
  const from=path.join(source,entry.name),to=path.join(target,entry.name),label=path.join(prefix,entry.name);
  if(entry.isSymbolicLink()){report.skipped.push(label);continue;}
  if(entry.isDirectory()){copyMissing(from,to,report,label);continue;}
  if(!entry.isFile())continue;
  if(fs.existsSync(to)){if(!fs.lstatSync(to).isFile()||!fs.readFileSync(from).equals(fs.readFileSync(to)))report.conflicts.push(label);continue;}
  fs.copyFileSync(from,to,fs.constants.COPYFILE_EXCL);report.copied++;
 }
}
function prepareLocalData(layout,{migrate=true}={}){
 for(const folder of [layout.data,layout.profile,layout.session,layout.integrations,layout.logs,layout.crashDumps,layout.temp])fs.mkdirSync(folder,{recursive:true});
 // Fail visibly rather than silently sending new data back to AppData when an installation is read-only.
 const probe=path.join(layout.data,'.write-check-'+process.pid);fs.writeFileSync(probe,'',{flag:'wx'});fs.unlinkSync(probe);
 if(fs.existsSync(layout.marker)){try{return JSON.parse(fs.readFileSync(layout.marker,'utf8'));}catch{throw Error('data/.layout.json 无法读取，请保留文件并检查；不会自动回退到 C 盘。');}}
 const report={version:1,data:layout.data,createdAt:new Date().toISOString(),legacySource:layout.legacy,copied:0,conflicts:[],skipped:[],originalsPreserved:true};
 if(migrate&&!layout.customVault&&path.resolve(layout.legacy)!==path.resolve(layout.data)){
  copyMissing(path.join(layout.legacy,'vault'),layout.vault,report,'vault');
  copyMissing(path.join(layout.legacy,'integrations'),layout.integrations,report,'integrations');
  copyMissing(path.join(layout.legacy,'Local Storage'),path.join(layout.profile,'Local Storage'),report,'profile/Local Storage');
  const preferences=path.join(layout.legacy,'Preferences'),target=path.join(layout.profile,'Preferences');
  if(fs.existsSync(preferences)&&fs.lstatSync(preferences).isFile()&&!fs.existsSync(target)){fs.copyFileSync(preferences,target,fs.constants.COPYFILE_EXCL);report.copied++;}
 }
 fs.writeFileSync(layout.marker,JSON.stringify(report,null,2),{flag:'wx'});return report;
}
module.exports={preferredInstallDirectory,localLayout,prepareLocalData};
