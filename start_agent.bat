@echo off
echo Starting LiveKit Server...
start "LiveKit Server" livekit-server.exe --dev

timeout /t 2 /nobreak >nul

echo Activating Virtual Environment...
call venv\Scripts\activate

cd simple_voice_agent

echo Starting Web Server...
start "Web Server" python server.py

timeout /t 2 /nobreak >nul

echo Starting AI Agent...
start "AI Agent" python agent.py

echo.
echo All components started!
echo Please open http://localhost:8000 in your browser.
pause
