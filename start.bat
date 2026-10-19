@echo off
title Турнир CS2 - Школьный кубок (Сервер + Сайт)
echo ========================================================
echo   ЗАПУСК САЙТА ШКОЛЬНОГО ТУРНИРА CS2 С LIVE СИНХРОНИЗАЦИЕЙ
echo ========================================================
echo.
echo Сайт запускается на: http://localhost:5000
echo Адрес вебхука для CounterStrikeSharp: http://localhost:5000/api/server/live
echo.
echo Открываю браузер...
start http://localhost:5000
echo.
node artifacts/api-server/dist/index.mjs
pause
