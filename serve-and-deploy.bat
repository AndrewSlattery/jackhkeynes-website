@echo off
setlocal

REM Always run from the folder this script lives in
cd /d "%~dp0"

echo ============================================
echo  Starting Jekyll server...
echo  Site will be at http://localhost:4000
echo ============================================
echo.

REM Launch the server in its own window so Ctrl+C doesn't kill this script
start "Jekyll Server" cmd /c "bundle exec jekyll serve"

echo Server is running in a separate window.
echo.
echo When you're finished previewing, press any key here
echo to STOP the server and commit + push your changes.
echo.
pause >nul

echo.
echo Stopping Jekyll server...
taskkill /FI "WINDOWTITLE eq Jekyll Server*" /T /F >nul 2>&1

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
