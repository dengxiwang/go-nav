@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 未找到 Node.js，无法启动本地预览。
  pause
  exit /b 1
)
node "本地预览.mjs" "."
if errorlevel 1 pause
