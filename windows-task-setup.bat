@echo off
echo Setting up Windows Scheduled Tasks for Arbitrage System
echo.

set SCRIPT_DIR=%~dp0
set NODE_EXE=node.exe

echo Creating task to run process-matches.js every 1 minute...
schtasks /create /tn "ArbitrageProcess" /tr "%NODE_EXE% \"%SCRIPT_DIR%process-matches.js\"" /sc minute /mo 1 /ru SYSTEM /f

echo Creating task to run fetchMostbetData.js every 20 minutes...
schtasks /create /tn "ArbitrageFetchMostbet" /tr "%NODE_EXE% \"%SCRIPT_DIR%fetchMostbetData.js\"" /sc minute /mo 20 /ru SYSTEM /f

echo Creating task to run fetchMelbetData.js every 20 minutes...
schtasks /create /tn "ArbitrageFetchMelbet" /tr "%NODE_EXE% \"%SCRIPT_DIR%fetchMelbetData.js\"" /sc minute /mo 20 /ru SYSTEM /f

echo Creating task to run matchFinder.js every 20 minutes...
schtasks /create /tn "ArbitrageMatchFinder" /tr "%NODE_EXE% \"%SCRIPT_DIR%matchFinder.js\"" /sc minute /mo 20 /ru SYSTEM /f

echo.
echo Tasks created successfully!
echo.
echo To verify tasks, run: schtasks /query /tn "Arbitrage*"
echo To delete tasks, run: schtasks /delete /tn "ArbitrageProcess" /f
echo.

pause 