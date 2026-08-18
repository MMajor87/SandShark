param(
  [string]$ExecutablePath = "release\win-unpacked\SandShark.exe",
  [int]$StartupSeconds = 8
)

$ErrorActionPreference = "Stop"

$resolvedExecutable = Resolve-Path -LiteralPath $ExecutablePath -ErrorAction Stop
$userDataDir = Join-Path ([System.IO.Path]::GetTempPath()) ("sandshark-smoke-" + [Guid]::NewGuid().ToString("N"))

function Stop-ProcessTree {
  param([int]$ProcessId)

  $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $ProcessId" -ErrorAction SilentlyContinue
  foreach ($child in $children) {
    Stop-ProcessTree -ProcessId $child.ProcessId
  }

  Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

New-Item -ItemType Directory -Path $userDataDir | Out-Null

try {
  $process = Start-Process `
    -FilePath $resolvedExecutable `
    -ArgumentList @("--sandshark-smoke-user-data-dir=$userDataDir", "--sandshark-smoke-test") `
    -WindowStyle Hidden `
    -PassThru

  Start-Sleep -Seconds $StartupSeconds

  if ($process.HasExited) {
    throw "SandShark exited during packaged startup smoke test with code $($process.ExitCode)."
  }

  [PSCustomObject]@{
    Path = $resolvedExecutable.Path
    ProcessId = $process.Id
    StartupSeconds = $StartupSeconds
    Status = "Running"
  } | Format-List
} finally {
  if ($process -and -not $process.HasExited) {
    Stop-ProcessTree -ProcessId $process.Id
  }

  Remove-Item -LiteralPath $userDataDir -Recurse -Force -ErrorAction SilentlyContinue
}
