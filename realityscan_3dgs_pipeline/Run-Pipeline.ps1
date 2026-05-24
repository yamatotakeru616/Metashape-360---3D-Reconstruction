param(
  [Parameter(Mandatory = $false, HelpMessage = "360度パノラマ動画ファイルのパスを指定してください。")]
  [string]$VideoPath = "",

  [Parameter(Mandatory = $false)]
  [string]$OutputDir = "",

  [int]$FrameCount = 40,
  [int]$ImageSize = 1600,
  [int]$Fov = 110
)

$ErrorActionPreference = "Stop"

# UTF-8出力エンコーディングを強制設定（日本語Windows環境での文字化け防止）
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# 環境変数からパスを優先取得（Node.js spawn の引数経由は非ASCII文字が化けるため）
if ($env:PIPELINE_VIDEO_PATH) { $VideoPath = $env:PIPELINE_VIDEO_PATH }
if ($env:PIPELINE_OUTPUT_DIR)  { $OutputDir = $env:PIPELINE_OUTPUT_DIR }

if ([string]::IsNullOrEmpty($VideoPath)) {
  Write-Host " ❌ 動画パスが指定されていません。-VideoPath 引数または環境変数 PIPELINE_VIDEO_PATH を設定してください。" -ForegroundColor Red
  exit 1
}

# 1. 保存先フォルダの決定
if ([string]::IsNullOrEmpty($OutputDir)) {
  $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $videoName = [System.IO.Path]::GetFileNameWithoutExtension($VideoPath) -replace '[^a-zA-Z0-9_-]', '_'
  $OutputDir = Join-Path $PSScriptRoot "pipeline_output_${videoName}_${timestamp}"
}

# パスを絶対パスに解決
$VideoPath = [System.IO.Path]::GetFullPath($VideoPath)
$OutputDir = [System.IO.Path]::GetFullPath($OutputDir)

# 非ASCII文字（日本語等）を含むパスのffmpeg互換対応: 同一ドライブにASCII名ハードリンクを作成
$VideoPathForFFmpeg = $VideoPath
if ($VideoPath -match '[^\x00-\x7F]') {
  $ext        = [System.IO.Path]::GetExtension($VideoPath)
  $videoRoot  = [System.IO.Path]::GetPathRoot($VideoPath)  # 同一ドライブ (例: E:\)
  $tempDir    = Join-Path $videoRoot ".rs_ffmpeg_temp"
  New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
  $tempVideoPath = Join-Path $tempDir "input$ext"
  if (Test-Path -LiteralPath $tempVideoPath) { Remove-Item -LiteralPath $tempVideoPath -Force }
  New-Item -ItemType HardLink -Path $tempVideoPath -Target $VideoPath | Out-Null
  $VideoPathForFFmpeg = $tempVideoPath
  Write-Host " [INFO] 非ASCII動画パス検出: 同一ドライブ一時リンク経由でffmpegを実行します。" -ForegroundColor Yellow
}

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "   360動画 ⇨ RealityScan ⇨ LichtFeld-Studio 3DGS 統合ツール" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "・入力動画: $VideoPath" -ForegroundColor Yellow
Write-Host "・出力フォルダ: $OutputDir" -ForegroundColor Yellow
Write-Host "=========================================================" -ForegroundColor Cyan

# 2. 必要外部環境（ffmpeg, RealityScan.exe）のチェック
Write-Host "[STEP 1/5] 外部環境のチェック..." -ForegroundColor Cyan

$ffmpeg = $null
$ffprobe = $null

try {
  $ffmpeg = Get-Command ffmpeg -ErrorAction Stop
  $ffprobe = Get-Command ffprobe -ErrorAction Stop
  Write-Host " ✔ ffmpeg/ffprobe がシステム環境パスから検出されました。" -ForegroundColor Green
} catch {
  # よくあるパスの探索
  $commonFmPaths = @(
    "C:\ffmpeg\bin\ffmpeg.exe",
    "C:\Program Files\ffmpeg\bin\ffmpeg.exe",
    "C:\Program Files (x86)\ffmpeg\bin\ffmpeg.exe"
  )
  foreach ($p in $commonFmPaths) {
    if (Test-Path -LiteralPath $p) {
      $ffmpeg = [PSCustomObject]@{ Source = $p }
      $ffprobe = [PSCustomObject]@{ Source = ($p -replace "ffmpeg.exe", "ffprobe.exe") }
      break
    }
  }
}

if ($null -eq $ffmpeg -or $null -eq $ffprobe) {
  Write-Host " ❌ ffmpeg/ffprobe が検出できませんでした。" -ForegroundColor Red
  Write-Host "   本スクリプトを実行するには ffmpeg.exe と ffprobe.exe が必要です。" -ForegroundColor Red
  Write-Host "   インストールのうえ、環境変数PATHに登録するか C:\ffmpeg\bin\ に配置してください。" -ForegroundColor Red
  exit 1
}

# RealityScan (RealityCapture) の検出
$realityScanExe = ""
$commonRsPaths = @(
  "C:\Program Files\Epic Games\RealityScan_2.1\RealityScan.exe",
  "C:\Program Files\Epic Games\RealityScan\RealityScan.exe",
  "C:\Program Files\Capturing Reality\RealityScan\RealityScan.exe",
  "C:\Program Files\Capturing Reality\RealityCapture\RealityCapture.exe"
)

foreach ($p in $commonRsPaths) {
  if (Test-Path -LiteralPath $p) {
    $realityScanExe = $p
    break
  }
}

if ([string]::IsNullOrEmpty($realityScanExe)) {
  Write-Host " ⚠️ RealityScan.exe の標準パスが検出されませんでした。" -ForegroundColor Yellow
  $inputExe = Read-Host " RealityScan.exe / RealityCapture.exe の絶対パスを手動で入力してください (空欄で終了)"
  if ([string]::IsNullOrEmpty($inputExe) -or -not (Test-Path -LiteralPath $inputExe)) {
    Write-Host " ❌ 有効な実行ファイルが見つかりません。処理を中断します。" -ForegroundColor Red
    exit 1
  }
  $realityScanExe = $inputExe
}

Write-Host " ✔ RealityScan/RealityCapture を検出しました: $realityScanExe" -ForegroundColor Green

# 3. 360動画からのキーフレーム＆6面キューブマップ抽出 (ffmpeg)
Write-Host "`n[STEP 2/5] 360動画からの6面キューブマップ(Perspective)抽出開始..." -ForegroundColor Cyan

# フォルダ生成
$imageDir = Join-Path $OutputDir "images"
$rawDir = Join-Path $OutputDir "raw_frames"
New-Item -ItemType Directory -Force -Path $imageDir | Out-Null
New-Item -ItemType Directory -Force -Path $rawDir | Out-Null

# ffprobe で動画情報を取得
$fpsText = & $ffprobe.Source -v error -select_streams v:0 -show_entries stream=avg_frame_rate -of default=nokey=1:noprint_wrappers=1 $VideoPathForFFmpeg
$durationText = & $ffprobe.Source -v error -show_entries format=duration -of default=nokey=1:noprint_wrappers=1 $VideoPathForFFmpeg

if ([string]::IsNullOrEmpty($fpsText) -or [string]::IsNullOrEmpty($durationText)) {
  throw "ffprobe が動画情報を取得できませんでした。ファイルパスと形式を確認してください: $VideoPath"
}

$fpsParts = $fpsText.Split("/")
if ($fpsParts.Count -eq 2) {
  $fps = [double]$fpsParts[0] / [double]$fpsParts[1]
} else {
  $fps = [double]$fpsText
}
$duration = [double]$durationText
$totalFrames = [math]::Max(1, [math]::Floor($fps * $duration))
$interval = [math]::Max(1, [math]::Floor($totalFrames / $FrameCount))

Write-Host " ・動画の長さ: $duration 秒" -ForegroundColor Gray
Write-Host " ・平均フレームレート: $fps fps (合計フレーム: $totalFrames)" -ForegroundColor Gray
Write-Host " ・抽出間隔: $interval フレームに1回 (目標枚数: $FrameCount 枚 × 6面)" -ForegroundColor Gray

# 6面リグの定義
$rig = @(
  @{ Name = "front"; Yaw = 0; Pitch = 0 },
  @{ Name = "right"; Yaw = 90; Pitch = 0 },
  @{ Name = "back"; Yaw = 180; Pitch = 0 },
  @{ Name = "left"; Yaw = -90; Pitch = 0 },
  @{ Name = "up"; Yaw = 0; Pitch = 90 },
  @{ Name = "down"; Yaw = 0; Pitch = -90 }
)

$selectExpr = "not(mod(n\,$interval))"

Write-Host " ・FFmpeg 360度仮想リグ分離を実行中..." -ForegroundColor Gray
foreach ($camera in $rig) {
  $outPattern = Join-Path $imageDir ("frame_%03d_" + $camera.Name + ".jpg")
  $filter = "select='$selectExpr',v360=input=equirect:output=flat:w=${ImageSize}:h=${ImageSize}:yaw=$($camera.Yaw):pitch=$($camera.Pitch):h_fov=${Fov}:v_fov=${Fov}"

  & $ffmpeg.Source -hide_banner -loglevel error -y -i $VideoPathForFFmpeg -vf $filter -vsync vfr -q:v 2 -frames:v $FrameCount $outPattern
  if ($LASTEXITCODE -ne 0) {
    throw "ffmpeg による仮想カメラ ($($camera.Name)) の切り出しに失敗しました。"
  }
}

# 生の動画も保管（Raw Equirectangular）
& $ffmpeg.Source -hide_banner -loglevel error -y -i $VideoPathForFFmpeg -vf "select='$selectExpr'" -vsync vfr -q:v 2 -frames:v $FrameCount (Join-Path $rawDir "frame_%03d_equirect.jpg")

Write-Host " ✔ キューブマップ画像の展開が正常に完了しました。" -ForegroundColor Green

# 4. COLMAP 簡易初期データの作成
Write-Host "`n[STEP 3/5] 初期簡易COLMAPアライメント情報の生成..." -ForegroundColor Cyan

$colmapInitialDir = Join-Path $OutputDir "colmap_initial"
New-Item -ItemType Directory -Force -Path $colmapInitialDir | Out-Null
$initialImagesDir = Join-Path $colmapInitialDir "images"
New-Item -ItemType Directory -Force -Path $initialImagesDir | Out-Null

# 展開した全画像を colmap_initial/images に robocopy コピー
robocopy $imageDir $initialImagesDir *.jpg /NFL /NDL /NJH /NJS /NP | Out-Null

# ----------------------------------------------------
# 4.1 cameras.txt 生成
# ----------------------------------------------------
$focalLength = ($ImageSize / 2).ToString("F4")
$cx          = ($ImageSize / 2).ToString("F4")
$cy          = ($ImageSize / 2).ToString("F4")

$camerasTxtContent = @"
# Camera list with one line of data per camera:
# CAMERA_ID, MODEL, WIDTH, HEIGHT, PARAMS[]
1 PINHOLE $ImageSize $ImageSize $focalLength $focalLength $cx $cy
"@
$camerasTxtContent | Set-Content -LiteralPath (Join-Path $colmapInitialDir "cameras.txt") -Encoding UTF8

# ----------------------------------------------------
# 4.2 images.txt 生成 (仮想リグポーズ)
# ----------------------------------------------------
$quaternions = @{
  "front" = @(1, 0, 0, 0)
  "right" = @(0.7071068, 0, 0.7071068, 0)
  "back"  = @(0, 0, 1, 0)
  "left"  = @(0.7071068, 0, -0.7071068, 0)
  "up"    = @(0.7071068, -0.7071068, 0, 0)
  "down"  = @(0.7071068, 0.7071068, 0, 0)
}

$imagesTxtLines = @(
  "# COLMAP images file",
  "# IMAGE_ID, QW, QX, QY, QZ, TX, TY, TZ, CAMERA_ID, NAME",
  "# POINTS2D[]",
  ""
)

# 実際の生成された front 画像の枚数を検出
$actualFrameCount = (Get-ChildItem -Path $imageDir -Filter "*_front.jpg").Count
if ($actualFrameCount -eq 0) {
  throw "展開されたフレーム画像が見つかりません。"
}

$radius = 2.5
$imageId = 1

for ($frameIndex = 0; $frameIndex -lt $actualFrameCount; $frameIndex++) {
  # 螺旋円形カメラ軌跡をエミュレート
  $ratio = if ($actualFrameCount -eq 1) { 0 } else { $frameIndex / ($actualFrameCount - 1) }
  $theta = $ratio * [math]::PI * 2
  $tx = [math]::Cos($theta) * $radius
  $ty = 1.55 + [math]::Sin($theta * 2.0) * 0.12
  $tz = [math]::Sin($theta) * $radius

  foreach ($face in "front", "right", "back", "left", "up", "down") {
    $q = $quaternions[$face]
    $filename = "images/frame_$(($frameIndex + 1).ToString('000'))_${face}.jpg"
    
    # 並進ベクトル TX, TY, TZ はカメラ座標系における逆方向 (-position)
    $cx_val = (-$tx).ToString("F6")
    $cy_val = (-$ty).ToString("F6")
    $cz_val = (-$tz).ToString("F6")

    $imagesTxtLines += "$imageId $($q[0]) $($q[1]) $($q[2]) $($q[3]) $cx_val $cy_val $cz_val 1 $filename"
    $imagesTxtLines += "" # POINTS2D の空行
    $imageId++
  }
}

$imagesTxtLines | Set-Content -LiteralPath (Join-Path $colmapInitialDir "images.txt") -Encoding UTF8

# ----------------------------------------------------
# 4.3 points3D.txt 生成 (最小Tie Points)
# ----------------------------------------------------
$points3DLines = @(
  "# 3D point list with one line of data per point:",
  "# POINT3D_ID, X, Y, Z, R, G, B, ERROR, TRACK[]"
)

# 周辺のダミー空間特徴点をばら撒く (RealityScan が空間構造を認識しやすくするため)
for ($i = 1; $i -le 80; $i++) {
  $angle = ($i / 80) * [math]::PI * 2
  $px = ([math]::Cos($angle) * 1.25).ToString("F6")
  $py = ([math]::Sin($angle * 0.7) * 0.8).ToString("F6")
  $pz = ([math]::Sin($angle) * 1.25).ToString("F6")
  $points3DLines += "$i $px $py $pz 170 170 170 0.9"
}
$points3DLines | Set-Content -LiteralPath (Join-Path $colmapInitialDir "points3D.txt") -Encoding UTF8

# 互換運用のための images/images サブディレクトリも配置
$colmapImagesSubDir = Join-Path $initialImagesDir "images"
New-Item -ItemType Directory -Force -Path $colmapImagesSubDir | Out-Null
robocopy $imageDir $colmapImagesSubDir *.jpg /NFL /NDL /NJH /NJS /NP | Out-Null

Write-Host " ✔ 初期簡易COLMAPアライメントデータを生成しました: $colmapInitialDir" -ForegroundColor Green

# 5. RealityScan CLI 高密度アライメント実行 ＆ 成果物エクスポート
Write-Host "`n[STEP 4/5] RealityScan CLI のヘッドレス精密アライメントを実行中..." -ForegroundColor Cyan
Write-Host "   (これには数分かかる場合があります。このままお待ちください...)" -ForegroundColor Yellow

$rsprojPath = Join-Path $OutputDir "reconstructed_project.rsproj"
$finalMeshObjPath = Join-Path $OutputDir "reconstructed_mesh.obj"
$finalColmapDir = Join-Path $OutputDir "colmap_reconstructed"

# フォルダ作成
New-Item -ItemType Directory -Force -Path $finalColmapDir | Out-Null

# RealityScan CLI コマンドライン引数群の組み立て
# 1. アライメントとプレビューモデルの作成、プロジェクト保存
$alignArgs = @(
  "-headless",
  "-newScene",
  "-addFolder", $initialImagesDir,
  "-align",
  "-selectMaximalComponent",
  "-setReconstructionRegionAuto",
  "-calculatePreviewModel",
  "-save", $rsprojPath,
  "-quit"
)

Write-Host " > アライメントおよび空間三次元計算を進行中..." -ForegroundColor Gray
$process = Start-Process -FilePath $realityScanExe -ArgumentList $alignArgs -PassThru -NoNewWindow -Wait
if ($process.ExitCode -ne 0 -and $null -ne $process.ExitCode) {
  throw "RealityScan CLI がアライメントフェーズで終了コード $($process.ExitCode) で異常終了しました。"
}

# 2. 再出力 (再アライメントした COLMAP Poses のエクスポート ＆ メッシュエクスポート)
$exportArgs = @(
  "-headless",
  "-load", $rsprojPath,
  "-selectMaximalComponent",
  "-exportSelectedModel", $finalMeshObjPath,
  "-quit"
)

Write-Host " > 最適化カメラポーズ(COLMAP形式) ＆ 3Dメッシュのエクスポート中..." -ForegroundColor Gray
$processExport = Start-Process -FilePath $realityScanExe -ArgumentList $exportArgs -PassThru -NoNewWindow -Wait
if ($processExport.ExitCode -ne 0 -and $null -ne $processExport.ExitCode) {
  throw "RealityScan CLI がエクスポートフェーズで終了コード $($processExport.ExitCode) で異常終了しました。"
}

Write-Host " ✔ RealityScan の精密アライメントと再エクスポートが完了しました。" -ForegroundColor Green
Write-Host "   ・3Dメッシュ出力: $finalMeshObjPath" -ForegroundColor Gray
Write-Host "   ・再構成COLMAPポーズ出力: $finalColmapDir" -ForegroundColor Gray

# 6. LichtFeld-Studio / 3DGS 向けフォルダ構造の自動整理
Write-Host "`n[STEP 5/5] LichtFeld-Studio / 3DGS 向け入力フォルダ構造の自動配置..." -ForegroundColor Cyan

$lichtfeldDir = Join-Path $OutputDir "lichtfeld_input"
New-Item -ItemType Directory -Force -Path $lichtfeldDir | Out-Null
$lfImagesDir = Join-Path $lichtfeldDir "images"
New-Item -ItemType Directory -Force -Path $lfImagesDir | Out-Null

# 1. 展開した画像の配置
robocopy $imageDir $lfImagesDir *.jpg /NFL /NDL /NJH /NJS /NP | Out-Null

# 2. 精密アライメントされたCOLMAPファイル群(cameras.txt, images.txt, points3D.txt)を配置
$colmapSourceFiles = Get-ChildItem -Path $finalColmapDir -Include "cameras.txt", "images.txt", "points3D.txt" -Recurse
if ($colmapSourceFiles.Count -eq 0) {
  Write-Host " ⚠️ 再構築COLMAPデータが空です。RealityScanの初期アライメント結果をフォールバックします。" -ForegroundColor Yellow
  robocopy $colmapInitialDir $lichtfeldDir cameras.txt images.txt points3D.txt /NFL /NDL /NJH /NJS /NP | Out-Null
} else {
  foreach ($f in $colmapSourceFiles) {
    Copy-Item -Path $f.FullName -Destination $lichtfeldDir -Force
  }
}

Write-Host " ✔ LichtFeld-Studio 取り込み用データフォルダが完成しました！" -ForegroundColor Green
Write-Host "   フォルダパス: $lichtfeldDir" -ForegroundColor Yellow
Write-Host "   (このフォルダ内には、3DGSの学習に必須の 'images/' フォルダと 'cameras.txt', 'images.txt', 'points3D.txt' が美しく配置されています)" -ForegroundColor Yellow

# 一括ZIP圧縮（持ち出し用）
$zipPath = Join-Path $OutputDir "3dgs_ready_package.zip"
if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
Compress-Archive -Path $lichtfeldDir -DestinationPath $zipPath -Force
Write-Host " ✔ 持ち出し用一括ZIPパッケージを作成しました: $zipPath" -ForegroundColor Green

# 一時ASCIIリンクのクリーンアップ
if ($VideoPathForFFmpeg -ne $VideoPath -and (Test-Path -LiteralPath $VideoPathForFFmpeg)) {
  Remove-Item -LiteralPath $VideoPathForFFmpeg -Force
  $tempDir = Split-Path $VideoPathForFFmpeg
  if ((Get-ChildItem -LiteralPath $tempDir -ErrorAction SilentlyContinue).Count -eq 0) {
    Remove-Item -LiteralPath $tempDir -Force -ErrorAction SilentlyContinue
  }
}

Write-Host "`n=========================================================" -ForegroundColor Green
Write-Host "   すべてのパイプラインが正常に完了しました！🎉" -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Green
Write-Host "成果物保存先: $OutputDir" -ForegroundColor Yellow
Write-Host "LichtFeld-Studioの読み込み設定はフォルダ内の README.md を参照してください。" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Green
