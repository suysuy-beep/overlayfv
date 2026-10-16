import {parseWorkOrder,mergeImportedOrder} from './order-import.js';
import {prepareOrderFrame,readOrderImage,releaseOrderReader} from './ocr.js';

const bridge=window.suyCaptureBridge;
if(bridge){
const api=window.suytools;
const panel=document.querySelector('.panel');
const view=document.createElement('section');
view.className='capture-panel';view.hidden=true;
view.setAttribute('aria-label','Capturar e importar orden de trabajo');
view.innerHTML=`
  <div class="capture-top"><h2>▣ Captura del juego</h2><button type="button" id="capClose" aria-label="Cerrar captura">✕</button></div>
  <div class="capture-actions">
    <button type="button" class="accent" id="capTake">Capturar juego</button>
    <label class="capture-file-label">Importar imagen<input id="capFile" type="file" accept="image/png,image/jpeg,image/webp,image/bmp"></label>
    <button type="button" id="capPaste">Pegar imagen</button>
  </div>
  <p class="capture-info">Solo se toma una foto del monitor. Arrastra sobre la imagen para marcar las piezas y sus cantidades; puedes acercarla con Zoom. Nada se añade hasta que lo confirmes.</p>
  <div class="capture-zoom"><button id="capZoomOut" type="button">−</button><span id="capZoomLabel">900 px</span><button id="capZoomIn" type="button">+</button><button id="capResetCrop" type="button">Quitar recorte</button></div>
  <div id="capViewport" class="capture-viewport">
    <div id="capSurface" class="capture-surface"><img id="capImage" alt="Captura temporal del juego" draggable="false"><div id="capSelection" class="capture-selection" hidden></div></div>
  </div>
  <div class="capture-actions">
    <button type="button" class="accent" id="capRead">Leer recorte</button>
    <button type="button" id="capCancel" hidden>Cancelar lectura</button>
  </div>
  <p class="capture-status" id="capStatus" role="status" aria-live="polite">Captura el juego o importa una imagen para comenzar.</p>
  <label for="capText">Texto detectado (puedes corregirlo o escribirlo)</label>
  <textarea id="capText" class="capture-text" placeholder="Motor V8 (1x)&#10;Tracción AWD (1x)"></textarea>
  <div class="capture-actions"><button id="capParse" type="button">Interpretar texto</button><button id="capAddRow" type="button">+ Agregar fila manual</button></div>
  <div id="capRows" class="capture-rows"></div>
  <div class="capture-foot"><label>Al aplicar: <select id="capMode"><option value="replace">Reemplazar selección</option><option value="add">Sumar a la selección</option></select></label><strong id="capTotal">—</strong></div>
  <div class="capture-actions"><button class="accent" id="capApply" type="button" disabled>Aplicar productos revisados</button></div>
`;
panel.append(view);
const $=id=>view.querySelector('#'+id);
const img=$('capImage'),surface=$('capSurface'),selection=$('capSelection');
let fullCanvas=null,crop=null,drag=null,rows=[],reading=false,controller=null,zoom=900,lastPreview='';
const status=s=>{$('capStatus').textContent=s;};
const esc=s=>String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const money=n=>'$'+n.toLocaleString('es-MX',{maximumFractionDigits:0});
function open(){view.hidden=false;}
function close(){controller?.abort();if(reading)releaseOrderReader();view.hidden=true;}
function showCrop(){
  selection.hidden=!crop;
  if(crop){selection.style.left=(100*crop.x)+'%';selection.style.top=(100*crop.y)+'%';
    selection.style.width=(100*crop.width)+'%';selection.style.height=(100*crop.height)+'%';}
  $('capRead').disabled=!fullCanvas||!crop||reading;
  $('capCancel').hidden=!reading;
}
function setZoom(amount){zoom=Math.max(520,Math.min(1600,amount));img.style.width=zoom+'px';$('capZoomLabel').textContent=zoom+' px';}
setZoom(900);
function activate(dataUrl){
  if(typeof dataUrl!=='string'||!dataUrl.startsWith('data:image/')){status('Esta captura no es una imagen válida.');return;}
  open();crop=null;rows=[];$('capText').value='';renderRows();
  fullCanvas=null;img.onload=()=>{
    if(img.naturalWidth<50||img.naturalHeight<50||img.naturalWidth*img.naturalHeight>20000000){status('Imagen inválida o demasiado grande.');return;}
    const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;
    c.getContext('2d',{willReadFrequently:true}).drawImage(img,0,0);
    fullCanvas=c;
    setZoom(900);showCrop();
    $('capViewport').scrollTop=0;$('capViewport').scrollLeft=0;
    status('Imagen lista. Arrastra sobre la lista de piezas de la tablet para marcar el área.');
  };
  img.onerror=()=>status('No fue posible mostrar la imagen.');
  img.src=dataUrl;
  showCrop();
}
async function take(){
  open();if(!api?.captureScreen){status('La captura nativa solo está disponible en SuyTools instalado. Puedes importar una imagen.');return;}
  if(reading)return;
  $('capTake').disabled=true;status('Capturando monitor… ocultando el overlay un momento.');
  try{const shot=await api.captureScreen();activate(shot.dataUrl);}
  catch(err){status('No se pudo capturar: '+(err.message||String(err))+'. Prueba sin bordes o importa un archivo.');}
  finally{$('capTake').disabled=false;}
}
async function importFile(file){
  if(!file)return;
  open();if(!['image/png','image/jpeg','image/webp','image/bmp'].includes(file.type)||file.size>10*1024*1024){status('Usa PNG, JPG, WebP o BMP de máximo 10 MB.');return;}
  try{const url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});activate(url);}
  catch{status('No se pudo leer ese archivo.');}
}
function position(e){const b=img.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(e.clientX-b.left)/b.width)),y:Math.max(0,Math.min(1,(e.clientY-b.top)/b.height))};}
surface.addEventListener('pointerdown',e=>{
  if(!fullCanvas||reading||e.button!==0||drag)return;
  e.preventDefault();const p=position(e);
  drag={...p,id:e.pointerId,old:crop};crop=null;surface.setPointerCapture(e.pointerId);showCrop();
});
surface.addEventListener('pointermove',e=>{
  if(!drag||drag.id!==e.pointerId)return;
  const p=position(e);crop={x:Math.min(drag.x,p.x),y:Math.min(drag.y,p.y),
    width:Math.abs(drag.x-p.x),height:Math.abs(drag.y-p.y)};showCrop();
});
function endCrop(e){
  if(!drag||drag.id!==e.pointerId)return;
  if(e.type==='pointercancel'||!crop||crop.width*fullCanvas.width<50||crop.height*fullCanvas.height<50)crop=drag.old;
  drag=null;showCrop();
  if(crop)status('Recorte listo. Ahora pulsa «Leer recorte».');
}
surface.addEventListener('pointerup',endCrop);surface.addEventListener('pointercancel',endCrop);
$('capZoomOut').addEventListener('click',()=>setZoom(zoom-200));
$('capZoomIn').addEventListener('click',()=>setZoom(zoom+200));
$('capResetCrop').addEventListener('click',()=>{crop=null;showCrop();status('Selecciona otra vez solo las piezas y cantidades.');});
function totals(){
  try{
    const quantities=mergeImportedOrder(bridge.products(),bridge.quantities(),rows,$('capMode').value);
    if(Object.values(quantities).some(n=>n>99))throw Error('Máximo 99 unidades por producto.');
    const sub=bridge.products().reduce((sum,p)=>sum+(quantities[p.id]||0)*p.price,0);
    $('capTotal').textContent=money(Math.round(sub*(1-bridge.discount()/100)));
    $('capApply').disabled=reading;return true;
  }catch(error){$('capTotal').textContent='—';$('capApply').disabled=true;return false;}
}
function renderRows(){
  const options=bridge.products().map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  $('capRows').innerHTML=rows.map((r,i)=>`<div class="capture-row" data-i="${i}">
    <select aria-label="Producto ${i+1}"><option value="">Elige pieza</option>${options}</select>
    <input type="number" min="1" max="99" step="1" aria-label="Cantidad ${i+1}" placeholder="Cant." value="${r.quantity??''}">
    <button type="button" class="capture-remove" aria-label="Quitar fila ${i+1}">✕</button></div>`).join('');
  for(const [i,row] of rows.entries()){
    const el=$('capRows').children[i];el.querySelector('select').value=row.id||'';
    el.querySelector('select').addEventListener('change',e=>{row.id=e.target.value;totals();});
    el.querySelector('input').addEventListener('input',e=>{row.quantity=e.target.value===''?null:Number(e.target.value);totals();});
    el.querySelector('.capture-remove').addEventListener('click',()=>{rows.splice(i,1);renderRows();});
  }
  totals();
}
function parse(){
  try{rows=parseWorkOrder($('capText').value,{strict:false});renderRows();
    status(rows.length?`Encontré ${rows.length} filas. Comprueba nombres y cantidades antes de aplicar.`:
      'No encontré piezas. Puedes corregir el texto o agregar una fila manual.');}
  catch(err){rows=[];renderRows();status(err.message);}
}
async function read(){
  if(reading||!fullCanvas||!crop)return;
  controller=new AbortController();const signal=controller.signal;reading=true;showCrop();
  try{
    status('Preparando lectura OCR sin conexión…');
    const area=prepareOrderFrame(fullCanvas,crop);
    const text=await readOrderImage(area,{signal,onProgress:(step,progress)=>{
      if(!signal.aborted)status(step==='recognizing text'?`Leyendo piezas… ${Math.round((progress||0)*100)}%`:'Preparando el lector…');
    }});
    if(signal.aborted)return;
    $('capText').value=text;parse();
  }catch(err){if(!signal.aborted)status('No se pudo leer la imagen: '+(err.message||err)+'. Puedes escribir las piezas manualmente.');}
  finally{reading=false;controller=null;showCrop();totals();}
}
$('capTake').addEventListener('click',take);
$('capFile').addEventListener('change',e=>{importFile(e.target.files[0]);e.target.value='';});
$('capPaste').addEventListener('click',async()=>{
  try{const items=await navigator.clipboard.read();
    for(const item of items){const type=item.types.find(t=>t.startsWith('image/'));
      if(type){await importFile(new File([await item.getType(type)],'captura.png',{type}));return;}}
    status('No hay una imagen en el portapapeles.');
  }catch{status('No se pudo leer el portapapeles. Usa «Importar imagen» o Ctrl+V.');}
});
document.addEventListener('paste',e=>{
  const item=[...(e.clipboardData?.items||[])].find(x=>x.kind==='file'&&x.type.startsWith('image/'));
  if(item){e.preventDefault();importFile(item.getAsFile());}
});
$('capRead').addEventListener('click',read);
$('capCancel').addEventListener('click',()=>{controller?.abort();status('Lectura cancelada. La imagen sigue disponible.');});
$('capParse').addEventListener('click',parse);
$('capAddRow').addEventListener('click',()=>{rows.push({id:'',quantity:1});renderRows();});
$('capMode').addEventListener('change',totals);
$('capApply').addEventListener('click',()=>{
  try{
    const quantities=mergeImportedOrder(bridge.products(),bridge.quantities(),rows,$('capMode').value);
    if(Object.values(quantities).some(n=>n>99))throw Error('Máximo 99 unidades.');
    bridge.apply(quantities);bridge.toast('Productos importados. Revisa el presupuesto ♡');close();
  }catch(err){status('Revisa la lista: '+err.message);}
});
$('capClose').addEventListener('click',close);
window.addEventListener('suy:startCapture',take);
window.addEventListener('suy:importFile',()=>{open();$('capFile').click();});
api?.onCaptured?.(shot=>{activate(shot.dataUrl);});
api?.onCaptureError?.(error=>{open();status('No se pudo capturar: '+error);});
window.addEventListener('pagehide',()=>{controller?.abort();releaseOrderReader();});
}
