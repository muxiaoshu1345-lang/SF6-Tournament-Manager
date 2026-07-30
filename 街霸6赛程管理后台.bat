@echo off
chcp 65001 >nul
echo ========================================
echo   街霸6赛程管理后台
echo   访问地址: http://127.0.0.1:5000
echo ========================================
echo.
echo 启动中...
start http://127.0.0.1:5000
python run.py
pause
