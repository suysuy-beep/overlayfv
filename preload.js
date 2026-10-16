'use strict';
const {contextBridge,ipcRenderer}=require('electron');
function on(channel,callback){
  if(typeof callback!=='function')return ()=>{};
  const listener=(_e,value)=>callback(value);
  ipcRenderer.on(channel,listener);
  return ()=>ipcRenderer.removeListener(channel,listener);
}
contextBridge.exposeInMainWorld('suytools',Object.freeze({
  getSettings:()=>ipcRenderer.invoke('suy:getSettings'),
  configure:patch=>ipcRenderer.invoke('suy:configure',patch),
  hide:()=>ipcRenderer.invoke('suy:hide'),
  resizeWindow:(width,height,edge)=>ipcRenderer.invoke('suy:resizeWindow',width,height,edge),
  moveWindow:(x,y)=>ipcRenderer.invoke('suy:moveWindow',x,y),
  loadBaduSync:()=>ipcRenderer.sendSync('suy:loadBaduSync'),
  saveBadu:state=>ipcRenderer.send('suy:saveBadu',JSON.stringify(state)),
  copyText:value=>ipcRenderer.invoke('suy:copy',value),
  captureScreen:()=>ipcRenderer.invoke('suy:capture'),
  loadBudgetSync:()=>ipcRenderer.sendSync('suy:loadBudgetSync'),
  saveBudget:state=>ipcRenderer.send('suy:saveBudget',JSON.stringify(state)),
  getUpdateStatus:()=>ipcRenderer.invoke('suy:getUpdateStatus'),
  checkUpdate:()=>ipcRenderer.invoke('suy:checkUpdate'),
  installUpdate:()=>ipcRenderer.invoke('suy:installUpdate'),
  onUpdate:callback=>on('suy:updateStatus',callback),
  onSettings:callback=>on('suy:settings',callback),
  onCaptured:callback=>on('suy:captured',callback),
  onCaptureError:callback=>on('suy:captureError',callback)
}));
