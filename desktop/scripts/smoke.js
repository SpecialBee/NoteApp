// Launches the app headless with GRAPHIDEA_SMOKE=1: main.js boots the page, reads a few facts
// (origin, offline store, bridge, font, icons) and prints them as JSON, then exits non-zero on errors.
const { spawn } = require('child_process');
const electron = require('electron');
const path = require('path');

const child = spawn(electron, [path.join(__dirname, '..')], { env: { ...process.env, GRAPHIDEA_SMOKE: '1' }, stdio: ['ignore', 'pipe', 'inherit'] });
let out = '';
child.stdout.on('data', d => { out += d; });
child.on('exit', code => {
  const line = out.split('\n').find(l => l.startsWith('SMOKE '));
  console.log(line ? JSON.stringify(JSON.parse(line.slice(6)), null, 2) : out);
  process.exit(code);
});
setTimeout(() => { console.error('smoke test timed out'); child.kill(); process.exit(1); }, 60000);
