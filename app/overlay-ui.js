'use strict';
(() => {
  const api=window.suytools;
  if(!api)return;
  const header=document.querySelector('.bar');
  // Dragging the header uses our own movement, never the Windows native caption.
  let moving=null,movingPending=false;
  header.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.target.closest('button,input,select,textarea,a,.overlay-config'))return;
    moving={screenX:event.screenX,screenY:event.screenY,x:window.screenX,y:window.screenY};
    header.setPointerCapture(event.pointerId);event.preventDefault();
  });
  header.addEventListener('pointermove',event=>{
    if(!moving||movingPending)return;
    const x=moving.x+(event.screenX-moving.screenX),y=moving.y+(event.screenY-moving.screenY);
    movingPending=true;requestAnimationFrame(()=>{movingPending=false;api.moveWindow(x,y).catch(console.warn);});
  });
  for(const evt of ['pointerup','pointercancel','lostpointercapture'])header.addEventListener(evt,()=>{moving=null;});
  const help=document.querySelector('#help');
  const button=(label,title,css)=>{
    const b=document.createElement('button');b.className='iconbtn '+css;
    b.type='button';b.textContent=label;b.title=title;b.setAttribute('aria-label',title);
    header.insertBefore(b,help);return b;
  };
  const captureBtn=button('▣','Capturar juego e importar productos','overlay-capture-btn');
  const importBtn=button('⇧','Importar una captura guardada','overlay-import-btn');
  const configBtn=button('⚙','Opciones del overlay','overlay-options-btn');
  let resizeEdge='left';
  const grip=document.createElement('button');
  grip.type='button';grip.className='suy-resize';grip.title='Arrastrar para cambiar tamaño';
  grip.setAttribute('aria-label','Cambiar tamaño de SuyTools');
  document.body.append(grip);
  grip.classList.add('edge-left');
  let dragging=null, framePending=false;
  grip.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    dragging={x:event.screenX,y:event.screenY,width:window.outerWidth,height:window.outerHeight};
    grip.setPointerCapture(event.pointerId);event.preventDefault();
  });
  grip.addEventListener('pointermove',event=>{
    if(!dragging)return;
    const width=dragging.width+(resizeEdge==='left'?-1:1)*(event.screenX-dragging.x);
    const height=dragging.height+(event.screenY-dragging.y);
    if(framePending)return;
    framePending=true;
    requestAnimationFrame(()=>{framePending=false;api.resizeWindow(width,height,resizeEdge).catch(console.warn);});
  });
  for(const evt of ['pointerup','pointercancel','lostpointercapture'])grip.addEventListener(evt,()=>{dragging=null;});
  window.addEventListener('suy:toolChanged',event=>{
    const taller=event.detail?.tool==='taller';
    captureBtn.classList.toggle('hidden',!taller);
    importBtn.classList.toggle('hidden',!taller);
  });
  captureBtn.classList.toggle('hidden',document.body.dataset.tool==='badu');
  importBtn.classList.toggle('hidden',document.body.dataset.tool==='badu');
  const config=document.createElement('div');config.className='overlay-config';config.hidden=true;
  config.innerHTML=`<h2>♡ Opciones del overlay</h2>
    <label for="suyWidth">Ancho del panel</label><select id="suyWidth"><option value="420">Estrecho · 420 px</option><option value="496">Normal · 496 px</option><option value="560">Amplio · 560 px</option></select>
    <label for="suySide">Lado de la pantalla</label><select id="suySide"><option value="right">Derecha</option><option value="left">Izquierda</option></select>
    <label for="suyOpacity">Transparencia</label><select id="suyOpacity"><option value="1">100% (opaco)</option><option value="0.95">95%</option><option value="0.9">90%</option></select>
    <small>Puedes redimensionar arrastrando la esquina inferior derecha. El panel guarda el tamaño y permanece visible aunque hagas clic en FiveM.</small>
    <label for="suyToggleHotkey">Mostrar / ocultar</label><select id="suyToggleHotkey"></select>
    <label for="suyCaptureHotkey">Tomar captura</label><select id="suyCaptureHotkey"></select>
    <small id="suyHotkeyStatus">Comprobando atajos…</small>
    <div class="suy-update-box">
      <label>Actualizaciones</label>
      <small id="suyUpdateStatus">Buscando actualizaciones...</small>
      <div class="suy-update-actions"><button type="button" id="suyCheckUpdate">Buscar ahora</button><button type="button" id="suyInstallUpdate" hidden>Instalar y reiniciar</button></div>
    </div>
    <small>Los atajos funcionan aunque estés dentro del juego, siempre que Windows y FiveM no tengan ocupada esa combinación. La captura es puntual y solo queda en memoria.</small>
    <button type="button" class="overlay-config-close" id="suyCloseSettings">Listo</button>`;
  const comboList=['Control+Alt+O','Control+Alt+P','Control+Alt+T','Control+Shift+F9','Control+Shift+F10','F9','F10','F11','F12'];
  const readable=x=>x.replace('Control','Ctrl').replaceAll('+',' + ');
  for(const id of ['suyToggleHotkey','suyCaptureHotkey']){
    config.querySelector('#'+id).innerHTML=comboList.map(x=>`<option value="${x}">${readable(x)}</option>`).join('');
  }
  document.querySelector('.panel').append(config);
  const sync=settings=>{
    if(!settings)return;
    resizeEdge=settings.side==='right'?'left':'right';
    grip.classList.toggle('edge-left',resizeEdge==='left');
    config.querySelector('#suyWidth').value=String(settings.width);
    config.querySelector('#suySide').value=settings.side;
    config.querySelector('#suyOpacity').value=String(settings.opacity);
    config.querySelector('#suyToggleHotkey').value=settings.hotkeys.toggle;
    config.querySelector('#suyCaptureHotkey').value=settings.hotkeys.capture;
    const both=settings.registered?.toggle&&settings.registered?.capture;
    config.querySelector('#suyHotkeyStatus').textContent=both?'✓ Atajos globales activos':
      '⚠ Una combinación no pudo registrarse. Prueba con Ctrl + Alt + O / P.';
  };
  const save=async()=>{
    const old=await api.getSettings();
    const patch={width:Number(config.querySelector('#suyWidth').value),side:config.querySelector('#suySide').value,
      opacity:Number(config.querySelector('#suyOpacity').value),
      hotkeys:{toggle:config.querySelector('#suyToggleHotkey').value,capture:config.querySelector('#suyCaptureHotkey').value}};
    try{sync(await api.configure(patch));}catch(err){sync(old);config.querySelector('#suyHotkeyStatus').textContent='⚠ '+(err.message||'No se pudo asignar el atajo');}
  };
  config.addEventListener('change',save);
  configBtn.addEventListener('click',()=>{config.hidden=!config.hidden;});
  config.querySelector('#suyCloseSettings').addEventListener('click',()=>{config.hidden=true;});
  const showUpdate=state=>{
    if(!state)return;
    const current=state.currentVersion?` (v${state.currentVersion})`:'';
    config.querySelector('#suyUpdateStatus').textContent=(state.message||'Actualizaciones sin configurar')+current;
    config.querySelector('#suyInstallUpdate').hidden=state.phase!=='ready';
  };
  config.querySelector('#suyCheckUpdate').addEventListener('click',()=>api.checkUpdate());
  config.querySelector('#suyInstallUpdate').addEventListener('click',()=>api.installUpdate());
  api.onUpdate(showUpdate);
  api.getUpdateStatus().then(showUpdate).catch(console.warn);
  const load=async()=>{try{sync(await api.getSettings());}catch(e){console.error(e);}};
  load();api.onSettings(sync);
  captureBtn.addEventListener('click',()=>window.dispatchEvent(new Event('suy:startCapture')));
  importBtn.addEventListener('click',()=>window.dispatchEvent(new Event('suy:importFile')));
})();
