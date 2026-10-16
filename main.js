'use strict';
const {app, BrowserWindow, ipcMain, Tray, Menu, screen, clipboard, globalShortcut, desktopCapturer} = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const {URL} = require('url');
const {autoUpdater} = require('electron-updater');

const APP_NAME = 'SuyTools Taller';
const ROOT = path.join(__dirname, 'app');
const BASE = {width:496, side:'right', opacity:1, topmost:true, manualBounds:null,
  hotkeys:{toggle:'Control+Alt+O',capture:'Control+Alt+P'}};
const WIDTHS = [420,496,560];
const ALLOWED_SHORTCUTS = ['Control+Alt+O','Control+Alt+P','Control+Alt+T', 'Control+Shift+F9',
  'Control+Shift+F10','F9','F10','F11','F12'];
let settings={...BASE, hotkeys:{...BASE.hotkeys}};
let win, tray, server, settingsPath, budgetPath, baduPath, quitting=false, captureBusy=false;
let hotkeyStatus={toggle:false,capture:false};
let updateState={phase:'idle',message:'Buscando actualizaciones al iniciar',version:null,percent:0};
let updateBusy=false;
function updateStatus(patch){
  updateState={...updateState,...patch};
  if(win&&!win.isDestroyed()&&!win.webContents.isLoading()){
    win.webContents.send('suy:updateStatus',{...updateState});
  }
}
function startAutoUpdater(){
  // Evita consultas en la version de desarrollo. Las compilaciones NSIS si tienen app-update.yml.
  if(!app.isPackaged){
    updateStatus({phase:'dev',message:'Actualizaciones disponibles en la version instalada.'});
    return;
  }
  autoUpdater.autoDownload=true;
  autoUpdater.autoInstallOnAppQuit=true;
  autoUpdater.allowPrerelease=false;
  autoUpdater.on('checking-for-update',()=>updateStatus({phase:'checking',message:'Buscando nueva version...'}));
  autoUpdater.on('update-available',info=>updateStatus({phase:'available',message:'Descargando version '+info.version,version:info.version,percent:0}));
  autoUpdater.on('update-not-available',()=>updateStatus({phase:'current',message:'Esta version esta al dia',percent:0}));
  autoUpdater.on('download-progress',info=>updateStatus({phase:'downloading',message:'Descargando actualizacion: '+Math.floor(info.percent)+'%',percent:Math.floor(info.percent)}));
  autoUpdater.on('update-downloaded',info=>updateStatus({phase:'ready',message:'Version '+info.version+' lista. Se instalara al salir de SuyTools.',version:info.version,percent:100}));
  autoUpdater.on('error',error=>{
    console.warn('Actualizaciones:',error.message);
    updateStatus({phase:'error',message:'No se pudo buscar la actualizacion. Reintentar desde ajustes.'});
  });
  // No bloquear la interfaz; las comprobaciones siguientes son espaciadas.
  setTimeout(()=>checkUpdates(),9000);
  setInterval(()=>checkUpdates(),6*60*60*1000).unref?.();
}
async function checkUpdates(){
  if(updateBusy||!app.isPackaged||updateState.phase==='ready')return;
  updateBusy=true;
  try{await autoUpdater.checkForUpdates();}catch(e){
    console.warn('Error de comprobacion:',e.message);
    updateStatus({phase:'error',message:'No se pudo comprobar. Comprueba tu conexion o la publicacion en GitHub.'});
  }finally{updateBusy=false;}
}

const ownedShortcuts=new Set();

function loadSettings(){
  const dataDir=app.getPath('userData');
  settingsPath=path.join(dataDir,'overlay-settings.json');
  budgetPath=path.join(dataDir,'taller-budget.json');
  baduPath=path.join(dataDir,'badulak-order.json');
  try{
    const data=JSON.parse(fs.readFileSync(settingsPath,'utf8'));
    settings.width=WIDTHS.includes(data.width)?data.width:BASE.width;
    settings.side=data.side==='left'?'left':'right';
    settings.opacity=[1,.95,.9].includes(data.opacity)?data.opacity:1;
    settings.topmost=true; // El panel siempre queda encima, sin esconderse al perder foco.
    const b=data.manualBounds;
    settings.manualBounds=b&&['x','y','width','height'].every(k=>Number.isFinite(b[k]))&&b.width>=380&&b.height>=480?{x:Math.round(b.x),y:Math.round(b.y),width:Math.round(b.width),height:Math.round(b.height)}:null;
    for(const type of ['toggle','capture']){
      const key=data.hotkeys?.[type];
      if(ALLOWED_SHORTCUTS.includes(key))settings.hotkeys[type]=key;
    }
    if(settings.hotkeys.toggle===settings.hotkeys.capture)settings.hotkeys={...BASE.hotkeys};
  }catch{}
}
function saveSettings(){try{fs.mkdirSync(path.dirname(settingsPath),{recursive:true});fs.writeFileSync(settingsPath,JSON.stringify(settings,null,2));}catch(e){console.warn('No se guardaron ajustes',e.message);}}
let saveSettingsTimer;
function saveSettingsSoon(){clearTimeout(saveSettingsTimer);saveSettingsTimer=setTimeout(saveSettings,220);}
function getDisplay(){
  return screen.getDisplayMatching(win?.getBounds()||screen.getPrimaryDisplay().workArea);
}
function boundsFor(width=settings.width){
  const work=screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const saved=settings.manualBounds;
  if(saved){
    const display=screen.getDisplayMatching(saved);
    const area=display.workArea;
    const w=Math.min(Math.max(380,saved.width),area.width);
    const h=Math.min(Math.max(480,saved.height),area.height);
    return {x:Math.min(Math.max(saved.x,area.x),area.x+area.width-w),y:Math.min(Math.max(saved.y,area.y),area.y+area.height-h),width:w,height:h};
  }
  const safeWidth=Math.min(width,Math.max(380,work.width-20));
  const height=Math.min(1000,Math.max(480,work.height-28));
  return {x:settings.side==='right'?work.x+work.width-safeWidth-10:work.x+10,y:work.y+Math.round((work.height-height)/2),width:safeWidth,height};
}

function publicSettings(){return {...settings,hotkeys:{...settings.hotkeys},registered:{...hotkeyStatus}};}
function emitSettings(){if(win&&!win.isDestroyed()&&!win.webContents.isLoading())win.webContents.send('suy:settings',publicSettings());}
function showWindow(){if(!win||win.isDestroyed())return;if(win.isMinimized())win.restore();win.show();win.focus();updateTray();}
function hideWindow(){if(!win||win.isDestroyed())return;win.hide();updateTray();}
function toggleWindow(){if(win?.isVisible())hideWindow();else showWindow();}
function applySettings(){
  if(!win||win.isDestroyed())return;
  win.setBounds(boundsFor());win.setOpacity(settings.opacity);
  win.setAlwaysOnTop(true,'screen-saver');updateTray();emitSettings();
}
function registerHotkeys(){
  // Only unregister the shortcuts our app owns. Never disturb other apps.
  for(const key of ownedShortcuts){
    if(globalShortcut.isRegistered(key))globalShortcut.unregister(key);
  }
  ownedShortcuts.clear();
  hotkeyStatus={toggle:false,capture:false};
  if(settings.hotkeys.toggle!==settings.hotkeys.capture){
    try{hotkeyStatus.toggle=globalShortcut.register(settings.hotkeys.toggle,toggleWindow);if(hotkeyStatus.toggle)ownedShortcuts.add(settings.hotkeys.toggle);}catch(e){console.warn('Atajo mostrar/ocultar:',e.message);}
    try{hotkeyStatus.capture=globalShortcut.register(settings.hotkeys.capture,()=>{
      if(captureBusy)return;
      captureDisplay().then(snapshot=>{
        showWindow();win.webContents.send('suy:captured',snapshot);
      }).catch(error=>{
        showWindow();win.webContents.send('suy:captureError',error.message);
      });
    });if(hotkeyStatus.capture)ownedShortcuts.add(settings.hotkeys.capture);}catch(e){console.warn('Atajo captura:',e.message);}
  }
  emitSettings();return {...hotkeyStatus};
}
function updateTray(){if(!tray)return;
  tray.setToolTip(APP_NAME + (win?.isVisible()?' — abierto':' — oculto'));
  tray.setContextMenu(Menu.buildFromTemplate([
    {label:'Mostrar calculadora',click:showWindow},
    {label:'Ocultar calculadora',enabled:!!win?.isVisible(),click:hideWindow},
    {label:'Capturar pantalla',click:()=>captureDisplay().then(snapshot=>{showWindow();win.webContents.send('suy:captured',snapshot);}).catch(e=>{showWindow();win.webContents.send('suy:captureError',e.message);})},
    {type:'separator'},
    {label:'Siempre visible al perder foco',enabled:false},
    {type:'separator'},
    {label:'Salir de SuyTools',click:()=>{quitting=true;app.quit();}}
  ]));
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function captureDisplay(){
  if(captureBusy)throw new Error('Ya hay una captura en proceso.');
  captureBusy=true;
  const target=getDisplay();
  const wasVisible=!!win?.isVisible();
  try{
    if(wasVisible){win.hide();await sleep(480);}
    // Captura única; no crea archivos ni mantiene grabaciones en segundo plano.
    const sources=await desktopCapturer.getSources({types:['screen'],fetchWindowIcons:false,
      thumbnailSize:{width:Math.min(4096,Math.round(target.size.width*target.scaleFactor)),
        height:Math.min(2560,Math.round(target.size.height*target.scaleFactor))}});
    const source=sources.find(item=>item.display_id===String(target.id)) ||
      (sources.length===1?sources[0]:null);
    if(!source||source.thumbnail.isEmpty())throw new Error('No se pudo capturar el monitor. Prueba FiveM en modo sin bordes o usa «Importar captura».');
    const dimensions=source.thumbnail.getSize();
    if(dimensions.width<50||dimensions.height<50)throw new Error('La captura llegó vacía.');
    return {dataUrl:source.thumbnail.toDataURL(),width:dimensions.width,height:dimensions.height};
  }finally{
    if(wasVisible)showWindow();
    captureBusy=false;
  }
}
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
  '.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.gz':'application/gzip','.wasm':'application/wasm',
  '.txt':'text/plain; charset=utf-8','.json':'application/json; charset=utf-8'};
function startAppServer(){
  // http://127.0.0.1 hace que los Workers offline de OCR funcionen en Electron.
  // Solo escucha en la máquina local y solo entrega archivos estáticos de /app.
  return new Promise((resolve,reject)=>{
    server=http.createServer((req,res)=>{
      if(req.method!=='GET'){res.writeHead(405);return res.end();}
      let pathname;
      try{pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{res.writeHead(400);return res.end();}
      if(pathname.includes('\0')){res.writeHead(400);return res.end();}
      const full=path.resolve(ROOT,'.'+(pathname==='/'?'/index.html':pathname));
      if(full!==path.join(ROOT,'index.html')&&!full.startsWith(ROOT+path.sep)){
        res.writeHead(403);return res.end();
      }
      fs.stat(full,(err,stat)=>{
        if(err||!stat.isFile()){res.writeHead(404);return res.end();}
        res.writeHead(200,{
          'Content-Type':MIME[path.extname(full).toLowerCase()]||'application/octet-stream',
          'Cache-Control':'no-store',
          'X-Content-Type-Options':'nosniff',
          'Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:; worker-src 'self' blob:; img-src 'self' data: blob:; connect-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'"
        });fs.createReadStream(full).pipe(res);
      });
    });
    server.on('error',reject);
    server.listen(0,'127.0.0.1',()=>resolve('http://127.0.0.1:'+server.address().port+'/'));
  });
}
async function createMainWindow(){
  const url=await startAppServer();
  win=new BrowserWindow({
    ...boundsFor(),title:'',minWidth:380,minHeight:480,thickFrame:false,hasShadow:false,frame:false,transparent:true,backgroundColor:'#00000000',
    useContentSize:true,show:false,resizable:true,movable:true,focusable:true,skipTaskbar:false,
    icon:path.join(__dirname,'assets','icon.png'),
    webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,
      sandbox:true,webSecurity:true,devTools:!app.isPackaged,backgroundThrottling:false}
  });
  // Frameless window: no native Windows caption strip, just our own dark header.
  // Prevent older page titles from being displayed in native UI.
  win.webContents.on('page-title-updated',event=>event.preventDefault());
  win.setTitle(''); // Sin título nativo, el encabezado visible es el de la app.
  win.setMenuBarVisibility(false);
  win.setAlwaysOnTop(true,'screen-saver');win.setOpacity(settings.opacity);
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(e,url)=>{if(url!==win.webContents.getURL())e.preventDefault();});
  win.webContents.session.setPermissionRequestHandler((_wc,_p,callback)=>callback(false));
  await win.loadURL(url);
  showWindow();emitSettings();
  win.on('minimize',e=>{e.preventDefault();hideWindow();});
  win.on('close',e=>{if(!quitting){e.preventDefault();hideWindow();}});
  win.on('show',updateTray);win.on('hide',updateTray);
  const rememberBounds=()=>{if(win?.isDestroyed())return;const b=win.getBounds();if(b.width>=380&&b.height>=480){settings.manualBounds=b;saveSettingsSoon();}};
  win.on('resize',rememberBounds);win.on('moved',rememberBounds);
  // Perder el foco (hacer clic en FiveM) NUNCA oculta ni minimiza la ventana.
  win.on('blur',()=>{if(!win.isDestroyed()&&win.isVisible())win.setAlwaysOnTop(true,'screen-saver');});

  registerHotkeys();
}
const authorized=e=>win&&!win.isDestroyed()&&e.sender===win.webContents;
app.whenReady().then(async()=>{
  app.setAppUserModelId('com.suytools.taller');
  if(!app.requestSingleInstanceLock()){app.quit();return;}
  app.on('second-instance',showWindow);
  loadSettings();
  tray=new Tray(path.join(__dirname,'assets','tray.png'));
  tray.on('click',showWindow);updateTray();
  ipcMain.handle('suy:getSettings',e=>authorized(e)?publicSettings():null);
  ipcMain.handle('suy:getUpdateStatus',e=>authorized(e)?{...updateState,currentVersion:app.getVersion()}:null);
  ipcMain.handle('suy:checkUpdate',e=>{
    if(!authorized(e))return null;
    if(!app.isPackaged)return {phase:'dev'};
    checkUpdates();return {...updateState};
  });
  ipcMain.handle('suy:installUpdate',e=>{
    if(!authorized(e)||updateState.phase!=='ready')return false;
    quitting=true;
    setImmediate(()=>autoUpdater.quitAndInstall(false,true));
    return true;
  });
  ipcMain.on('suy:loadBudgetSync',e=>{
    if(!authorized(e)){e.returnValue=null;return;}
    try{const content=fs.readFileSync(budgetPath,'utf8');e.returnValue=content.length<50000?JSON.parse(content):null;}
    catch{e.returnValue=null;}
  });
  ipcMain.on('suy:loadBaduSync',e=>{
    if(!authorized(e)){e.returnValue=null;return;}
    try{const content=fs.readFileSync(baduPath,'utf8');e.returnValue=content.length<50000?JSON.parse(content):null;}
    catch{e.returnValue=null;}
  });
  ipcMain.on('suy:saveBadu',(e,data)=>{
    if(!authorized(e)||typeof data!=='string'||data.length>50000)return;
    try{JSON.parse(data);fs.writeFileSync(baduPath,data,'utf8');}catch(error){console.warn('No se pudo guardar Badulak:',error.message);}
  });
  ipcMain.on('suy:saveBudget',(e,data)=>{
    if(!authorized(e)||typeof data!=='string'||data.length>50000)return;
    try{JSON.parse(data);fs.writeFileSync(budgetPath,data,'utf8');}catch(err){console.warn('No se pudo guardar presupuesto',err.message);}
  });
  // Custom resize handle on frameless transparent windows. Does not depend on native borders.
  // Manual drag prevents the native Windows title strip appearing above transparent windows.
  ipcMain.handle('suy:moveWindow',(e,x,y)=>{
    if(!authorized(e)||!Number.isFinite(x)||!Number.isFinite(y))return false;
    const b=win.getBounds();
    const area=screen.getDisplayMatching(b).workArea;
    const cx=Math.max(area.x,Math.min(Math.round(x),area.x+area.width-b.width));
    const cy=Math.max(area.y,Math.min(Math.round(y),area.y+area.height-b.height));
    win.setPosition(cx,cy);
    settings.manualBounds=win.getBounds();saveSettingsSoon();return true;
  });
  ipcMain.handle('suy:resizeWindow',(e,width,height,edge='right')=>{
    if(!authorized(e)||!Number.isFinite(width)||!Number.isFinite(height))return null;
    const b=win.getBounds();const area=screen.getDisplayMatching(b).workArea;
    const newHeight=Math.max(480,Math.min(Math.round(height),area.y+area.height-b.y));
    let x=b.x,w;
    if(edge==='left'){
      // Maintain the right-hand edge: resizing is useful when the overlay touches the screen's right side.
      const right=b.x+b.width;
      w=Math.max(380,Math.min(Math.round(width),right-area.x));
      x=right-w;
    } else {
      w=Math.max(380,Math.min(Math.round(width),area.x+area.width-b.x));
    }
    win.setBounds({x,y:b.y,width:w,height:newHeight});
    settings.manualBounds=win.getBounds();saveSettingsSoon();
    return {width:w,height:newHeight};
  });
  ipcMain.handle('suy:hide',e=>authorized(e)?hideWindow():null);
  ipcMain.handle('suy:copy',(e,value)=>{
    if(!authorized(e)||typeof value!=='string'||value.length>10000)return false;
    clipboard.writeText(value);return true;
  });
  ipcMain.handle('suy:capture',e=>{
    if(!authorized(e))throw new Error('Ventana no autorizada.');
    return captureDisplay();
  });
  ipcMain.handle('suy:configure',(e,patch)=>{
    if(!authorized(e)||!patch||typeof patch!=='object')return null;
    if(WIDTHS.includes(patch.width)&&patch.width!==settings.width){
      settings.width=patch.width;
      settings.manualBounds=null;
    }
    if(['left','right'].includes(patch.side)&&patch.side!==settings.side){settings.side=patch.side;settings.manualBounds=null;}
    if([1,.95,.9].includes(patch.opacity))settings.opacity=patch.opacity;
    settings.topmost=true;
    if(patch.hotkeys){
      const incoming={...settings.hotkeys};
      for(const name of ['toggle','capture'])if(ALLOWED_SHORTCUTS.includes(patch.hotkeys[name]))incoming[name]=patch.hotkeys[name];
      if(incoming.toggle!==incoming.capture){
        const previous={...settings.hotkeys};settings.hotkeys=incoming;
        const status=registerHotkeys();
        if(!status.toggle||!status.capture){
          // Si un juego u otra app ocupa esa tecla, recupera la combinación anterior.
          settings.hotkeys=previous;registerHotkeys();
          const error=new Error('Esa combinación ya está en uso. Prueba otra.');
          error.code='HOTKEY_TAKEN';throw error;
        }
      }
    }
    saveSettings();applySettings();return publicSettings();
  });
  try{await createMainWindow();startAutoUpdater();}catch(error){console.error('SuyTools no pudo iniciar:',error);app.quit();}
});
app.on('activate',showWindow);
app.on('window-all-closed',()=>{});
app.on('will-quit',()=>{globalShortcut.unregisterAll();server?.close();});
app.on('before-quit',()=>{quitting=true;clearTimeout(saveSettingsTimer);saveSettings();});
