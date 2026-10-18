'use strict';
import {PRODUCTS,calculate,money,quantity,price} from './core.js';
import {art} from './art.js';
const $=s=>document.querySelector(s);
const KEY='suytools.badulak.compacto.v1';
const parentApi=(()=>{try{return window.parent?.suytools??null;}catch{return null;}})();
let saved={};
try{saved=parentApi?.loadBaduSync?.()||JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch{}
let products=PRODUCTS.map(p=>({...p,price:price(saved.prices?.[p.id],p.price)}));
let quantities=Object.fromEntries(products.map(p=>[p.id,quantity(saved.quantities?.[p.id])]));
let category='all',query='',basketOpen=saved.basketOpen!==false,includeTotal=saved.includeTotal===true,toastTimeout;
const categoryNames={all:'Todo',tech:'Tecnología',daily:'Básicos',extras:'Extras'};
// Nombres cortos solo para la descripción de factura. Las tarjetas conservan
// sus nombres completos y los importes no se modifican.
const invoiceNames={
 phone:'Tel',radio:'Rad',business:'TabNeg',mechanic:'TabMec',
 box:'Caj',tobacco:'Tabac',lighter:'Mech',fries:'Pap',
 burrito:'Burr',white:'TabBla',drink:'Beb',ticket:'Tkt'
};
function invoiceSummary(order,withTotal){
 const description=order.lines.map(p=>`${invoiceNames[p.id]||p.name} x${p.qty}`).join(' | ');
 return description+(withTotal&&order.lines.length?` | Total: ${money(order.total)}`:'');
}
function persist(){const state={prices:Object.fromEntries(products.map(p=>[p.id,p.price])),quantities,includeTotal,basketOpen};try{localStorage.setItem(KEY,JSON.stringify(state));}catch{}try{parentApi?.saveBadu?.(state);}catch{}}
function notify(msg){$('#toast').textContent=msg;$('#toast').classList.add('on');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('#toast').classList.remove('on'),1800);}
function escapeHTML(value){return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function renderFilters(){const values=['all','tech','daily','extras'];$('#filters').innerHTML=values.map(id=>`<button class="filter ${id===category?'active':''}" data-cat="${id}" type="button" aria-pressed="${id===category}">${categoryNames[id]}</button>`).join('');}
function renderProducts(){const pool=products.filter(p=>(category==='all'||category===p.category)&&p.name.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(query));$('#products').innerHTML=pool.map(p=>`<article class="product ${quantities[p.id]?'selected':''}" data-id="${escapeHTML(p.id)}"><button type="button" class="illustration" data-delta="1" title="Agregar ${escapeHTML(p.name)}" aria-label="Agregar ${escapeHTML(p.name)}">${art(p.art,'badu-'+p.id)}</button><div class="info"><div class="name">${escapeHTML(p.name)}</div><div class="price">${money(p.price)}</div></div><div class="counter"><button type="button" data-delta="-1" aria-label="Restar ${escapeHTML(p.name)}">−</button><input class="qty" aria-label="Cantidad de ${escapeHTML(p.name)}" type="number" step="1" min="0" max="999" value="${quantities[p.id]}"/><button type="button" class="plus" data-delta="1" aria-label="Sumar ${escapeHTML(p.name)}">+</button></div></article>`).join('')||'<div class="empty">No encontramos ese producto ♡</div>';}
function renderBasket(){const order=calculate(products,quantities,includeTotal);$('#count').textContent=order.count;$('#miniTotal').textContent=money(order.total);$('#total').textContent=money(order.total);$('#summary').value=invoiceSummary(order,includeTotal);$('#includeTotal').checked=includeTotal;$('#basketToggle').setAttribute('aria-expanded',String(basketOpen));$('.basket').classList.toggle('collapsed',!basketOpen);
 $('#orderLines').innerHTML=order.lines.length?order.lines.map(p=>`<div class="order-row"><strong>${p.qty}x</strong><span>${escapeHTML(p.name)}</span><span class="end">${money(p.qty*p.price)}</span></div>`).join(''):'<div class="order-empty">Aquí empieza tu pedido ♡</div>';
 $('#cleanPromo').classList.toggle('ready',order.clean);$('#repairPromo').classList.toggle('ready',order.repair);$('#cleanStatus').textContent=order.clean?'Incluida ✓':'Más de $5,000';$('#repairStatus').textContent=order.repair?'Incluida ✓':'Más de $10,000';$('#copyTotal').disabled=$('#copyOrder').disabled=order.lines.length===0;$('#clear').disabled=order.lines.length===0;
}
function render(){renderFilters();renderProducts();renderBasket();persist();}
$('#filters').addEventListener('click',e=>{let target=e.target.closest('[data-cat]');if(!target)return;category=target.dataset.cat;render();$('#products').scrollTop=0;});
$('#search').addEventListener('input',e=>{query=e.target.value.trim().toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'');renderProducts();});
$('#products').addEventListener('click',e=>{let b=e.target.closest('[data-delta]');if(!b)return;let id=b.closest('[data-id]').dataset.id;quantities[id]=quantity(quantities[id]+Number(b.dataset.delta));renderProducts();renderBasket();persist();});
$('#products').addEventListener('change',e=>{let input=e.target.closest('input.qty');if(!input)return;const id=input.closest('[data-id]').dataset.id;quantities[id]=quantity(input.value);renderProducts();renderBasket();persist();});
$('#basketToggle').addEventListener('click',()=>{basketOpen=!basketOpen;renderBasket();persist();});
$('#includeTotal').addEventListener('change',e=>{includeTotal=e.target.checked;renderBasket();persist();});
// Confirmación propia de SuyTools: evita el sonido de aviso de la ventana nativa de Windows.
const clearDialog=$('#clearDialog');
$('#clear').addEventListener('click',()=>{
 if(!Object.values(quantities).some(Boolean)||clearDialog.open)return;
 clearDialog.showModal();
});
$('#cancelClear').addEventListener('click',()=>clearDialog.close());
$('#confirmClear').addEventListener('click',()=>{
 // Verificamos otra vez para no eliminar nada que ya esté vacío.
 if(!Object.values(quantities).some(Boolean)){clearDialog.close();return;}
 quantities=Object.fromEntries(products.map(p=>[p.id,0]));
 clearDialog.close();
 render();
 notify('Pedido vacío ♡');
});
async function copy(text){if(!text){notify('Primero agrega un producto');return;}try{if(parentApi?.copyText){const ok=await parentApi.copyText(text);if(!ok)throw new Error('No se pudo copiar');}else{await navigator.clipboard.writeText(text);}notify('Copiado al portapapeles ♡');}catch{const field=document.createElement('textarea');field.value=text;document.body.appendChild(field);field.select();const ok=document.execCommand('copy');field.remove();notify(ok?'Copiado al portapapeles ♡':'No se pudo copiar');}}
$('#copyOrder').addEventListener('click',()=>copy(invoiceSummary(calculate(products,quantities),includeTotal)));
$('#copyTotal').addEventListener('click',()=>copy(String(Math.round(calculate(products,quantities).total))));
$('#editPrices').addEventListener('click',()=>{$('#priceFields').innerHTML=products.map(p=>`<label class="price-row"><span>${escapeHTML(p.name)}</span><input type="number" min="0" max="999999999" step="0.01" data-price="${p.id}" value="${p.price}" required /></label>`).join('');$('#pricesDialog').showModal();});
$('#closePrices').addEventListener('click',()=>$('#pricesDialog').close());
$('#restorePrices').addEventListener('click',()=>{PRODUCTS.forEach(p=>{const input=$(`[data-price="${p.id}"]`);if(input)input.value=p.price;});});
$('#pricesForm').addEventListener('submit',e=>{e.preventDefault();products=products.map(p=>({...p,price:price($(`[data-price="${p.id}"]`).value,p.price)}));$('#pricesDialog').close();render();notify('Precios guardados');});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#search').focus();$('#search').select();}});
render();

// The theme is shared with the containing SuyTools window.
// Only messages from the same-origin parent are accepted.
window.addEventListener('message', event=>{
  if(event.source!==window.parent || event.origin!==window.location.origin)return;
  if(event.data?.type==='suy:theme' && /^#[0-9a-f]{6}$/i.test(event.data.accent||'')){
    document.documentElement.style.setProperty('--suy-accent',event.data.accent.toLowerCase());
    if(['#201622','#fff8fd'].includes(event.data.text))document.documentElement.style.setProperty('--suy-accent-text',event.data.text);
  }
});
try{
  const initial=window.parent.document.documentElement.style.getPropertyValue('--suy-accent').trim();
  if(/^#[0-9a-f]{6}$/i.test(initial)){document.documentElement.style.setProperty('--suy-accent',initial);
    const ink=window.parent.document.documentElement.style.getPropertyValue('--suy-accent-text').trim();
    if(['#201622','#fff8fd'].includes(ink))document.documentElement.style.setProperty('--suy-accent-text',ink);
  }
}catch{}
