param(
  [Parameter(Mandatory = $true)]
  [string]$ImageDir,

  [string]$WorkDir = "C:\tmp\realityscan_job",
  [string]$RealityScanExe = "C:\Program Files\Epic Games\RealityScan_2.1\RealityScan.exe",
  [string]$ProjectName = "RealityScan_preview"
)

$ErrorActionPreference = "Stop"

function Invoke-RealityScan {
  param([string[]]$RealityScanArgs)

  $process = Start-Process -FilePath $RealityScanExe -ArgumentList $RealityScanArgs -PassThru -WindowStyle Hidden
  Wait-Process -Id $process.Id

  if ($process.ExitCode -ne 0 -and $null -ne $process.ExitCode) {
    throw "RealityScan exited with code $($process.ExitCode)."
  }
}

if (-not (Test-Path -LiteralPath $RealityScanExe)) {
  throw "RealityScan executable was not found: $RealityScanExe"
}

if (-not (Test-Path -LiteralPath $ImageDir)) {
  throw "Image directory was not found: $ImageDir"
}

New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null

$safeImageDir = Join-Path $WorkDir "images"
New-Item -ItemType Directory -Force -Path $safeImageDir | Out-Null

robocopy $ImageDir $safeImageDir *.jpg *.jpeg *.png *.tif *.tiff /E /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -gt 7) {
  throw "robocopy failed with exit code $LASTEXITCODE."
}

$projectPath = Join-Path $WorkDir "$ProjectName.rsproj"
$objPath = Join-Path $WorkDir "$ProjectName.obj"
$zipPath = Join-Path $WorkDir "$ProjectName.zip"

Invoke-RealityScan @(
  "-headless",
  "-newScene",
  "-addFolder", $safeImageDir,
  "-align",
  "-selectMaximalComponent",
  "-setReconstructionRegionAuto",
  "-calculatePreviewModel",
  "-save", $projectPath,
  "-quit"
)

Invoke-RealityScan @(
  "-headless",
  "-load", $projectPath,
  "-selectMaximalComponent",
  "-exportSelectedModel", $objPath,
  "-save", $projectPath,
  "-quit"
)

$mtlPath = [System.IO.Path]::ChangeExtension($objPath, ".mtl")
$rsInfoPath = "$objPath.rsInfo"
$zipInputs = @($projectPath, $objPath, $mtlPath, $rsInfoPath) | Where-Object { Test-Path -LiteralPath $_ }

if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

Compress-Archive -LiteralPath $zipInputs -DestinationPath $zipPath -Force

Write-Host "RealityScan project: $projectPath"
Write-Host "RealityScan OBJ: $objPath"
Write-Host "RealityScan ZIP: $zipPath"
