'use strict';
// Custom radial HSV color picker. Runs entirely offline, without third-party dependencies.
(() => {
  const DEFAULT = '#e98faf';
  const api = window.suytools;
  const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
  const valid = value => /^#[0-9a-f]{6}$/i.test(value||'');
  const hsvToRgb = (h,s,v) => {
    const c=v*s, x=c*(1-Math.abs((h/60)%2-1)), m=v-c;
    const [r,g,b]=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
    return [r+m,g+m,b+m].map(a=>Math.round(a*255));
  };
  const toHex=rgb=>'#'+rgb.map(x=>clamp(Math.round(x),0,255).toString(16).padStart(2,'0')).join('');
  const fromHex=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
  const rgbToHsv=([r,g,b])=>{
    r/=255;g/=255;b/=255;
    const hi=Math.max(r,g,b),lo=Math.min(r,g,b),d=hi-lo;
    let h=0;
    if(d){if(hi===r)h=((g-b)/d)%6;else if(hi===g)h=(b-r)/d+2;else h=(r-g)/d+4;}
    h=((h*60)%360+360)%360;
    return {h,s:hi===0?0:d/hi,v:hi};
  };
  const css = (hex)=>{
    const [r,g,b]=fromHex(hex);
    const linear=v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4};
    const luminance=.2126*linear(r)+.7152*linear(g)+.0722*linear(b);
    const ink=luminance>.36?'#201622':'#fff8fd';
    document.documentElement.style.setProperty('--suy-accent',hex);
    document.documentElement.style.setProperty('--suy-accent-text',ink);
    const frame=document.getElementById('baduFrame');
    // The iframe is local to SuyTools; never post theme updates to external origins.
    if(frame?.contentWindow)frame.contentWindow.postMessage({type:'suy:theme',accent:hex,text:ink},window.location.origin==='null'?'*':window.location.origin);
  };
  let hsv=rgbToHsv(fromHex(DEFAULT)),color=DEFAULT;
  let picker,button,canvas,brightness,swatch,hexInput,indicator,saveLabel;
  let commitPending=false;
  const preview = () => {
    color=toHex(hsvToRgb(hsv.h,hsv.s,hsv.v));
    css(color);
    if(!picker)return;
    brightness.style.background=`linear-gradient(90deg,#000000,${toHex(hsvToRgb(hsv.h,hsv.s,1))})`;
    brightness.value=Math.round(hsv.v*100);
    swatch.style.background=color;
    hexInput.value=color.toUpperCase();
    indicator.style.left=(50+Math.sin(hsv.h*Math.PI/180)*hsv.s*43)+'%';
    indicator.style.top=(50-Math.cos(hsv.h*Math.PI/180)*hsv.s*43)+'%';
    indicator.style.background=color;
    saveLabel.textContent='Vista previa';
  };
  const commit = async () => {
    if(!api?.configure||commitPending)return;
    commitPending=true;
    saveLabel.textContent='Guardando…';
    try{
      const settings=await api.configure({accent:color});
      if(settings?.accent&&valid(settings.accent)){
        color=settings.accent;
        hsv=rgbToHsv(fromHex(color));
        css(color);
      }
      saveLabel.textContent='Color guardado ♡';
    }catch(error){
      saveLabel.textContent='No se pudo guardar';
      console.warn('SuyTools color:',error);
    }finally{commitPending=false;}
  };
  const draw = () => {
    const ctx=canvas.getContext('2d',{willReadFrequently:false});
    const w=canvas.width,rad=w/2,src=ctx.createImageData(w,w);
    for(let y=0;y<w;y++)for(let x=0;x<w;x++){
      const dx=x-rad+.5,dy=y-rad+.5,d=Math.sqrt(dx*dx+dy*dy);
      const off=(y*w+x)*4;
      if(d>rad-2){src.data[off+3]=0;continue;}
      const hue=((Math.atan2(dx,-dy)*180/Math.PI)%360+360)%360;
      const [r,g,b]=hsvToRgb(hue,clamp(d/(rad-2),0,1),1);
      src.data[off]=r;src.data[off+1]=g;src.data[off+2]=b;
      src.data[off+3]=d>rad-4?Math.round(255*clamp((rad-2-d)/2,0,1)):255;
    }
    ctx.putImageData(src,0,0);
  };
  const pickFromEvent=event=>{
    const bounds=canvas.getBoundingClientRect();
    const dx=event.clientX-(bounds.left+bounds.width/2);
    const dy=event.clientY-(bounds.top+bounds.height/2);
    hsv.h=((Math.atan2(dx,-dy)*180/Math.PI)%360+360)%360;
    hsv.s=clamp(Math.hypot(dx,dy)/(bounds.width/2-3),0,1);
    preview();
  };
  const close=()=>{if(picker){picker.hidden=true;button?.setAttribute('aria-expanded','false');}};
  function mount(btn){
    if(picker)return;
    button=btn;
    button.setAttribute('aria-expanded','false');
    button.setAttribute('aria-haspopup','dialog');
    picker=document.createElement('section');
    picker.className='suy-theme-panel';picker.hidden=true;
    picker.setAttribute('aria-label','Elegir color de SuyTools');
    picker.innerHTML=`<div class="suy-theme-head"><strong>♡ Tu colorcito</strong><button class="suy-theme-close" type="button" aria-label="Cerrar selector de color">×</button></div>
      <p class="suy-theme-hint">Mueve el punto por la rueda para elegir el tono y su intensidad.</p>
      <div class="suy-theme-wheel-wrap"><canvas class="suy-theme-wheel" width="320" height="320" aria-label="Rueda radial de colores"></canvas><div class="suy-theme-indicator" aria-hidden="true"></div></div>
      <label class="suy-theme-slider-label" for="suyBrightness">Brillo <span>☼</span></label><input id="suyBrightness" class="suy-theme-slider" type="range" min="20" max="100" step="1" value="100" aria-label="Brillo del color"/>
      <div class="suy-theme-preview"><span class="suy-theme-swatch" aria-hidden="true"></span><input class="suy-theme-hex" aria-label="Color hexadecimal" maxlength="7" spellcheck="false"/><small class="suy-theme-status" aria-live="polite">Color guardado ♡</small></div>
      <div class="suy-theme-actions"><button class="suy-theme-restore" type="button">Restaurar rosita</button><button class="suy-theme-done" type="button">Listo ♡</button></div>`;
    document.querySelector('.panel').appendChild(picker);
    canvas=picker.querySelector('canvas');brightness=picker.querySelector('#suyBrightness');
    swatch=picker.querySelector('.suy-theme-swatch');hexInput=picker.querySelector('.suy-theme-hex');
    indicator=picker.querySelector('.suy-theme-indicator');saveLabel=picker.querySelector('.suy-theme-status');
    draw();preview();
    button.addEventListener('click',()=>{
      picker.hidden=!picker.hidden;
      button.setAttribute('aria-expanded',String(!picker.hidden));
      if(!picker.hidden)preview();
    });
    picker.querySelector('.suy-theme-close').addEventListener('click',close);
    picker.querySelector('.suy-theme-done').addEventListener('click',close);
    picker.querySelector('.suy-theme-restore').addEventListener('click',()=>{hsv=rgbToHsv(fromHex(DEFAULT));preview();commit();});
    let dragging=false;
    canvas.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;
      dragging=true;canvas.setPointerCapture(event.pointerId);pickFromEvent(event);
    });
    canvas.addEventListener('pointermove',event=>{if(dragging)pickFromEvent(event);});
    canvas.addEventListener('pointerup',()=>{if(dragging){dragging=false;commit();}});
    canvas.addEventListener('pointercancel',()=>{if(dragging){dragging=false;commit();}});
    brightness.addEventListener('input',()=>{hsv.v=Number(brightness.value)/100;preview();});
    brightness.addEventListener('change',commit);
    hexInput.addEventListener('change',()=>{
      const hex=hexInput.value.trim();
      if(valid(hex)){hsv=rgbToHsv(fromHex(hex));preview();commit();}
      else{hexInput.value=color.toUpperCase();saveLabel.textContent='Escribe un color #RRGGBB';}
    });
    document.addEventListener('pointerdown',event=>{
      if(picker.hidden||picker.contains(event.target)||button.contains(event.target))return;
      close();
    });
    const frame=document.getElementById('baduFrame');
    frame?.addEventListener('load',()=>css(color));
  }
  function sync(accent){
    if(!valid(accent))return;
    if(picker&&!picker.hidden&& (document.activeElement===canvas||document.activeElement===brightness))return;
    color=accent.toLowerCase();hsv=rgbToHsv(fromHex(color));
    if(picker)preview();else css(color);
  }
  // Add color on both calculators even before Electron settings finish loading.
  css(DEFAULT);
  window.suyTheme=Object.freeze({mount,sync,close,defaultColor:DEFAULT});
})();
