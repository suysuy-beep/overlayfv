'use strict';
const {app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, clipboard, shell} = require('electron');
const path = require('path');
const fs = require('fs');

const APP_NAME = 'SuyTools Taller';
const BASE = {width:496, side:'right', opacity:1, topmost:true};
let settings={...BASE}, win, tray, quitting=false, settingsPath, budgetPath;
const WIDTHS = [420,496,560];
function clamp(value, a, b){return Math.min(b,Math.max(a,value));}
function loadSettings(){
  settingsPath=path.join(app.getPath('userData'),'overlay-settings.json');
  budgetPath=path.join(app.getPath('userData'),'taller-budget.json');
  try {
    const saved=JSON.parse(fs.readFileSync(settingsPath,'utf8'));
    settings.width=WIDTHS.includes(saved.width)?saved.width:BASE.width;
    settings.side=saved.side==='left'?'left':'right';
    settings.opacity=[1,.95,.9].includes(saved.opacity)?saved.opacity:1;
    settings.topmost=saved.topmost!==false;
  } catch (_) {}
}
function saveSettings(){try{fs.mkdirSync(path.dirname(settingsPath),{recursive:true});fs.writeFileSync(settingsPath,JSON.stringify(settings,null,2));}catch(err){console.warn('No se pudo guardar la configuración',err.message);}}
function boundsFor(width=settings.width){
  const work=screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const safeWidth=Math.min(width,Math.max(340,work.width-20));
  const height=Math.min(1000,Math.max(460,work.height-28));
  return {x:settings.side==='right'?work.x+work.width-safeWidth-10:work.x+10,y:work.y+Math.round((work.height-height)/2),width:safeWidth,height};
}
function applySettings(){
  if(!win||win.isDestroyed())return;
  win.setBounds(boundsFor());
  win.setOpacity(settings.opacity);
  win.setAlwaysOnTop(settings.topmost, 'floating');
  updateTray();
  win.webContents.send('suy:settings',settings);
}
function showWindow(){
  if(!win||win.isDestroyed())return;
  if(win.isMinimized())win.restore();
  win.show();win.focus();
  updateTray();
}
function hideWindow(){if(win&&!win.isDestroyed()){win.hide();updateTray();}}
function updateTray(){if(!tray)return;
  tray.setToolTip(APP_NAME + (win&&win.isVisible()?' — abierto':' — oculto'));
  tray.setContextMenu(Menu.buildFromTemplate([
    {label:'Mostrar calculadora',click:showWindow},
    {label:'Ocultar calculadora',enabled:!!win&&win.isVisible(),click:hideWindow},
    {type:'separator'},
    {label:'Siempre encima',type:'checkbox',checked:settings.topmost,click:item=>{settings.topmost=item.checked;saveSettings();applySettings();}},
    {type:'separator'},
    {label:'Salir de SuyTools',click:()=>{quitting=true;app.quit();}}
  ]));
}
function createMainWindow(){
  win=new BrowserWindow({
    ...boundsFor(),minWidth:360,minHeight:480,frame:false,transparent:true,backgroundColor:'#00000000',
    useContentSize:true,show:false,resizable:true,movable:true,focusable:true,skipTaskbar:false,
    icon:path.join(__dirname,'assets','icon.png'),
    webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,
      webSecurity:true,devTools:!app.isPackaged,backgroundThrottling:false}
  });
  win.setMenuBarVisibility(false);
  win.setAlwaysOnTop(settings.topmost,'floating');
  win.setOpacity(settings.opacity);
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',e=>e.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_webContents,_permission,callback)=>callback(false));
  win.loadFile(path.join(__dirname,'app','index.html'));
  win.once('ready-to-show',()=>{win.show();updateTray();});
  win.on('minimize',e=>{e.preventDefault();hideWindow();});
  win.on('close',e=>{if(!quitting){e.preventDefault();hideWindow();}});
  win.on('show',updateTray);win.on('hide',updateTray);
  // If a user resizes manually, the current window size is kept until a width preset is chosen.
}
function validateInvoke(fn){return e=>e.sender===win?.webContents?fn():null;}
app.whenReady().then(()=>{
  app.setAppUserModelId('com.suytools.taller');
  loadSettings();
  tray=new Tray(path.join(__dirname,'assets','tray.png'));
  tray.on('click',()=>win&&win.isVisible()?hideWindow():showWindow());
  createMainWindow();updateTray();
  ipcMain.handle('suy:getSettings',validateInvoke(()=>({...settings})));
  ipcMain.on('suy:loadBudgetSync',event=>{
    if(event.sender!==win?.webContents){event.returnValue=null;return;}
    try{const data=fs.readFileSync(budgetPath,'utf8');event.returnValue=data.length<50000?JSON.parse(data):null;}
    catch{event.returnValue=null;}
  });
  ipcMain.on('suy:saveBudget',(event,data)=>{
    if(event.sender!==win?.webContents || typeof data!=='string' || data.length>50000)return;
    try{JSON.parse(data);fs.writeFileSync(budgetPath,data,'utf8');}catch(err){console.warn('No se pudo guardar el presupuesto:',err.message);}
  });
  ipcMain.handle('suy:hide',validateInvoke(hideWindow));
  ipcMain.handle('suy:copy', (e,value)=>{if(e.sender!==win?.webContents)return false;if(typeof value!=='string'||value.length>10000)return false;clipboard.writeText(value);return true;});
  ipcMain.handle('suy:configure',(e,patch)=>{
    if(e.sender!==win?.webContents || !patch || typeof patch!=='object')return null;
    if(WIDTHS.includes(patch.width))settings.width=patch.width;
    if(['left','right'].includes(patch.side))settings.side=patch.side;
    if([1,.95,.9].includes(patch.opacity))settings.opacity=patch.opacity;
    if(typeof patch.topmost==='boolean')settings.topmost=patch.topmost;
    saveSettings();applySettings();return {...settings};
  });
});
app.on('activate',showWindow);
app.on('window-all-closed',()=>{}); // sigue disponible desde la bandeja
app.on('before-quit',()=>{quitting=true;});
