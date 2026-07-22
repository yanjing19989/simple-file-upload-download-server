#!/bin/bash
# Linux/macOS HTTPS startup script, default port 443
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TLS_DIR="$HOME/.simple-file-upload-download-server"
if [ ! -f "$TLS_DIR/cert.pem" ] || [ ! -f "$TLS_DIR/key.pem" ]; then
  echo "HTTPS certificate files are missing."
  echo "Run: python3 \"$SCRIPT_DIR/generate_https_cert.py\""
  echo "Certificates are stored in $TLS_DIR"
  exit 1
fi
python3 "$SCRIPT_DIR/file.py" -p 443 \
  --cert "$TLS_DIR/cert.pem" --key "$TLS_DIR/key.pem"
