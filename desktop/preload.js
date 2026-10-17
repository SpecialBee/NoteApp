// The only bridge between the page and Electron: tells the page it's running as the desktop app,
// lets it open a URL in the real browser, and delivers graphidea:// deep links.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  onDeepLink: (cb) => ipcRenderer.on('deep-link', (_e, url) => cb(url)),
});
