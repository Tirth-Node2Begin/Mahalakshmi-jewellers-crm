@echo off
setlocal
title Jewellers CRM - launcher

rem ---------------------------------------------------------------------------
rem Starts the whole project for local development (SETUP.md section 5):
rem   backend   php -S localhost:8000      from the project root
rem   frontend  npm run dev                from frontend\  (port 3000)
rem Both run as tabs in ONE Windows Terminal window (separate windows only if
rem Windows Terminal is missing). Close a tab, or Ctrl+C in it, to stop it.
rem ---------------------------------------------------------------------------

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "FRONTEND=%ROOT%\frontend"

echo.
echo  Jewellers CRM
echo  =============
echo.

rem --- prerequisites ---------------------------------------------------------
where php >nul 2>nul
if errorlevel 1 goto :no_php

where npm >nul 2>nul
if errorlevel 1 goto :no_node

if not exist "%ROOT%\.env" goto :no_env

rem MySQL is not started from here - just say so early instead of letting the
rem login page fail with a database error.
netstat -ano | findstr /R /C:":3306 .*LISTENING" >nul
if errorlevel 1 (
    echo  [!] MySQL does not seem to be running on port 3306.
    echo      Start it from the XAMPP control panel, then log in.
    echo.
)

rem --- frontend dependencies (first run only) --------------------------------
if exist "%FRONTEND%\node_modules" goto :deps_ok
echo  Installing frontend packages - first run only, this takes a few minutes...
echo.
pushd "%FRONTEND%"
call npm install
if errorlevel 1 (
    popd
    goto :npm_failed
)
popd
echo.
:deps_ok

rem --- which servers still need starting -------------------------------------
set "NEED_BACKEND=1"
netstat -ano | findstr /R /C:":8000 .*LISTENING" >nul
if not errorlevel 1 set "NEED_BACKEND="

set "NEED_FRONTEND=1"
netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul
if not errorlevel 1 set "NEED_FRONTEND="

if defined NEED_BACKEND (echo  Backend  : starting on http://localhost:8000) else (echo  Backend  : port 8000 is already in use - assuming it is already running.)
if defined NEED_FRONTEND (echo  Frontend : starting on http://localhost:3000) else (echo  Frontend : port 3000 is already in use - assuming it is already running.)

if not defined NEED_BACKEND if not defined NEED_FRONTEND goto :launched

rem --- launch: one Windows Terminal window, one tab per server ---------------
where wt >nul 2>nul
if errorlevel 1 goto :separate_windows

set "BACKEND_TAB=new-tab --title "Backend :8000" --suppressApplicationTitle --tabColor #2E7D32 -d "%ROOT%" cmd /k php -S localhost:8000"
set "FRONTEND_TAB=new-tab --title "Frontend :3000" --suppressApplicationTitle --tabColor #1565C0 -d "%FRONTEND%" cmd /k npm run dev"

rem "-w JewellersCRM" names the window, so a server restarted on its own later
rem lands as a tab in the same window instead of opening another one.
set "TABS="
if defined NEED_BACKEND set "TABS=%BACKEND_TAB%"
if defined NEED_BACKEND if defined NEED_FRONTEND set "TABS=%TABS% ; "
if defined NEED_FRONTEND set "TABS=%TABS%%FRONTEND_TAB%"
wt -w JewellersCRM %TABS%
goto :launched

rem Windows Terminal is not installed - fall back to one window per server.
:separate_windows
if defined NEED_BACKEND start "Jewellers CRM - Backend :8000" /D "%ROOT%" cmd /k php -S localhost:8000
if defined NEED_FRONTEND start "Jewellers CRM - Frontend :3000" /D "%FRONTEND%" cmd /k npm run dev

:launched

rem --- open the browser once the dev server answers --------------------------
echo.
echo  Waiting for the frontend to come up...
set /a TRIES=0
:wait_frontend
netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul
if not errorlevel 1 goto :open_browser
set /a TRIES+=1
if %TRIES% GEQ 60 goto :open_browser
ping -n 2 127.0.0.1 >nul
goto :wait_frontend

:open_browser
start "" "http://localhost:3000"

echo.
echo  App : http://localhost:3000
echo  API : http://localhost:8000/api
echo.
echo  To stop: close the Backend and Frontend tabs.
echo.
ping -n 6 127.0.0.1 >nul
exit /b 0

:no_php
echo  [X] PHP was not found on PATH. Install PHP 8.2+ or add C:\xampp\php to PATH.
goto :fail

:no_node
echo  [X] Node.js / npm was not found on PATH. Install Node.js LTS first.
goto :fail

:no_env
echo  [X] .env is missing. Copy .env.example to .env and fill in the database
echo      settings - see SETUP.md.
goto :fail

:npm_failed
echo.
echo  [X] npm install failed - see the messages above.
goto :fail

:fail
echo.
pause
exit /b 1
