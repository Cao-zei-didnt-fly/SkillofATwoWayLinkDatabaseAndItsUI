const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('linkGarden', {execute:operation=>ipcRenderer.invoke('garden:execute',operation),connection:()=>ipcRenderer.invoke('garden:connection'),storage:operation=>ipcRenderer.invoke('garden:storage',operation),agents:operation=>ipcRenderer.invoke('garden:agents',operation)});
