@echo off
cd /d "%~dp0"
if not exist .env (
  echo Copy .env.example to .env and configure LOCAL_WORKER_KEY first.
  pause
  exit /b 1
)
node --env-file=.env worker.mjs
pause
