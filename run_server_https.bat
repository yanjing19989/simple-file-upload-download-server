@echo off
REM Windows HTTPS boot script, default port 443
set "TLS_DIR=%USERPROFILE%\.simple-file-upload-download-server"
if not exist "%TLS_DIR%\cert.pem" goto missing_cert
if not exist "%TLS_DIR%\key.pem" goto missing_cert
python "%~dp0file.py" -p 443 --cert "%TLS_DIR%\cert.pem" --key "%TLS_DIR%\key.pem"
pause
exit /b

:missing_cert
echo HTTPS certificate files are missing.
echo Run: python "%~dp0generate_https_cert.py"
echo Certificates are stored in %TLS_DIR%
pause
exit /b 1
