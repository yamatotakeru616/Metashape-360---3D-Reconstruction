@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo =========================================================
echo    360動画 ⇨ 3DGS 統合 Web GUI 起動ランチャー
echo =========================================================
echo.

cd /d "%~dp0"

:: Node.js のチェック
where node >nul 2>nul
if errorlevel 1 goto ERROR_NODE

:: node_modules の存在チェック
if exist "node_modules\" goto START_SERVER

echo [INFO] 初回起動のため、必要なライブラリ(Express)を自動インストールしています...
echo       インストールには数秒かかります。このままお待ちください...
echo.

call npm install
if errorlevel 1 goto ERROR_INSTALL

echo.
echo ✔ インストールが完了しました！
echo.

:START_SERVER
echo [INFO] Web GUI サーバーを起動しています...
echo.

:: ブラウザ自動オープン (バックグラウンド遅延起動)
start "" "http://localhost:4000"

call npm start
if errorlevel 1 goto ERROR_SERVER

pause
exit /b 0

:ERROR_NODE
echo [ERROR] Node.js がインストールされていません。
echo         本ツールのGUIを起動するには Node.js (LTS推奨) が必要です。
echo         公式HP (https://nodejs.org/) よりインストールしてください。
echo.
pause
exit /b 1

:ERROR_INSTALL
echo.
echo [ERROR] ライブラリの自動インストールに失敗しました。
echo         インターネット接続と Node.js のインストール状況を確認してください。
echo.
pause
exit /b 1

:ERROR_SERVER
echo.
echo [ERROR] GUIサーバーの実行中にエラーが発生しました。
echo.
pause
exit /b 1
