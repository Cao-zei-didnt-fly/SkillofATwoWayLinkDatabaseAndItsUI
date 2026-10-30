import fs from 'node:fs';
import path from 'node:path';
const templates=path.resolve('node_modules/app-builder-lib/templates/nsis');
fs.mkdirSync('build',{recursive:true});
// Preserve upstream installer behavior, except for its otherwise unconditional AppData installer cache.
const base=fs.readFileSync(path.join(templates,'installer.nsi'),'utf8')
 .replace('!include "allowOnlyOneInstallerInstance.nsh"','!include "lg-running.nsh"')
 .replace('!include "installSection.nsh"','!include "lg-install-section.nsh"')
 .replace('!insertmacro addLangs','!insertmacro MUI_UNPAGE_CONFIRM\n!insertmacro MUI_UNPAGE_INSTFILES\n!insertmacro addLangs')
 .replace('!ifdef BUILD_UNINSTALLER\n  !include "uninstaller.nsh"\n!endif','!define BUILD_UNINSTALLER\nFunction un._GetProcessInfo\n  !insertmacro FUNC_GETPROCESSINFO\nFunctionEnd\n!include "uninstaller.nsh"');
const section=fs.readFileSync(path.join(templates,'installSection.nsh'),'utf8').replace('!include installer.nsh','!include "lg-install-files.nsh"');
let files=fs.readFileSync(path.join(templates,'include/installer.nsh'),'utf8');
const cache='!insertmacro copyFile "$EXEPATH" "$LOCALAPPDATA\\${APP_INSTALLER_STORE_FILE}"';
if(!files.includes(cache))throw Error('Upstream installer changed; review cache handling before building');
files=files.replace(cache,'# Link Garden: no updater cache or duplicate installer under LocalAppData.');
// Custom scripts embed their own unsigned uninstaller instead of using builder's two-pass signing stage.
files=files.replace('File "/oname=${UNINSTALL_FILENAME}" "${UNINSTALLER_OUT_FILE}"','WriteUninstaller "$INSTDIR\\${UNINSTALL_FILENAME}"');
if(!section.includes('lg-install-files.nsh'))throw Error('Upstream install section changed');
fs.writeFileSync('build/local-installer.nsi',base);fs.writeFileSync('build/lg-install-section.nsh',section);fs.writeFileSync('build/lg-install-files.nsh',files);
let running=fs.readFileSync(path.join(templates,'include/allowOnlyOneInstallerInstance.nsh'),'utf8');
running=running.replace('  Var /GLOBAL CmdPath\n  Var /GLOBAL PowerShellPath','  !ifndef LG_PROCESS_VARS\n    !define LG_PROCESS_VARS\n    Var /GLOBAL CmdPath\n    Var /GLOBAL PowerShellPath\n  !endif').replace('  Var /GLOBAL IsPowerShellAvailable ; 0 = available, 1 = not available','  !ifndef LG_POWERSHELL_VAR\n    !define LG_POWERSHELL_VAR\n    Var /GLOBAL IsPowerShellAvailable\n  !endif');
fs.writeFileSync('build/lg-running.nsh',running.replace(/[ \t]+$/gm,''));
const root=path.resolve('node_modules/electron/dist');
const owned=fs.readdirSync(root,{withFileTypes:true}).filter(e=>e.isFile()).map(e=>e.name==='electron.exe'?'Link Garden.exe':e.name);
for(const name of owned)if(/[\\/"$]/.test(name))throw Error('Unsafe runtime filename');
fs.writeFileSync('build/owned-files.nsh','!macro GardenRemoveOwnedRootFiles\n'+owned.map(name=>'  Delete "$INSTDIR\\'+name+'"').join('\n')+'\n  Delete "$INSTDIR\\${UNINSTALL_FILENAME}"\n!macroend\n');
console.log('Prepared local-data installer; AppData installer cache disabled.');
