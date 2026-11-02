const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
app.setName('Link Garden');
try {
const {localLayout,prepareLocalData}=require('../src/paths.cjs');
const layout=localLayout({root:app.isPackaged?path.dirname(process.execPath):path.join(__dirname,'..'),appData:app.getPath('appData')});
const migration=prepareLocalData(layout);
app.setPath('userData',layout.profile);
app.setPath('sessionData',layout.session);
app.setAppLogsPath(layout.logs);
app.setPath('crashDumps',layout.crashDumps);
app.setPath('temp',layout.temp);
process.env.TEMP=layout.temp;process.env.TMP=layout.temp;
let window;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if(window.isMinimized()) window.restore(); window.focus(); } });
  app.on('window-all-closed', () => app.quit());
  app.whenReady().then(async () => {
    const { Store } = await import('../src/store.js');
    const vault = layout.vault;
    if (!fs.existsSync(vault)) {
      const seed = app.isPackaged ? path.join(process.resourcesPath,'vault') : path.join(__dirname,'../vault');
      fs.cpSync(seed,vault,{recursive:true});
    }
    const store = new Store(vault);
    app.once('will-quit',()=>store.close());
    const {connectionConfig}=await import('../src/connection.js');
    const {AgentManager}=await import('../src/agents.js');
    const {prepareAgents,verifyMcp}=await import('../src/integration-runtime.js');
    const integrationOptions={executable:process.execPath,entry:app.isPackaged?path.join(process.resourcesPath,'app.asar/src/mcp-entry.js'):path.join(__dirname,'../src/mcp-entry.js'),vault,skill:app.isPackaged?path.join(process.resourcesPath,'skills/link-garden'):path.join(__dirname,'../skills/link-garden'),stateDir:layout.integrations};
    const agentManager=new AgentManager(integrationOptions);
    const trusted=event=>event.sender===window?.webContents&&event.senderFrame===window.webContents.mainFrame;
    ipcMain.handle('garden:storage',async(event,operation)=>{if(!trusted(event))throw Error('Unknown window');if(operation.action==='open'){const error=await shell.openPath(layout.data);if(error)throw Error(error);}return {data:layout.data,vault:layout.vault,profile:layout.profile,integrations:layout.integrations,migration};});
    ipcMain.handle('garden:agents',async(event,operation)=>{
      if(!trusted(event))throw Error('Unknown window');
      if(operation.action==='list')return {clients:agentManager.list(),guide:agentManager.exportGuide()};
      if(operation.action==='install')return prepareAgents(agentManager,operation.ids||[]);
      if(operation.action==='remove')return agentManager.remove(operation.id);
      if(operation.action==='verify')return verifyMcp(agentManager);
      if(operation.action==='guide'){const guide=agentManager.exportGuide();const error=await shell.openPath(guide.path);if(error)throw Error(error);return guide;}
      throw Error('Unknown integration action');
    });
    ipcMain.handle('garden:connection',event=>{
      if(event.sender!==window?.webContents||event.senderFrame!==window.webContents.mainFrame)throw Error('Unknown window');
      return connectionConfig({executable:process.execPath,entry:app.isPackaged?path.join(process.resourcesPath,'app.asar/src/mcp-entry.js'):path.join(__dirname,'../src/mcp-entry.js'),vault,skill:app.isPackaged?path.join(process.resourcesPath,'skills/link-garden'):path.join(__dirname,'../skills/link-garden')});
    });
    ipcMain.handle('garden:execute', (event,operation) => {
      if(event.sender !== window?.webContents || event.senderFrame !== window.webContents.mainFrame) return {ok:false,error:'Unknown window'};
      try { return {ok:true,result:store.execute(operation)}; } catch(error) {return {ok:false,error:error.message};}
    });
    window = new BrowserWindow({width:1250,height:850,minWidth:760,minHeight:540,show:false,title:'Link Garden',icon:path.join(__dirname,'../assets/icon.png'),backgroundColor:'#f5f6f2',webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
    window.setMenu(null);
    const openExternal=url=>{try{const parsed=new URL(url);if(['http:','https:','mailto:'].includes(parsed.protocol))void shell.openExternal(url).catch(()=>{});}catch{}};
    window.webContents.setWindowOpenHandler(({url})=>{openExternal(url);return {action:'deny'};});
    window.webContents.on('will-navigate',(event,url)=>{const current=window.webContents.getURL();try{const from=new URL(current),to=new URL(url);if(from.protocol===to.protocol&&from.host===to.host&&from.pathname===to.pathname)return;}catch{}if(url===current)return;event.preventDefault();openExternal(url);});
    window.once('ready-to-show',()=>window.show());
    window.on('closed',()=>{window=null;});
    await window.loadFile(path.join(__dirname,'../web/index.html'));
  }).catch(error=>{dialog.showErrorBox('Link Garden 启动失败',error.message);app.quit();});
}

}catch(error){dialog.showErrorBox('Link Garden 本地数据目录不可用',error.message+'\n请选择可写的安装目录；不会自动回退到 AppData。');app.quit();}
