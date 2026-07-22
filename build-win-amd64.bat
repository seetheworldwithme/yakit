@echo off
chcp 65001 >nul
setlocal

REM ============================================================
REM  Yakit 企业版 no-license —— Windows amd64 打包启动器
REM  双击即可运行，自动调用 Git Bash 执行 build-win-amd64.sh
REM ============================================================

cd /d "%~dp0"

REM ---- 依次尝试常见的 Git Bash 路径 ----
set "BASH_EXE="
if exist "C:\Program Files\Git\bin\bash.exe"            set "BASH_EXE=C:\Program Files\Git\bin\bash.exe"
if not defined BASH_EXE if exist "C:\Program Files (x86)\Git\bin\bash.exe" set "BASH_EXE=C:\Program Files (x86)\Git\bin\bash.exe"
if not defined BASH_EXE if exist "%LOCALAPPDATA%\Programs\Git\bin\bash.exe" set "BASH_EXE=%LOCALAPPDATA%\Programs\Git\bin\bash.exe"

if not defined BASH_EXE (
    echo [X] 未找到 Git Bash，请先安装 Git for Windows:
    echo     https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)

echo [*] 使用 Bash: %BASH_EXE%
echo [*] 开始打包 Windows amd64...
echo.

"%BASH_EXE%" --login -i "%~dp0build-win-amd64.sh"
set "EXITCODE=%ERRORLEVEL%"

echo.
if "%EXITCODE%"=="0" (
    echo [V] 打包完成！安装包位于: release\installers\windows-amd64\
) else (
    echo [X] 打包失败，退出码: %EXITCODE%
)

pause
endlocal
