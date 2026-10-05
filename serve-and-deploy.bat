@echo off
setlocal

REM Always run from the folder this script lives in
cd /d "%~dp0"

echo ============================================
echo  Building site with Jekyll...
echo ============================================
echo.

REM A one-off build runs the same generator plugins as "jekyll serve"
REM (dictionary, wiki), but exits when finished, so no manual wait is needed.
call bundle exec jekyll build
if errorlevel 1 (
    echo.
    echo Jekyll build FAILED - nothing was committed or pushed.
    pause
    exit /b 1
)

echo.
echo Committing and pushing changes...
git add -A

REM Only commit if there is something staged
git diff --cached --quiet
if not errorlevel 1 (
    echo.
    echo No changes to commit. Nothing pushed.
    timeout /t 5 >nul
    exit /b 0
)

git commit -m "Update site %DATE% %TIME%"
git push origin main
if errorlevel 1 (
    echo.
    echo Push FAILED - see the error above.
    pause
    exit /b 1
)

echo.
echo Done - changes committed and pushed.
timeout /t 5 >nul
