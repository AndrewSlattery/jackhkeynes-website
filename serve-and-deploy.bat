@echo off
setlocal EnableDelayedExpansion

REM Always run from the folder this script lives in
cd /d "%~dp0"

echo ============================================
echo  Starting Jekyll server...
echo  Site will be at http://localhost:4000
echo ============================================
echo.

REM Launch the server in its own window so Ctrl+C doesn't kill this script.
REM We capture its PID via PowerShell so it can be reliably stopped later
REM (matching on window title is unreliable, e.g. under Windows Terminal).
set "JEKYLL_PIDFILE=%TEMP%\jekyll_server_pid.txt"
del "%JEKYLL_PIDFILE%" >nul 2>&1
powershell -NoProfile -Command "$p = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','title Jekyll Server && bundle exec jekyll serve' -PassThru; $p.Id | Out-File -FilePath '%JEKYLL_PIDFILE%' -Encoding ascii"

echo Server is running in a separate window.
echo.
echo When you're finished previewing, press any key here
echo to STOP the server and commit + push your changes.
echo.
pause >nul

echo.
echo Stopping Jekyll server...
if exist "%JEKYLL_PIDFILE%" (
    set /p JEKYLL_PID=<"%JEKYLL_PIDFILE%"
    taskkill /PID !JEKYLL_PID! /T /F >nul 2>&1
    del "%JEKYLL_PIDFILE%" >nul 2>&1
)

echo.
echo Committing and pushing changes...
git add -A

REM Only commit if there is something staged
git diff --cached --quiet
if errorlevel 1 (
    git commit -m "Update site %DATE% %TIME%"
    git push origin main
    echo.
    echo Done - changes committed and pushed.
) else (
    echo.
    echo No changes to commit. Nothing pushed.
)

echo.
pause
