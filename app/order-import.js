// Only explicit product counts are imported, never order numbers or amounts paid.
const normalize=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const aliases=[
 ['full-v12',['full tuning v12','fulltuning v12']],['full-v8',['full tuning v8','fulltuning v8']],
 ['nitro-bottle',['botella de nitro','botella nitro']],['semislick',['semi slick','semislick']],
 ['performance',['piezas de rendimiento','piezas rendimiento','rendimiento']],
 ['cosmetic',['piezas cosmeticas','cosmeticos','cosmeticas']],
 ['paint',['kit de pintura','repintar','repintado','pintura']],
 ['repair',['kit de reparacion','reparacion','reparar']],['rims',['set de rines','rines','ruedas']],
 ['smoke',['kit de humo','humo neumaticos','humo de neumaticos','humo para neumaticos']],
 ['stance',['stance o suspension','stance','suspension']],
 ['brakes',['frenos ceramicos','frenos']],['turbo',['turbo charger','turbocharger','turbo']],
 ['v12',['motor v12','motor v 12','v12']],['v8',['motor v8','motor v 8','v8']],
 ['awd',['traccion awd','awd']],['rwd',['traccion rwd','rwd']],['fwd',['traccion fwd','fwd']],
 ['slick',['llantas slick','slick']],['offroad',['off road','offroad']],
 ['vehicle-extras',['modificaciones adicionales','extras']],['nitro',['sistema de nitro','nitro']]
];
function identify(value){
 const text=' '+normalize(value)+' ';
 for(const [id,names] of aliases)if(names.some(name=>text.includes(' '+name+' ')))return id;
 return '';
}
export function parseWorkOrder(text,{strict=false}={}){
 if(typeof text!=='string'||text.length>20000)throw Error('El texto es demasiado largo. Usa solo la lista de piezas.');
 const rows=[];
 for(const raw of text.split(/\r?\n|[,;]/)){
  const line=raw.trim();if(!line||/\b(?:orden|pagado|patente|cliente|total|precio)\b/i.test(normalize(line)))continue;
  // Accept “Cosméticos (23x)”, “23x Cosméticos” and “Cosméticos x23”.
  const count=line.match(/(?:\(\s*)?(-?\d+)\s*[x×](?:\s*\))?/i)||line.match(/[x×]\s*(-?\d+)/i);
  const withoutCount=count?line.replace(count[0],' '):line;
  const id=identify(withoutCount);
  if(!id&&!count)continue;
  // UI counts such as screen dimensions should not become products without a label.
  const label=withoutCount.replace(/\binstalad[oa]s?\b/gi,'').replace(/[()✓✔]/g,'').trim();
  if(!id&&(!/[a-záéíóúñ]/i.test(label)||/orden|pagado|patente|cliente/i.test(label)))continue;
  const n=count?Number(count[1]):NaN;
  if(strict&&(!id||!count||!Number.isInteger(n)||n<1||n>999))continue;
  rows.push({id,quantity:Number.isInteger(n)&&n>=1&&n<=999?n:null,label:label.slice(0,160),original:line.slice(0,200)});
  if(rows.length>100)throw Error('Hay demasiadas filas. Usa una captura de una sola orden.');
 }
 return rows;
}
export function mergeImportedOrder(products,current,rows,mode='replace'){
 if(!['replace','add'].includes(mode)||!rows.length)throw Error('No hay piezas listas para importar.');
 const ids=new Set(products.map(p=>p.id));
 const next=Object.fromEntries(products.map(p=>[p.id,mode==='add'?(current[p.id]||0):0]));
 for(const row of rows){
  if(!ids.has(row.id)||!Number.isInteger(row.quantity)||row.quantity<1||row.quantity>999)throw Error('Elige la pieza y revisa su cantidad en cada fila.');
  next[row.id]+=row.quantity;
  if(next[row.id]>999)throw Error('Una pieza supera 999 unidades. Reduce su cantidad antes de importar.');
 }
 return next;
}
