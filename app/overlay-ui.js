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
  const themeBtn=button('♡','Cambiar color de SuyTools','suy-theme-btn');
  window.suyTheme?.mount?.(themeBtn);
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
    <label for="suyToggleHotkey">Mostrar / ocultar</label><input id="suyToggleHotkey" class="suy-hotkey-input" type="text" readonly placeholder="Haz clic y pulsa tu atajo" autocomplete="off" spellcheck="false" aria-label="Grabar atajo para mostrar u ocultar">
    <label for="suyCaptureHotkey">Tomar captura</label><input id="suyCaptureHotkey" class="suy-hotkey-input" type="text" readonly placeholder="Haz clic y pulsa tu atajo" autocomplete="off" spellcheck="false" aria-label="Grabar atajo para tomar captura">
    <small>Haz clic en un campo y pulsa la combinación. <strong>Esc</strong> cancela. Evita atajos que FiveM ya use.</small>
    <small id="suyHotkeyStatus">Comprobando atajos…</small>
    <div class="suy-update-box">
      <label>Actualizaciones</label>
      <small id="suyUpdateStatus">Buscando actualizaciones...</small>
      <div class="suy-update-actions"><button type="button" id="suyCheckUpdate">Buscar ahora</button><button type="button" id="suyInstallUpdate" hidden>Instalar y reiniciar</button></div>
    </div>
    <small>Los atajos funcionan aunque estés dentro del juego, siempre que Windows y FiveM no tengan ocupada esa combinación. La captura es puntual y solo queda en memoria.</small>
    <button type="button" class="overlay-config-close" id="suyCloseSettings">Listo</button>`;
  const readable=x=>(x||'').replace('Control','Ctrl').replace('num','Numpad ').replaceAll('+',' + ');
  // event.code funciona de manera consistente con distintos idiomas de teclado.
  const eventAccelerator=event=>{
    if(event.metaKey)return null;
    const code=event.code||'';
    let key='';
    if(/^Key[A-Z]$/.test(code))key=code.slice(3);
    else if(/^Digit[0-9]$/.test(code))key=code.slice(5);
    else if(/^F(?:[1-9]|1\d|2[0-4])$/.test(code))key=code;
    else if(/^Numpad[0-9]$/.test(code))key='num'+code.slice(6);
    else {
      const pad={NumpadAdd:'numadd',NumpadSubtract:'numsub',NumpadMultiply:'nummult',NumpadDivide:'numdiv',NumpadDecimal:'numdec'};
      key=pad[code]||'';
    }
    if(!key)return null;
    const mods=['Control','Alt','Shift'].filter((mod)=>mod==='Control'?event.ctrlKey:mod==='Alt'?event.altKey:event.shiftKey);
    if(!mods.length&&!/^F\d+$|^num/.test(key))return null;
    if(mods.length===1&&mods[0]==='Alt'&&key==='F4')return null;
    return [...mods,key].join('+');
  };
  let captureTarget=null;
  let changing=false;
  const hotkeyStatus=config.querySelector('#suyHotkeyStatus');
  for(const id of ['suyToggleHotkey','suyCaptureHotkey']){
    const input=config.querySelector('#'+id);
    input.addEventListener('focus',()=>{
      captureTarget=id;
      input.dataset.previous=input.dataset.accelerator||'';
      input.value='Pulsa tu combinación…';
      input.classList.add('recording');
    });
    input.addEventListener('keydown',async event=>{
      event.preventDefault();event.stopPropagation();
      if(event.key==='Escape'){
        input.value=readable(input.dataset.accelerator||input.dataset.previous);
        input.blur();return;
      }
      if(event.repeat||changing)return;
      const shortcut=eventAccelerator(event);
      if(!shortcut){
        if(!['Control','Shift','Alt','Meta'].includes(event.key))hotkeyStatus.textContent='Usa F1-F24, teclado numérico o Ctrl/Alt + letra o número.';
        return;
      }
      changing=true;
      try{
        const type=id==='suyToggleHotkey'?'toggle':'capture';
        const patch={hotkeys:{[type]:shortcut}};
        const updated=await api.configure(patch);
        sync(updated);
        hotkeyStatus.textContent='✓ Guardado: '+readable(shortcut);
      }catch(err){
        hotkeyStatus.textContent='⚠ '+(err.message||'No se pudo registrar este atajo');
        input.value=readable(input.dataset.accelerator||input.dataset.previous);
      }finally{
        changing=false;input.blur();
      }
    });
    input.addEventListener('blur',()=>{
      input.classList.remove('recording');captureTarget=null;
      if(!changing)input.value=readable(input.dataset.accelerator||input.dataset.previous);
    });
  }
  document.querySelector('.panel').append(config);
  const sync=settings=>{
    if(!settings)return;
    resizeEdge=settings.side==='right'?'left':'right';
    grip.classList.toggle('edge-left',resizeEdge==='left');
    config.querySelector('#suyWidth').value=String(settings.width);
    config.querySelector('#suySide').value=settings.side;
    config.querySelector('#suyOpacity').value=String(settings.opacity);
    window.suyTheme?.sync?.(settings.accent);
    for(const [id,key] of [['suyToggleHotkey','toggle'],['suyCaptureHotkey','capture']]){
      const input=config.querySelector('#'+id);
      input.dataset.accelerator=settings.hotkeys[key];
      if(document.activeElement!==input || !input.classList.contains('recording'))input.value=readable(settings.hotkeys[key]);
    }
    const both=settings.registered?.toggle&&settings.registered?.capture;
    config.querySelector('#suyHotkeyStatus').textContent=both?'✓ Atajos globales activos':
      '⚠ Un atajo está ocupado. Haz clic en su campo para cambiarlo.';
  };
  const save=async()=>{
    const old=await api.getSettings();
    const patch={width:Number(config.querySelector('#suyWidth').value),side:config.querySelector('#suySide').value,
      opacity:Number(config.querySelector('#suyOpacity').value),
      };
    try{sync(await api.configure(patch));}catch(err){sync(old);config.querySelector('#suyHotkeyStatus').textContent='⚠ '+(err.message||'No se pudo asignar el atajo');}
  };
  config.addEventListener('change',event=>{if(event.target.matches('select'))save();});
  configBtn.addEventListener('click',()=>{window.suyTheme?.close?.();config.hidden=!config.hidden;});
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
