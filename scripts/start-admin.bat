@echo off
set PATH=C:\Program Files\nodejs;%PATH%

start "ESOF API" cmd /k "cd /d C:\Showroom\ESOF\api && npm run start:dev"
start "ESOF Admin" cmd /k "cd /d C:\Showroom\ESOF\admin && npm run dev"

timeout /t 6 /nobreak >nul
start http://localhost:5173
