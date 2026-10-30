param([string]$Executable = (Join-Path $PSScriptRoot '..\dist\win-unpacked\Link Garden.exe'))
$target = (Resolve-Path -LiteralPath $Executable -ErrorAction Stop).Path
$desktopDirectory = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktopDirectory 'Link Garden.lnk'
$shortcutShell = New-Object -ComObject WScript.Shell
$shortcut = $shortcutShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $target
$shortcut.WorkingDirectory = Split-Path -Parent $target
$shortcut.Description = 'Link Garden - Markdown knowledge library'
$shortcut.IconLocation = "$target,0"
$shortcut.Save()
Write-Output $shortcutPath
