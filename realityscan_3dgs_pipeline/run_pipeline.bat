@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo =========================================================
echo    360動画 ⇨ RealityScan ⇨ LichtFeld-Studio 3DGS 統合ツール
echo =========================================================
echo.
echo [説明]
echo 360動画から簡易アライメントを行い、RealityScan CLIによる
echo 高密度精密姿勢計算を経て、LichtFeld-Studio経由で3DGSまで
echo 構築するコマンドライン(CUI)ツールです。
echo.
echo =========================================================
echo.

:GET_VIDEO
set "VIDEO_PATH="
set /p "VIDEO_PATH=◆ 360度動画の絶対パスを入力してください(ドラッグ＆ドロップ可): "
if "!VIDEO_PATH!"=="" goto GET_VIDEO

:: 引用符をトリム
set "VIDEO_PATH=!VIDEO_PATH:"=!"
set "VIDEO_PATH=!VIDEO_PATH:'=!"

if not exist "!VIDEO_PATH!" goto ERROR_NOT_FOUND

:GET_OUT
set "OUT_DIR="
set /p "OUT_DIR=◆ 成果物保存先フォルダを入力してください(空欄の場合はスクリプトと同じ階層): "
if not "!OUT_DIR!"=="" (
    set "OUT_DIR=!OUT_DIR:"=!"
    set "OUT_DIR=!OUT_DIR:'=!"
)

echo.
echo =========================================================
echo [実行環境の確認および処理を開始します...]
echo =========================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Run-Pipeline.ps1" -VideoPath "!VIDEO_PATH!" -OutputDir "!OUT_DIR!"
if errorlevel 1 goto ERROR_PIPELINE

echo.
echo [完了] すべての処理が終了しました。キーを押して閉じてください。
pause
exit /b 0

:ERROR_NOT_FOUND
echo [ERROR] 指定された動画ファイルが見つかりません: !VIDEO_PATH!
echo.
goto GET_VIDEO

:ERROR_PIPELINE
echo.
echo [ERROR] 処理の実行中にエラーが発生しました。
pause
exit /b 1
