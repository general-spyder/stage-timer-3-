const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  cmd: c => ipcRenderer.invoke('cmd', c),
  fonts: () => ipcRenderer.invoke('fonts'),
  displays: () => ipcRenderer.invoke('displays'),
  srv: (path, body) => ipcRenderer.invoke('srv', { path, body }),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdate: f => ipcRenderer.on('updmsg', (_, m) => f(m)),
  openExternal: u => ipcRenderer.invoke('openExternal', u)
});
