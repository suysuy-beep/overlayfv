'use strict';
(() => {
  const api=window.suytools;
  if(!api)return;
  const header=document.querySelector('.bar');
  const help=document.querySelector('#help');
  const button=(label,title,css)=>{
    const b=document.createElement('button');b.className='iconbtn '+css;
    b.type='button';b.textContent=label;b.title=title;b.setAttribute('aria-label',title);
    header.insertBefore(b,help);return b;
  };
  const captureBtn=button('▣','Capturar juego e importar productos','overlay-capture-btn');
  const importBtn=button('⇧','Importar una captura guardada','overlay-import-btn');
  const configBtn=button('⚙','Opciones del overlay','overlay-options-btn');
  const minimize=button('−','Ocultar en bandeja del sistema','overlay-hide');
  const config=document.createElement('div');config.className='overlay-config';config.hidden=true;
  config.innerHTML=`<h2>♡ Opciones del overlay</h2>
    <label for="suyWidth">Ancho del panel</label><select id="suyWidth"><option value="420">Estrecho · 420 px</option><option value="496">Normal · 496 px</option><option value="560">Amplio · 560 px</option></select>
    <label for="suySide">Lado de la pantalla</label><select id="suySide"><option value="right">Derecha</option><option value="left">Izquierda</option></select>
    <label for="suyOpacity">Transparencia</label><select id="suyOpacity"><option value="1">100% (opaco)</option><option value="0.95">95%</option><option value="0.9">90%</option></select>
    <div class="overlay-config-row"><span>Mantener encima</span><input type="checkbox" id="suyAlwaysOnTop" checked></div>
    <label for="suyToggleHotkey">Mostrar / ocultar</label><select id="suyToggleHotkey"></select>
    <label for="suyCaptureHotkey">Tomar captura</label><select id="suyCaptureHotkey"></select>
    <small id="suyHotkeyStatus">Comprobando atajos…</small>
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
    config.querySelector('#suyWidth').value=String(settings.width);
    config.querySelector('#suySide').value=settings.side;
    config.querySelector('#suyOpacity').value=String(settings.opacity);
    config.querySelector('#suyAlwaysOnTop').checked=settings.topmost;
    config.querySelector('#suyToggleHotkey').value=settings.hotkeys.toggle;
    config.querySelector('#suyCaptureHotkey').value=settings.hotkeys.capture;
    const both=settings.registered?.toggle&&settings.registered?.capture;
    config.querySelector('#suyHotkeyStatus').textContent=both?'✓ Atajos globales activos':
      '⚠ Una combinación no pudo registrarse. Prueba con Ctrl + Alt + O / P.';
  };
  const save=async()=>{
    const old=await api.getSettings();
    const patch={width:Number(config.querySelector('#suyWidth').value),side:config.querySelector('#suySide').value,
      opacity:Number(config.querySelector('#suyOpacity').value),topmost:config.querySelector('#suyAlwaysOnTop').checked,
      hotkeys:{toggle:config.querySelector('#suyToggleHotkey').value,capture:config.querySelector('#suyCaptureHotkey').value}};
    try{sync(await api.configure(patch));}catch(err){sync(old);config.querySelector('#suyHotkeyStatus').textContent='⚠ '+(err.message||'No se pudo asignar el atajo');}
  };
  config.addEventListener('change',save);
  configBtn.addEventListener('click',()=>{config.hidden=!config.hidden;});
  config.querySelector('#suyCloseSettings').addEventListener('click',()=>{config.hidden=true;});
  minimize.addEventListener('click',()=>api.hide());
  const load=async()=>{try{sync(await api.getSettings());}catch(e){console.error(e);}};
  load();api.onSettings(sync);
  captureBtn.addEventListener('click',()=>window.dispatchEvent(new Event('suy:startCapture')));
  importBtn.addEventListener('click',()=>window.dispatchEvent(new Event('suy:importFile')));
})();
