# the server's tray icon, started at sign in by the installer. it only reads the local status
# endpoint (docs/server-monitor.md) and hands start, stop and restart to the service wrapper with
# the admin prompt services need, so it runs with the signed in user's own rights

param(
  [int]$Port = 4991
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# one icon per user session, however many times the shortcut is opened
$createdNew = $false
$mutex = New-Object System.Threading.Mutex($true, 'Local\SandSharkServerTray', [ref]$createdNew)

if (-not $createdNew) {
  exit 0
}

$installDir = $PSScriptRoot
$scriptPath = $PSCommandPath
$serviceExe = Join-Path $installDir 'sandshark-service.exe'
$dataDir = Join-Path $env:ProgramData 'SandShark Server'
$monitorUrl = "http://localhost:$Port/monitor"
$statusUrl = "http://localhost:$Port/monitor/status"
$pollMs = 10000

$appIcon = New-Object System.Drawing.Icon (Join-Path $installDir 'sandshark.ico')
$downIcon = [System.Drawing.SystemIcons]::Warning

$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Icon = $appIcon
$tray.Text = 'SandShark Server'
$tray.Visible = $true

# the tooltip is capped at 63 characters by windows
function Set-TrayText([string]$text) {
  if ($text.Length -gt 63) {
    $text = $text.Substring(0, 63)
  }

  $tray.Text = $text
}

function Invoke-Service([string]$command) {
  try {
    Start-Process -FilePath $serviceExe -ArgumentList $command -Verb RunAs -WindowStyle Hidden
  } catch {
    # declining the admin prompt lands here, which is not an error worth showing
  }
}

function Update-Status {
  # an uninstall removes this script while it runs, so the icon goes with it
  if (-not (Test-Path -LiteralPath $scriptPath)) {
    $tray.Visible = $false
    [System.Windows.Forms.Application]::Exit()
    return
  }

  try {
    $status = Invoke-RestMethod -Uri $statusUrl -TimeoutSec 3 -UseBasicParsing
    $online = @($status.onlineUsers).Count
    $inVoice = 0

    foreach ($channel in @($status.voiceChannels)) {
      $inVoice += $channel.userCount
    }

    $tray.Icon = $appIcon
    Set-TrayText "SandShark Server $($status.version): $online online, $inVoice in voice"
  } catch {
    $tray.Icon = $downIcon
    Set-TrayText 'SandShark Server: not responding'
  }
}

$menu = New-Object System.Windows.Forms.ContextMenuStrip

function Add-MenuItem([string]$label, [scriptblock]$action) {
  $item = $menu.Items.Add($label)
  $item.add_Click($action)
}

Add-MenuItem 'Open Server Monitor' { Start-Process $monitorUrl }
$menu.Items.Add('-') | Out-Null
Add-MenuItem 'Start Server' { Invoke-Service 'start' }
Add-MenuItem 'Stop Server' { Invoke-Service 'stop' }
Add-MenuItem 'Restart Server' { Invoke-Service 'restart' }
$menu.Items.Add('-') | Out-Null
Add-MenuItem 'Open Server Data' { Start-Process -FilePath 'explorer.exe' -ArgumentList "`"$dataDir`"" }
$menu.Items.Add('-') | Out-Null
Add-MenuItem 'Exit' {
  $tray.Visible = $false
  [System.Windows.Forms.Application]::Exit()
}

$tray.ContextMenuStrip = $menu
$tray.add_MouseDoubleClick({ Start-Process $monitorUrl })

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = $pollMs
$timer.add_Tick({ Update-Status })
$timer.Start()

Update-Status

try {
  [System.Windows.Forms.Application]::Run()
} finally {
  $timer.Stop()
  $tray.Dispose()
  $mutex.ReleaseMutex()
}
