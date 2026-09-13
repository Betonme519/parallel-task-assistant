@echo off
rem Development entry: run npm ci first to install the locked dependencies.
cd /d "%~dp0"
call npm.cmd start
