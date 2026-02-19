cd /d "%~dp0"
echo Starting local server used for Standalone Mobile Agent...
echo Open http://localhost:8081 in your browser.
..\venv\Scripts\python.exe -m http.server 8081
pause
