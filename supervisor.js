const { spawn } = require('child_process');
const path = require('path');

function startServer() {
  const child = spawn('node', [
    path.join(__dirname, 'node_modules/.bin/next'),
    'start', '-p', '3000', '-H', '0.0.0.0'
  ], {
    cwd: __dirname,
    stdio: 'inherit',
    detached: false,
  });

  child.on('exit', (code) => {
    console.log(`Server exited with code ${code}, restarting in 3s...`);
    setTimeout(startServer, 3000);
  });

  child.on('error', (err) => {
    console.error(`Server error: ${err}, restarting in 3s...`);
    setTimeout(startServer, 3000);
  });
}

startServer();
