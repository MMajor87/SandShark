$ErrorActionPreference = 'Stop'

$projectPath = Join-Path $PSScriptRoot 'process-audio-capture\ProcessAudioCapture.csproj'
$outputPath = Join-Path $PSScriptRoot 'bin'

dotnet publish $projectPath --configuration Release --output $outputPath
