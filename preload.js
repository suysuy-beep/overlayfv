'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('suytools',Object.freeze({
  getSettings:()=>ipcRenderer.invoke('suy:getSettings'),
  configure:patch=>ipcRenderer.invoke('suy:configure',patch),
  hide:()=>ipcRenderer.invoke('suy:hide'),
  copyText:text=>ipcRenderer.invoke('suy:copy',text),
  loadBudgetSync:()=>ipcRenderer.sendSync('suy:loadBudgetSync'),
  saveBudget:state=>ipcRenderer.send('suy:saveBudget',JSON.stringify(state)),
  onSettings:callback=>{
    if(typeof callback!=='function')return ()=>{};
    const listener=(_e,value)=>callback(value);
    ipcRenderer.on('suy:settings',listener);
    return ()=>ipcRenderer.removeListener('suy:settings',listener);
  }
}));
