// Copies the shared web app (../www) into desktop/www before running or packaging, so the
// desktop build always ships exactly what the web/Android builds ship. desktop/www is generated
// (gitignored) — edit ../www, never this copy.
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', '..', 'www');
const dst = path.join(__dirname, '..', 'www');

fs.rmSync(dst, { recursive: true, force: true });
fs.cpSync(src, dst, { recursive: true });

// app icon for the window/installer comes from the shared asset
fs.mkdirSync(path.join(__dirname, '..', 'build'), { recursive: true });
fs.copyFileSync(path.join(__dirname, '..', '..', 'assets', 'icon.png'), path.join(__dirname, '..', 'build', 'icon.png'));

console.log('copied www -> desktop/www');
