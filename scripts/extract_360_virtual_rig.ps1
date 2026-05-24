param(
  [Parameter(Mandatory = $true)]
  [string]$VideoPath,

  [string]$OutputDir = "C:\tmp\rs_virtual_rig",
  [int]$FrameCount = 80,
  [int]$ImageSize = 1600,
  [int]$Fov = 100
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $VideoPath)) {
  throw "Video was not found: $VideoPath"
}

$ffmpeg = Get-Command ffmpeg -ErrorAction Stop
$ffprobe = Get-Command ffprobe -ErrorAction Stop

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$imageDir = Join-Path $OutputDir "images"
New-Item -ItemType Directory -Force -Path $imageDir | Out-Null

$fpsText = & $ffprobe.Source -v error -select_streams v:0 -show_entries stream=avg_frame_rate -of default=nokey=1:noprint_wrappers=1 $VideoPath
$durationText = & $ffprobe.Source -v error -show_entries format=duration -of default=nokey=1:noprint_wrappers=1 $VideoPath

$fpsParts = $fpsText.Split("/")
if ($fpsParts.Count -eq 2) {
  $fps = [double]$fpsParts[0] / [double]$fpsParts[1]
} else {
  $fps = [double]$fpsText
}

$duration = [double]$durationText
$totalFrames = [math]::Max(1, [math]::Floor($fps * $duration))
$interval = [math]::Max(1, [math]::Floor($totalFrames / $FrameCount))

$rig = @(
  @{ Name = "p-35_y000"; Yaw = 0; Pitch = -35 },
  @{ Name = "p-35_y045"; Yaw = 45; Pitch = -35 },
  @{ Name = "p-35_y090"; Yaw = 90; Pitch = -35 },
  @{ Name = "p-35_y135"; Yaw = 135; Pitch = -35 },
  @{ Name = "p-35_y180"; Yaw = 180; Pitch = -35 },
  @{ Name = "p-35_y225"; Yaw = -135; Pitch = -35 },
  @{ Name = "p-35_y270"; Yaw = -90; Pitch = -35 },
  @{ Name = "p-35_y315"; Yaw = -45; Pitch = -35 },
  @{ Name = "p000_y000"; Yaw = 0; Pitch = 0 },
  @{ Name = "p000_y045"; Yaw = 45; Pitch = 0 },
  @{ Name = "p000_y090"; Yaw = 90; Pitch = 0 },
  @{ Name = "p000_y135"; Yaw = 135; Pitch = 0 },
  @{ Name = "p000_y180"; Yaw = 180; Pitch = 0 },
  @{ Name = "p000_y225"; Yaw = -135; Pitch = 0 },
  @{ Name = "p000_y270"; Yaw = -90; Pitch = 0 },
  @{ Name = "p000_y315"; Yaw = -45; Pitch = 0 },
  @{ Name = "p035_y000"; Yaw = 0; Pitch = 35 },
  @{ Name = "p035_y045"; Yaw = 45; Pitch = 35 },
  @{ Name = "p035_y090"; Yaw = 90; Pitch = 35 },
  @{ Name = "p035_y135"; Yaw = 135; Pitch = 35 },
  @{ Name = "p035_y180"; Yaw = 180; Pitch = 35 },
  @{ Name = "p035_y225"; Yaw = -135; Pitch = 35 },
  @{ Name = "p035_y270"; Yaw = -90; Pitch = 35 },
  @{ Name = "p035_y315"; Yaw = -45; Pitch = 35 }
)

$selectExpr = "not(mod(n\,$interval))"

foreach ($camera in $rig) {
  $outPattern = Join-Path $imageDir ("frame_%04d_" + $camera.Name + ".jpg")
  $filter = "select='$selectExpr',v360=input=e:output=flat:w=${ImageSize}:h=${ImageSize}:yaw=$($camera.Yaw):pitch=$($camera.Pitch):h_fov=${Fov}:v_fov=${Fov}"

  & $ffmpeg.Source -hide_banner -loglevel error -y -i $VideoPath -vf $filter -vsync vfr -q:v 2 -frames:v $FrameCount $outPattern
  if ($LASTEXITCODE -ne 0) {
    throw "ffmpeg failed for virtual camera $($camera.Name)."
  }
}

$manifest = [ordered]@{
  sourceVideo = $VideoPath
  outputDir = $OutputDir
  imageDir = $imageDir
  frameCount = $FrameCount
  imageSize = $ImageSize
  fov = $Fov
  fps = $fps
  durationSeconds = $duration
  totalFrames = $totalFrames
  frameInterval = $interval
  virtualCameraCount = $rig.Count
  expectedImageCount = $FrameCount * $rig.Count
  rig = $rig
}

$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $OutputDir "virtual_rig_manifest.json") -Encoding UTF8

Write-Host "Virtual rig images: $imageDir"
Write-Host "Expected images: $($FrameCount * $rig.Count)"
Write-Host "Frame interval: $interval"
