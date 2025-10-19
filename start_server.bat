@echo off
cd /d "%~dp0"
echo.
echo ================================================
echo   Flask Chat Server with OpenAI GPT
echo ================================================
echo.
.venv\Scripts\python.exe app.py
echo.
echo Server stopped.
pause
