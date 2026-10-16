let libraryPromise;
function loadLibrary(){
 if(globalThis.Tesseract)return Promise.resolve(globalThis.Tesseract);
 if(!libraryPromise)libraryPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src=new URL('./vendor/ocr/tesseract.min.js',import.meta.url).href;
  const fail=()=>{clearTimeout(timer);script.remove();libraryPromise=null;reject(Error('No se pudo cargar el lector de imágenes. Recarga la página e intenta de nuevo.'));};
  const timer=setTimeout(fail,15000);
  script.onload=()=>{clearTimeout(timer);if(globalThis.Tesseract)resolve(globalThis.Tesseract);else fail();};script.onerror=fail;
  document.head.append(script);
 });
 return libraryPromise;
}
export async function prepareOrderImage(file){
 if(!['image/png','image/jpeg','image/webp','image/bmp'].includes(file.type))throw Error('Usa una imagen PNG, JPG, WebP o BMP.');
 if(file.size>10*1024*1024)throw Error('La imagen supera 10 MB. Recorta la orden antes de subirla.');
 const bitmap=await createImageBitmap(file);
 try{return prepareOrderFrame(bitmap);}finally{bitmap.close();}
}
// Keep native pixels until the user chooses a region; never shrink the whole
// game window before cropping the small text in its tablet.
export function freezeOrderFrame(source){
 const width=source.videoWidth??source.width,height=source.videoHeight??source.height;
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<50||height<50||width*height>20000000)throw Error('Aún no hay una imagen legible. Abre la orden en el juego y toma otra captura.');
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 canvas.getContext('2d').drawImage(source,0,0,width,height);return canvas;
}
export function prepareOrderFrame(source,crop=null,{maxSize=1800}={}){
  const fullWidth=source.videoWidth??source.width,fullHeight=source.videoHeight??source.height;
  const region=crop??{x:0,y:0,width:1,height:1};
  if(![region.x,region.y,region.width,region.height].every(Number.isFinite)||region.x<0||region.y<0||region.width<=0||region.height<=0||region.x+region.width>1.000001||region.y+region.height>1.000001)throw Error('Vuelve a marcar el área de la orden.');
  const width=fullWidth*region.width,height=fullHeight*region.height;
  if(!Number.isFinite(width)||!Number.isFinite(height)||fullWidth*fullHeight>20000000||width<50||height<50)throw Error('Marca una zona legible de la orden, de al menos 50 × 50 píxeles y hasta 20 megapíxeles.');
  const scale=Math.min(1.5,maxSize/Math.max(width,height));
  const canvas=document.createElement('canvas');canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
  const context=canvas.getContext('2d',{willReadFrequently:true});context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(source,fullWidth*region.x,fullHeight*region.y,width,height,0,0,canvas.width,canvas.height);
  const data=context.getImageData(0,0,canvas.width,canvas.height);let sum=0,samples=0;
  for(let i=0;i<data.data.length;i+=160){sum+=.299*data.data[i]+.587*data.data[i+1]+.114*data.data[i+2];samples++;}
  const invert=sum/samples<128;
  for(let i=0;i<data.data.length;i+=4){let gray=.299*data.data[i]+.587*data.data[i+1]+.114*data.data[i+2];if(invert)gray=255-gray;gray=Math.max(0,Math.min(255,(gray-128)*1.4+128));data.data[i]=data.data[i+1]=data.data[i+2]=gray;}
  context.putImageData(data,0,0);return canvas;
}
// One reusable worker, one job at a time. Cancellation discards that worker.
let engine=null,creating=null,epoch=0,progress=()=>{},inUse=false;
export async function prepareOrderReader(){
 if(engine)return engine;
 if(creating)return creating;
 const version=epoch;
 const promise=(async()=>{
  const library=await loadLibrary();
  if(version!==epoch)throw new DOMException('Lectura cancelada','AbortError');
  const base=new URL('./vendor/ocr/',import.meta.url).href;
  const worker=await library.createWorker('spa+eng',1,{workerPath:base+'worker.min.js',corePath:base,langPath:base.replace(/\/$/,''),logger:m=>progress(m.status,m.progress)});
  if(version!==epoch){await worker.terminate();throw new DOMException('Lectura cancelada','AbortError');}
  try{await worker.setParameters({tessedit_pageseg_mode:'11',preserve_interword_spaces:'1'});}
  catch(error){await worker.terminate().catch(()=>{});throw error;}
  if(version!==epoch){await worker.terminate();throw new DOMException('Lectura cancelada','AbortError');}
  engine=worker;return worker;
 })();
 creating=promise;
 try{return await promise;}finally{if(creating===promise)creating=null;}
}
export function releaseOrderReader(){
 epoch++;const worker=engine;engine=null;creating=null;progress=()=>{};
 worker?.terminate().catch(()=>{});
}
export async function readOrderImage(canvas,{onProgress=()=>{},signal}={}){
 if(signal?.aborted)throw new DOMException('Lectura cancelada','AbortError');
 if(inUse)throw Error('Espera a que termine la lectura actual.');
 inUse=true;progress=onProgress;const version=epoch;
 let timer,abort;
 try{
  const cancelled=new Promise((_,reject)=>{
   abort=()=>{releaseOrderReader();reject(new DOMException('Lectura cancelada','AbortError'));};
   signal?.addEventListener('abort',abort,{once:true});
  });
  const job=(async()=>{
   const worker=await prepareOrderReader();
   if(signal?.aborted)throw new DOMException('Lectura cancelada','AbortError');
   const result=await worker.recognize(canvas);
   if(signal?.aborted)throw new DOMException('Lectura cancelada','AbortError');
   return result.data.text;
  })();
  return await Promise.race([job,cancelled,new Promise((_,reject)=>{timer=setTimeout(()=>{releaseOrderReader();reject(Error('La lectura tardó demasiado. Marca solo la tablet o pega el texto.'));},90000);})]);
 }catch(error){if(version===epoch)releaseOrderReader();throw error;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);progress=()=>{};inUse=false;}
}
