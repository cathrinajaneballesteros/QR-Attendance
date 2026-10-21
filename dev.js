const { spawn } = require('child_process');
const path = require('path');

const fs = require('fs');

const rootDir = __dirname;
const backendDir = fs.existsSync(path.join(rootDir, 'backend'))
  ? path.join(rootDir, 'backend')
  : path.join(rootDir, 'qr-attendance-system', 'backend');
const frontendDir = fs.existsSync(path.join(rootDir, 'frontend'))
  ? path.join(rootDir, 'frontend')
  : path.join(rootDir, 'qr-attendance-system', 'frontend');
const viteBin = path.join(frontendDir, 'node_modules', 'vite', 'bin', 'vite.js');

console.log('\x1b[36m%s\x1b[0m', '>> Starting Sta. Rosa QR Attendance System (Backend + Frontend)...');

// Start backend
const backend = spawn(
  process.execPath,
  [
    '--watch-path=server.js',
    '--watch-path=app.js',
    '--watch-path=routes',
    '--watch-path=services',
    '--watch-path=middleware',
    '--watch-path=database/db.js',
    'server.js'
  ],
  {
    cwd: backendDir,
    stdio: 'inherit',
    env: process.env
  }
);

// Start frontend
const frontend = spawn(
  process.execPath,
  [viteBin],
  {
    cwd: frontendDir,
    stdio: 'inherit',
    env: process.env
  }
);

let isShuttingDown = false;
function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('\n\x1b[33m%s\x1b[0m', '>> Shutting down dev servers cleanly...');

  try {
    backend.kill();
  } catch (e) {}

  try {
    frontend.kill();
  } catch (e) {}

  // Allow brief tick for processes to exit
  setTimeout(() => {
    process.exit(0);
  }, 100);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

backend.on('exit', (code) => {
  if (!isShuttingDown && code !== 0 && code !== null) {
    shutdown();
  }
});

frontend.on('exit', (code) => {
  if (!isShuttingDown && code !== 0 && code !== null) {
    shutdown();
  }
});
