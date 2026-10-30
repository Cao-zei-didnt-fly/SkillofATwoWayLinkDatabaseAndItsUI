!include "nsDialogs.nsh"
!include "LogicLib.nsh"

!ifndef BUILD_UNINSTALLER
Var GardenClients
Var GardenRequired
Var GardenDefaultDir
!macro customInstallMode
  StrCpy $installMode CurrentUser
  SetShellVarContext current
  StrCpy $INSTDIR $GardenDefaultDir
  !insertmacro GetDParameter $R0
  ${If} $R0 != ""
    StrCpy $INSTDIR $R0
  ${EndIf}
  Abort
!macroend
!macro customInit
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_OK|MB_ICONSTOP "Link Garden requires Windows 10 or Windows 11 (64-bit)."
    Abort
  ${EndIf}
  StrCpy $GardenDefaultDir $INSTDIR
  ${IfNot} ${FileExists} "$INSTDIR\data\.layout.json"
    System::Call 'Kernel32::GetFileAttributesW(w "D:\") i.r0'
    ${If} $0 != -1
      StrCpy $GardenDefaultDir "D:\Link Garden"
    ${Else}
      StrCpy $GardenDefaultDir "C:\Link Garden"
    ${EndIf}
  ${EndIf}
  !insertmacro GetDParameter $R0
  ${If} $R0 != ""
    StrCpy $GardenDefaultDir $R0
  ${EndIf}
  StrCpy $INSTDIR $GardenDefaultDir
  StrCpy $GardenClients "codex,workbuddy,codebuddy,cursor,claude-desktop,vscode,cline"
!macroend
!macro customPageAfterChangeDir
  Page custom GardenAgentPage
!macroend
Function GardenAgentPage
  nsDialogs::Create 1018
  Pop $0
  ${NSD_CreateCheckbox} 0 0 100% 24u "必选：让 Agent 在用户级全局注册 / 核验 MCP，并完成客户端信任授权"
  Pop $GardenRequired
  ${NSD_Check} $GardenRequired
  EnableWindow $GardenRequired 0
  ${NSD_CreateLabel} 0 34u 100% 30u "安装器仅生成本机 REGISTER-MCP.md，不再默认代写 Agent 配置。已有 0.3 配置也必须经过 Agent 全局核验。"
  Pop $0
  ${NSD_CreateLabel} 0 72u 100% 26u "支持说明：Codex、WorkBuddy、CodeBuddy、Cursor、Claude Desktop、VS Code/Copilot、Cline。其他客户端按注册指南处理。"
  Pop $0
  ${NSD_CreateLabel} 0 108u 100% 52u "安装完成后：打开 Link Garden → 连接 AI → 复制必做的全局注册指令 → 粘贴给目标 Agent。它需要报告全局配置位置、信任状态、握手与只读调用结果。"
  Pop $0
  ${NSD_CreateLabel} 0 166u 100% 25u "全局注册不等于已获信任；客户端要求用户确认时仍须按提示授权。不会关闭沙箱或自动放行其他工具。"
  Pop $0
  nsDialogs::Show
FunctionEnd
!macro customInstall
  DetailPrint "Preparing required global self-registration guide..."
  ReadEnvStr $R8 "ELECTRON_RUN_AS_NODE"
  System::Call 'Kernel32::SetEnvironmentVariableW(w "ELECTRON_RUN_AS_NODE", w "1")'
  nsExec::ExecToLog '"$INSTDIR\Link Garden.exe" "$INSTDIR\resources\app.asar\src\integration-entry.js" --clients "$GardenClients"'
  Pop $0
  ${If} $R8 == ""
    System::Call 'Kernel32::SetEnvironmentVariableW(w "ELECTRON_RUN_AS_NODE", p 0)'
  ${Else}
    System::Call 'Kernel32::SetEnvironmentVariableW(w "ELECTRON_RUN_AS_NODE", w "$R8")'
  ${EndIf}
  ${If} $0 != 0
    DetailPrint "Open Link Garden > Connect AI to regenerate REGISTER-MCP.md."
  ${EndIf}
!macroend
!endif

!macro customUnInstall
  ${IfNot} ${isUpdated}
    ReadEnvStr $R8 "ELECTRON_RUN_AS_NODE"
    System::Call 'Kernel32::SetEnvironmentVariableW(w "ELECTRON_RUN_AS_NODE", w "1")'
    nsExec::ExecToLog '"$INSTDIR\Link Garden.exe" "$INSTDIR\resources\app.asar\src\integration-entry.js" --remove-all'
    Pop $0
    ${If} $R8 == ""
      System::Call 'Kernel32::SetEnvironmentVariableW(w "ELECTRON_RUN_AS_NODE", p 0)'
    ${Else}
      System::Call 'Kernel32::SetEnvironmentVariableW(w "ELECTRON_RUN_AS_NODE", w "$R8")'
    ${EndIf}
    ${If} $0 != 0
      DetailPrint "Modified agent entries were preserved. See $INSTDIR\data\integrations\uninstall-report.json."
    ${EndIf}
  ${EndIf}
!macroend

# Only explicitly owned program files are removed. Never recursively remove INSTDIR or its data directory.
!include "owned-files.nsh"
!macro customRemoveFiles
  GetFullPathName $R5 "$INSTDIR"
  ${If} $R5 == ""
    Abort "Invalid installation path"
  ${EndIf}
  StrLen $R0 $R5
  ${If} $R0 < 4
    Abort "Refusing to remove a drive root"
  ${EndIf}
  ${IfNot} ${FileExists} "$INSTDIR\resources\app.asar"
    Abort "Program marker missing; data and other files were preserved"
  ${EndIf}
  GetFullPathName $R6 "$INSTDIR\resources"
  ${If} $R6 != "$R5\resources"
    Abort "Unsafe resources path"
  ${EndIf}
  System::Call 'Kernel32::GetFileAttributesW(w "$R6") i.r0'
  IntOp $R0 $R0 & 0x400
  ${If} $R0 != 0
    Abort "Resources is a reparse point; automatic removal was cancelled"
  ${EndIf}
  GetFullPathName $R6 "$INSTDIR\locales"
  ${If} $R6 != "$R5\locales"
    Abort "Unsafe locales path"
  ${EndIf}
  System::Call 'Kernel32::GetFileAttributesW(w "$R6") i.r0'
  IntOp $R0 $R0 & 0x400
  ${If} $R0 != 0
    Abort "Locales is a reparse point; automatic removal was cancelled"
  ${EndIf}
  SetOutPath $TEMP
  RMDir /r "$INSTDIR\resources"
  RMDir /r "$INSTDIR\locales"
  !insertmacro GardenRemoveOwnedRootFiles
  RMDir "$INSTDIR"
!macroend
