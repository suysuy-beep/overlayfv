export const PRODUCTS = [
  {id:'phone',name:'Teléfono',category:'tech',price:900,bg:'#e7d9d0',art:'phone'},
  {id:'radio',name:'Radio',category:'tech',price:1750,bg:'#dddccf',art:'radio'},
  {id:'business',name:'Tablet negocio',category:'tech',price:8500,bg:'#ebd3c6',art:'business'},
  {id:'mechanic',name:'Tablet mecánico',category:'tech',price:1250,bg:'#d4ded9',art:'mechanic'},
  {id:'box',name:'Cajita feliz',category:'daily',price:400,bg:'#f0d7c7',art:'box'},
  {id:'tobacco',name:'Tabaco',category:'daily',price:350,bg:'#e3dcd2',art:'tobacco'},
  {id:'lighter',name:'Mechero',category:'daily',price:200,bg:'#e8d0cb',art:'lighter'},
  {id:'fries',name:'Papas a la francesa',category:'daily',price:100,bg:'#f0e0bb',art:'fries'},
  {id:'burrito',name:'Burritos',category:'daily',price:200,bg:'#ecd9bd',art:'burrito'},
  {id:'white',name:'Tablet blanca',category:'tech',price:35000,bg:'#e0dfd8',art:'white'},
  {id:'drink',name:'Bebida',category:'daily',price:100,bg:'#d6e2dd',art:'drink'},
  {id:'ticket',name:'Ticket dorado semanal',category:'extras',price:10000,bg:'#e8d5a9',art:'ticket',tag:'Sorteo semanal'}
];
export function quantity(value){return Math.min(999,Math.max(0,Math.floor(Number(value)||0)));}
export function price(value,fallback=0){const n=Number(value);return Number.isFinite(n)&&n>=0&&n<=999999999?Math.round(n*100)/100:fallback;}
export const money=value=>'$'+Number(value).toLocaleString('es-MX',{maximumFractionDigits:2});
export function calculate(products,quantities,includeTotal=false){
  const lines=products.map(p=>({...p,qty:quantity(quantities[p.id])})).filter(p=>p.qty>0);
  const total=Math.round(lines.reduce((s,p)=>s+p.qty*p.price,0)*100)/100;
  const count=lines.reduce((s,p)=>s+p.qty,0);
  const description=lines.map(p=>`${p.qty}x ${p.name}`).join(', ');
  return {lines,total,count,clean:total>5000,repair:total>10000,summary:description+(includeTotal&&lines.length?` | Total: ${money(total)}`:'')};
}
