// GRAPHIDEA desktop (Electron). Wraps the same www/ app the web and Android builds use.
//
// - The app is served from a private app:// scheme (registered as standard + secure) instead of
//   file://, so it gets a stable origin of its own: IndexedDB (offline cache/outbox) and
//   localStorage (session, settings) persist across launches, and it counts as a secure context.
// - Everything needed to start is bundled, so it opens with no network; data still syncs with
//   Supabase whenever the connection is there (same offline layer as web/Android).
// - graphidea:// deep links (Google Drive linking callback, "new"/"today") arrive here and are
//   forwarded to the page.

const { app, BrowserWindow, protocol, net, shell, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const WWW = path.join(__dirname, 'www');
const SCHEME = 'app';
const APP_ORIGIN = `${SCHEME}://graphidea`;
const SMOKE = process.env.GRAPHIDEA_SMOKE === '1'; // headless self-check used by `npm run smoke`

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

// one window, one process: a second launch (or a deep link opened from the browser) is handed
// to the running instance instead of starting another copy
if(!SMOKE && !app.requestSingleInstanceLock()){ app.quit(); }

// graphidea:// links open the app (Windows/Linux pass them on the command line)
if(process.defaultApp){
  if(process.argv.length >= 2) app.setAsDefaultProtocolClient('graphidea', process.execPath, [path.resolve(process.argv[1])]);
}else{
  app.setAsDefaultProtocolClient('graphidea');
}

let win = null;
let pendingDeepLink = process.argv.find(a => a.startsWith('graphidea://')) || null;

// ---- window size / position, remembered between launches ----
const STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');
function loadWindowState(){
  try{ return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }catch(e){ return { width: 1440, height: 900 }; }
}
function saveWindowState(){
  if(!win || win.isDestroyed()) return;
  const b = win.getNormalBounds();
  try{ fs.writeFileSync(STATE_FILE, JSON.stringify({ ...b, maximized: win.isMaximized() })); }catch(e){}
}

function sendDeepLink(url){
  if(!url) return;
  if(win && !win.isDestroyed() && !win.webContents.isLoading()) win.webContents.send('deep-link', url);
  else pendingDeepLink = url;
}

function createWindow(){
  const st = loadWindowState();
  win = new BrowserWindow({
    width: st.width || 1440, height: st.height || 900, x: st.x, y: st.y,
    minWidth: 820, minHeight: 560,
    title: 'GRAPHIDEA',
    backgroundColor: '#F5F4EE',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    show: !SMOKE,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false, // red squiggles under Korean prose in the editor were noise, not help
    },
  });
  if(st.maximized && !SMOKE) win.maximize();

  // links to the outside world open in the default browser, never inside the app window
  win.webContents.setWindowOpenHandler(({ url }) => {
    if(/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if(!url.startsWith(APP_ORIGIN)){ e.preventDefault(); if(/^https?:/i.test(url)) shell.openExternal(url); }
  });

  win.webContents.on('did-finish-load', () => {
    if(pendingDeepLink){ const u = pendingDeepLink; pendingDeepLink = null; setTimeout(() => sendDeepLink(u), 300); }
  });

  for(const ev of ['resize', 'move', 'close']) win.on(ev, saveWindowState);
  win.loadURL(`${APP_ORIGIN}/index.html`);

  if(SMOKE) runSmokeTest();
}

// ---- headless self-check: boots the app, reads a few facts from the page, prints JSON, exits ----
function runSmokeTest(){
  const errors = [];
  win.webContents.on('console-message', (e) => { if(e.level === 'error') errors.push(e.message); });
  win.webContents.on('did-fail-load', (_e, code, desc, url) => errors.push(`load failed ${code} ${desc} ${url}`));
  win.webContents.once('did-finish-load', async () => {
    await new Promise(r => setTimeout(r, 2500));
    let facts = {};
    try{
      facts = await win.webContents.executeJavaScript(`(async () => ({
        title: document.title,
        origin: location.origin,
        secure: window.isSecureContext,
        loginShown: getComputedStyle(document.getElementById('loginWrap')).display !== 'none',
        localDB: typeof LocalDB,
        supabase: typeof window.supabase,
        desktopBridge: !!(window.desktop && window.desktop.isDesktop),
        font: getComputedStyle(document.body).fontFamily.split(',')[0],
        icons: document.querySelectorAll('symbol[id^="ic-"]').length,
        // the app runs from app://graphidea — make sure Supabase accepts requests from that origin (CORS)
        supabaseReachable: await fetch('https://curwidzkbjdyremkfpgh.supabase.co/auth/v1/settings', { headers: { apikey: 'sb_publishable_3kVI4cBl2nTHRSWq_oZAbQ_Mfa5-mWk' } }).then(r => r.status).catch(e => 'ERR ' + e.message),
        indexedDB: await new Promise(res => { const r = indexedDB.open('graphidea-smoke'); r.onsuccess = () => { r.result.close(); indexedDB.deleteDatabase('graphidea-smoke'); res('ok'); }; r.onerror = () => res('ERR'); }),
      }))()`);
    }catch(e){ errors.push('executeJavaScript: ' + e.message); }
    process.stdout.write('SMOKE ' + JSON.stringify({ facts, errors }) + '\n');
    app.exit(errors.length ? 1 : 0);
  });
}

// ---- app:// -> files in www/ (with a path-traversal guard) ----
function registerAppProtocol(){
  protocol.handle(SCHEME, (req) => {
    const { pathname } = new URL(req.url);
    const rel = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.normalize(path.join(WWW, rel));
    if(!file.startsWith(WWW)) return new Response('forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

function buildMenu(){
  // hidden by default (Alt shows it); kept for the standard edit shortcuts and zoom / devtools
  const template = [
    { label: '편집', submenu: [ { role: 'undo', label: '실행 취소' }, { role: 'redo', label: '다시 실행' }, { type: 'separator' }, { role: 'cut', label: '잘라내기' }, { role: 'copy', label: '복사' }, { role: 'paste', label: '붙여넣기' }, { role: 'selectAll', label: '모두 선택' } ] },
    { label: '보기', submenu: [ { role: 'reload', label: '새로 고침' }, { type: 'separator' }, { role: 'resetZoom', label: '원래 크기' }, { role: 'zoomIn', label: '확대' }, { role: 'zoomOut', label: '축소' }, { type: 'separator' }, { role: 'togglefullscreen', label: '전체 화면' }, { role: 'toggleDevTools', label: '개발자 도구' } ] },
    { label: '도움말', submenu: [ { label: `GRAPHIDEA ${app.getVersion()}`, enabled: false }, { label: '웹 버전 열기', click: () => shell.openExternal('https://note-app-gamma-wheat.vercel.app/') } ] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.handle('open-external', (_e, url) => {
  if(typeof url === 'string' && /^https?:/i.test(url)) return shell.openExternal(url);
});

app.on('second-instance', (_e, argv) => {
  const url = argv.find(a => a.startsWith('graphidea://'));
  if(url) sendDeepLink(url);
  if(win){ if(win.isMinimized()) win.restore(); win.focus(); }
});
app.on('open-url', (e, url) => { e.preventDefault(); sendDeepLink(url); }); // macOS

app.whenReady().then(() => {
  registerAppProtocol();
  buildMenu();
  createWindow();
});
app.on('window-all-closed', () => { if(process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if(BrowserWindow.getAllWindows().length === 0) createWindow(); });
