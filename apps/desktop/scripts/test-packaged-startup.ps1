param(
  [string]$ExecutablePath = "release\win-unpacked\SandShark.exe",
  [int]$StartupSeconds = 8
)

$ErrorActionPreference = "Stop"

$resolvedExecutable = Resolve-Path -LiteralPath $ExecutablePath -ErrorAction Stop
$userDataDir = Join-Path ([System.IO.Path]::GetTempPath()) ("sandshark-smoke-" + [Guid]::NewGuid().ToString("N"))
$previousElectronRunAsNode = $env:ELECTRON_RUN_AS_NODE
$env:ELECTRON_RUN_AS_NODE = $null
$previousSmokeTest = $env:SANDSHARK_SMOKE_TEST
$previousSmokeUserDataDir = $env:SANDSHARK_SMOKE_USER_DATA_DIR

function Stop-ProcessTree {
  param([int]$ProcessId)

  $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $ProcessId" -ErrorAction SilentlyContinue
  foreach ($child in $children) {
    Stop-ProcessTree -ProcessId $child.ProcessId
  }

  Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

New-Item -ItemType Directory -Path $userDataDir | Out-Null
$env:SANDSHARK_SMOKE_TEST = "1"
$env:SANDSHARK_SMOKE_USER_DATA_DIR = $userDataDir

try {
  $process = Start-Process `
    -FilePath $resolvedExecutable `
    -WindowStyle Hidden `
    -PassThru

  Start-Sleep -Seconds $StartupSeconds

  if ($process.HasExited) {
    throw "SandShark exited during packaged startup smoke test with code $($process.ExitCode)."
  }

  $bridgeResultPath = Join-Path $userDataDir 'smoke-ready.json'
  if (-not (Test-Path -LiteralPath $bridgeResultPath)) {
    throw 'The packaged renderer did not complete its preload/IPC smoke checks.'
  }
  $bridgeResult = Get-Content -LiteralPath $bridgeResultPath -Raw | ConvertFrom-Json
  if (-not $bridgeResult.version -or $null -eq $bridgeResult.hardware.enabled -or $null -eq $bridgeResult.updates.automaticallyCheck -or $null -eq $bridgeResult.behavior.closeToTray) {
    throw 'The packaged desktop bridge returned an incomplete smoke result.'
  }

  [PSCustomObject]@{
    Path = $resolvedExecutable.Path
    ProcessId = $process.Id
    StartupSeconds = $StartupSeconds
    Status = "Running; preload and guarded IPC verified"
    Version = $bridgeResult.version
  } | Format-List
} finally {
  $env:ELECTRON_RUN_AS_NODE = $previousElectronRunAsNode
  $env:SANDSHARK_SMOKE_TEST = $previousSmokeTest
  $env:SANDSHARK_SMOKE_USER_DATA_DIR = $previousSmokeUserDataDir

  if ($process -and -not $process.HasExited) {
    Stop-ProcessTree -ProcessId $process.Id
  }

  $resolvedSmokeData = [System.IO.Path]::GetFullPath($userDataDir)
  $expectedTempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
  if (-not $resolvedSmokeData.StartsWith($expectedTempRoot, [System.StringComparison]::OrdinalIgnoreCase) -or -not ([System.IO.Path]::GetFileName($resolvedSmokeData)).StartsWith('sandshark-smoke-')) { throw 'Unexpected smoke test cleanup path' }
  Remove-Item -LiteralPath $resolvedSmokeData -Recurse -Force -ErrorAction SilentlyContinue
}
