'use strict';
(() => {
  const api = window.suytools;
  if(!api)return; // Vista en navegador: controles nativos ocultos.
  const header=document.querySelector('.bar');
  const help=document.querySelector('#help');
  const minimize=document.createElement('button');minimize.className='iconbtn overlay-hide';
  minimize.type='button';minimize.textContent='−';minimize.title='Ocultar en bandeja del sistema';minimize.setAttribute('aria-label','Ocultar calculadora');
  const configBtn=document.createElement('button');configBtn.type='button';configBtn.className='iconbtn overlay-options-btn';
  configBtn.textContent='⚙';configBtn.title='Opciones del overlay';configBtn.setAttribute('aria-label','Opciones del overlay');
  const config=document.createElement('div');config.className='overlay-config';config.hidden=true;
  config.innerHTML=`<h2>♡ Opciones del overlay</h2>
    <label for="suyWidth">Ancho del panel</label><select id="suyWidth"><option value="420">Estrecho · 420 px</option><option value="496">Normal · 496 px</option><option value="560">Amplio · 560 px</option></select>
    <label for="suySide">Lado de la pantalla</label><select id="suySide"><option value="right">Derecha</option><option value="left">Izquierda</option></select>
    <label for="suyOpacity">Transparencia de ventana</label><select id="suyOpacity"><option value="1">100% (sin transparencia)</option><option value="0.95">95%</option><option value="0.9">90%</option></select>
    <div class="overlay-config-row"><span>Mantener encima</span><input type="checkbox" id="suyAlwaysOnTop" checked></div>
    <small>Para ocultar, usa «−». Para volver a abrir, haz clic en el icono de SuyTools junto al reloj de Windows. Los atajos de teclado se añadirán después.</small>
    <button type="button" class="overlay-config-close" id="suyCloseSettings">Listo</button>`;
  header.insertBefore(configBtn,help);header.insertBefore(minimize,help);
  document.querySelector('.panel').appendChild(config);
  const sync=settings=>{
    if(!settings)return;
    config.querySelector('#suyWidth').value=String(settings.width);
    config.querySelector('#suySide').value=settings.side;
    config.querySelector('#suyOpacity').value=String(settings.opacity);
    config.querySelector('#suyAlwaysOnTop').checked=settings.topmost;
  };
  const save=async()=>{
    const newSettings={width:Number(config.querySelector('#suyWidth').value),side:config.querySelector('#suySide').value,
      opacity:Number(config.querySelector('#suyOpacity').value),topmost:config.querySelector('#suyAlwaysOnTop').checked};
    try{sync(await api.configure(newSettings));}catch(err){console.error('No se pudieron aplicar ajustes',err)}
  };
  config.addEventListener('change',save);
  configBtn.addEventListener('click',()=>{config.hidden=!config.hidden;});
  config.querySelector('#suyCloseSettings').addEventListener('click',()=>{config.hidden=true;});
  minimize.addEventListener('click',()=>api.hide());
  api.getSettings().then(sync).catch(console.error);
  api.onSettings(sync);
})();
