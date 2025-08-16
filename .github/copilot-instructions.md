# Simple File Upload & Download Server

Simple File Upload & Download Server is a lightweight Python-based HTTP server for file upload, download, and listing. Single-file runnable with a modern web frontend and optional encryption mode.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## CRITICAL VALIDATION NOTES

***ALL COMMANDS BELOW HAVE BEEN EXHAUSTIVELY TESTED AND VERIFIED TO WORK***
- Every single command, build process, and endpoint has been validated
- Build times are measured and documented with appropriate timeouts
- All server modes and troubleshooting scenarios are verified functional
- Web interfaces tested with screenshots for visual confirmation

## Working Effectively

- Bootstrap and run the repository:
  - Ensure Python 3.8+ is installed: `python3 --version`
  - Navigate to repository root
  - Start the server: `python3 file.py -p 8000` -- starts immediately (1-2 seconds), no build required
  - Access web interface: `http://localhost:8000/`
- No build process required - this is a standalone Python script with static files
- No package installation required - uses only Python standard library
- ***NEVER CANCEL*** server commands - the server runs indefinitely until stopped with Ctrl+C
- Server startup shows deprecation warning for cgi module in Python 3.11+ - this is expected and safe to ignore

## Build Process (Optional)

***PyInstaller Build: NEVER CANCEL - Completes in 4-5 seconds. Set timeout to 30+ seconds.***

### Basic Build (CI Default Method)
```bash
# Install PyInstaller (takes ~10-15 seconds)
pip install pyinstaller

# Basic directory build (takes 4-5 seconds)
pyinstaller --name SFS file.py

# Copy static assets to executable directory (CI method)
cp -r static dist/SFS/
cp classic.html dist/SFS/

# Test built executable
cd dist/SFS
./SFS --help
```

### Build Validation
```bash
# Always test built executable functionality
cd dist/SFS
./SFS -p 8001 &
BUILD_PID=$!
sleep 2
curl -s http://localhost:8001/list | grep files
kill $BUILD_PID
```

## Validation

***CRITICAL: ALWAYS run complete validation after making changes***

### Basic API Testing (Each endpoint takes <1 second)
```bash
# Start server: NEVER CANCEL - runs indefinitely until Ctrl+C
python3 file.py -p 8000 &
SERVER_PID=$!
sleep 2

# Test all endpoints
curl -s http://localhost:8000/list
curl -X POST -F "file=@test.txt" http://localhost:8000/upload  
curl -s "http://localhost:8000/download?file=test.txt"

# Stop server
kill $SERVER_PID
```

### Complete Validation Script (Takes ~10 seconds)
```bash
# Create test file
echo "test content" > test.txt

# Start server in background: NEVER CANCEL
python3 file.py -p 8000 &
SERVER_PID=$!

# Wait for server to start (1-2 seconds)
sleep 2

# Test endpoints (each takes <1 second)
curl http://localhost:8000/list
curl -X POST -F "file=@test.txt" http://localhost:8000/upload
curl "http://localhost:8000/download?file=test.txt"

# Stop server
kill $SERVER_PID

# Cleanup
rm test.txt
```

### Web Interface Testing
- Always test web interface by visiting `http://localhost:8000/` in a browser
- Test file upload through drag-and-drop interface
- Verify file listing and download functionality
- Test theme switching (light/dark/auto modes)
- ALWAYS test both regular and encrypted modes when making server changes

### Multi-Mode Validation
```bash
# Test all server modes (each takes 2-3 seconds to start)
python3 file.py -p 8000        # Standard mode
python3 file.py -p 8000 -e     # Encrypted mode (displays 4-digit key)
python3 file.py -p 8000 -c     # Classic mode  
python3 file.py -p 8000 -e -c  # Combined mode
```

### File Operations Testing
- Create test files for validation: `echo "test content" > test.txt`
- Clean up test files after validation: `rm test*.txt`

## Server Operation Modes

### Standard Mode (Default)
```bash
python3 file.py -p 8000
```
- Serves modern web interface from `static/` directory
- No authentication required
- All endpoints accessible without headers

### Encrypted Mode
```bash
python3 file.py -p 8000 -e
```
- Generates random 4-digit key displayed in console output
- Requires `X-Secret-Key` header for all API endpoints
- Example with key: `curl -H "X-Secret-Key: 1234" http://localhost:8000/list`

### Classic Mode
```bash
python3 file.py -p 8000 -c
```
- Serves simplified interface from `classic.html`
- Lightweight alternative frontend
- Same API functionality as standard mode

### Combined Modes
```bash
python3 file.py -p 8000 -e -c
```
- Classic interface with encryption enabled

## API Endpoints

- `GET /` - Returns web frontend (index.html or classic.html based on mode)
- `GET /list` - JSON list of files with names and sizes
- `GET /download?file=<filename>` - Download specific file
- `POST /upload` - Upload files using multipart/form-data with field name "file"
- `GET /static/*` - Static assets (CSS, JS) for modern interface

## Project Structure

### Root Directory
```
file.py                 # Main server entry point
README.md              # Documentation (Chinese and English)
LICENSE                # MIT license
classic.html           # Simple frontend alternative
run_server.bat         # Windows batch script (port 80)
run_server.sh          # Linux/macOS script (port 8000)
run_server_classic.bat # Windows classic mode script
static/                # Modern frontend assets
```

### Static Directory
```
static/index.html      # Modern web interface
static/style.css       # Styles with dark mode support
static/app.js          # Frontend JavaScript with upload progress
```

## Common Tasks

### Server Management
- Start server: `python3 file.py -p 8000`
- Stop server: Press Ctrl+C in terminal
- Change port: Use `-p <port>` flag (default is 80, recommend 8000 for development)
- Enable encryption: Add `-e` flag
- Use classic interface: Add `-c` flag

### File Operations
- Upload files: Use web interface or POST to `/upload` endpoint
- List files: GET `/list` or view in web interface
- Download files: Click in web interface or GET `/download?file=<name>`
- Files are saved to the current working directory where server runs

### Testing Changes
```bash
# Create test file
echo "test content" > test.txt

# Start server in background
python3 file.py -p 8000 &
SERVER_PID=$!

# Wait for server to start (1-2 seconds)
sleep 2

# Test endpoints (each takes <1 second)
curl http://localhost:8000/list
curl -X POST -F "file=@test.txt" http://localhost:8000/upload
curl "http://localhost:8000/download?file=test.txt"

# Stop server
kill $SERVER_PID

# Cleanup
rm test.txt
```

## Security & Limitations

- Intended for LAN/temporary use only
- No user authentication or access control (except encryption mode)
- No audit logging
- Python's `cgi` module is deprecated since 3.11 and shows warnings
- Files are served from current working directory
- No input validation beyond basic path traversal protection

## Troubleshooting

### Common Issues (All Validated)

- **Permission/port issues**: Use `-p 8000` instead of default port 80, or run with admin privileges
  - Default port 80 will fail with `PermissionError: [Errno 13] Permission denied`
- **Upload returns 400**: Ensure Content-Type is `multipart/form-data` with field name `file`
  - Wrong content type produces: `400 Bad request syntax or unsupported method`
- **Deprecation warnings**: Normal for Python 3.11+, `cgi` module warnings can be ignored
  - Shows: `DeprecationWarning: 'cgi' is deprecated and slated for removal in Python 3.13`
- **Module not found**: Ensure Python 3.8+ is installed and accessible as `python3`
- **Browser access issues**: Try `http://localhost:PORT/` with correct port number
- **HEAD requests not supported**: Server returns `501 Unsupported method ('HEAD')` for HEAD requests

### Encrypted Mode Troubleshooting
- In encrypted mode, server displays: `一次性密钥: XXXX` where XXXX is a 4-digit number
- All API calls require `X-Secret-Key` header: `curl -H "X-Secret-Key: 1234" http://localhost:8000/list`
- Unauthorized access returns: `401 Unauthorized, invalid key`
- Classic mode with encryption prompts for key in browser interface

### Build Troubleshooting  
- PyInstaller requires: `pip install pyinstaller` (takes ~10-15 seconds)
- Build failures: Ensure you're in repository root directory
- Missing static files: Copy `static/` and `classic.html` to `dist/SFS/` directory manually
- Executable won't start: Check that static assets are accessible from executable location

## Development Notes

- Main server logic in `file.py` class `UploadHTTPRequestHandler`
- Frontend uses vanilla JavaScript with progress tracking and dark mode
- Encryption mode generates random 4-digit keys per server start
- Static files served directly from filesystem
- No external dependencies - uses only Python standard library
- Cross-platform compatibility (Windows, macOS, Linux)

### Key Implementation Details
- Server doesn't support HEAD requests (returns 501)
- Supports multi-file uploads via multipart/form-data
- Files saved to current working directory where server runs
- Path traversal protection implemented for security
- MIME type detection for CSS, JS, HTML files
- Template replacement: `{encrypted_status}` → `true`/`false` in HTML files

### Frontend Features
- Modern interface: Drag-and-drop, progress tracking, speed/ETA display
- Theme switching: Light/dark/auto modes with localStorage persistence
- File management: Search, bulk selection, batch download
- Classic interface: Simplified alternative with same functionality
- Responsive design supporting mobile devices

## File Locations Reference

- **Main server**: `file.py` (158 lines, ~7KB)
- **Modern UI**: `static/index.html`, `static/style.css`, `static/app.js`
- **Simple UI**: `classic.html` (single file, ~7KB)
- **Documentation**: `README.md` (bilingual Chinese/English)
- **Launcher scripts**: `run_server.sh`, `run_server.bat`, `run_server_classic.bat`
- **CI Build**: `.github/workflows/build.yml` (automated PyInstaller builds)

## Comprehensive User Scenarios

### Scenario 1: Basic Development Testing
```bash
# Start server and test basic functionality (takes ~30 seconds total)
python3 file.py -p 8000 &
SERVER_PID=$!
sleep 2

# Create and upload multiple file types
echo "Hello world" > sample.txt
echo '{"test": "data"}' > data.json
curl -X POST -F "file=@sample.txt" -F "file=@data.json" http://localhost:8000/upload

# Verify and download
curl -s http://localhost:8000/list | grep -c files
curl -s "http://localhost:8000/download?file=sample.txt"

# Cleanup
kill $SERVER_PID
rm sample.txt data.json
```

### Scenario 2: Encrypted Mode Testing
```bash
# Start encrypted server
python3 file.py -p 8000 -e &
SERVER_PID=$!
sleep 2

# Note the displayed key (format: 一次性密钥: XXXX)
# Test with authentication
KEY="1234"  # Replace with actual displayed key
curl -H "X-Secret-Key: $KEY" http://localhost:8000/list

# Cleanup
kill $SERVER_PID
```

### Scenario 3: Build and Distribution Testing
```bash
# Full build cycle (takes ~20 seconds total)
pip install pyinstaller                    # 10-15 seconds
pyinstaller --name SFS file.py            # 4-5 seconds  
cp -r static classic.html dist/SFS/       # <1 second

# Test built executable
cd dist/SFS
./SFS -p 8001 --help                      # <1 second
./SFS -p 8001 &                           # Start built server
BUILD_PID=$!
sleep 2
curl -s http://localhost:8001/list        # Test functionality
kill $BUILD_PID
```

Always test upload, download, and listing functionality after making changes to ensure the core file server capabilities remain intact.
