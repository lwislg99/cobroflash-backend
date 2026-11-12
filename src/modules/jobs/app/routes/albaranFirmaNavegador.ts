// src/modules/jobs/app/routes/albaranFirmaNavegador.ts — SCRUM-1646 (CSP paso 2, tramo albarán público)
//
// EL GUION DE LA PÁGINA PÚBLICA DE FIRMA DEL PARTE, FUERA DEL HTML.
//
// Hasta SCRUM-1646 vivía en tres `<script>` en línea de `albaranPublic.routes.ts` (el lienzo de firma,
// los campos del firmante y el botón de firmar) con los datos INTERPOLADOS dentro del código, más un
// `onclick="location.reload()"` metido con `innerHTML`. Con `script-src 'self'` (SCRUM-1637) nada de
// eso corre, y el cliente no podría firmar.
//
// ⚠️ LAS DOS REGLAS DE ESTE FICHERO, y por qué:
//
//  1 · NI UN DATO DENTRO DEL CÓDIGO. El guion es una cadena CONSTANTE: lee todo —ruta del POST,
//      versión pintada, ids de calidad y TODOS los textos— del bloque `<script type="application/json"
//      id="albaran-firma-datos">` que pinta el servidor. Por eso no vale un nonce (descripción del
//      ticket): el XSS de SCRUM-1632c metía un trozo de la URL DENTRO de un script legítimo, y con
//      nonce habría corrido igual. Que la cadena no tiene `${` lo garantiza `String.raw` sin
//      sustituciones; que no lleva token ni nombre lo mira `tests/scrum1646-…`.
//
//  2 · NINGÚN TEXTO VISIBLE AQUÍ. Los textos se quedan en el servidor —en `albaranFirmante.ts` o
//      donde estaban— y llegan en los datos (regla 39: esto mueve código, no copy). Y nada se pinta
//      con `innerHTML`: todo nodo nace de `createElement` y todo texto entra por `textContent`.
//
// POR QUÉ LO SIRVE EL ROUTER Y NO `public/`: `public/**` es del carril S2 (dos-equipos.md) y este
// código es de la página que pinta el servidor, que es S1. Servirlo desde aquí además lo despliega
// SIEMPRE junto al HTML que lo usa. Va con huella (`?v=` = sha1 del contenido, patrón SCRUM-274):
// con la huella buena se promete `immutable`; sin ella, `no-cache` — nunca se sirve viejo.
//
// 🔴 El código va en ES2020 llano (lo que ya usaban los tres scripts: `async`, `?.`), sin módulos.
import { huellaDeContenido, CACHE_CON_HUELLA } from '../../../../core/http/huellaEstaticos';

/** Id del bloque de datos. Un solo sitio lo define: el HTML lo pinta y el guion lo lee. */
export const ID_DATOS_FIRMA = 'albaran-firma-datos';

export const ALBARAN_FIRMA_JS = String.raw`(function(){
'use strict';
var nodo=document.getElementById('albaran-firma-datos');
if(!nodo)return;
var D;try{D=JSON.parse(nodo.textContent||'');}catch(_){return;}
var T=D.textos||{};

(function(){
  var canvas=document.getElementById('sig-canvas');if(!canvas)return;
  var wrapper=canvas.parentElement,placeholder=document.getElementById('sig-placeholder');
  var ctx=canvas.getContext('2d');var drawing=false,hasSig=false;
  function resize(){var r=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
    var prev=ctx.getImageData(0,0,canvas.width,canvas.height);
    canvas.width=r.width*dpr;canvas.height=r.height*dpr;ctx.scale(dpr,dpr);ctx.putImageData(prev,0,0);
    ctx.strokeStyle='#0f1c17';ctx.lineWidth=2.5;ctx.lineCap='round';ctx.lineJoin='round';}
  resize();window.addEventListener('resize',resize);
  function pos(e){var r=canvas.getBoundingClientRect(),s=e.touches?e.touches[0]:e;return{x:s.clientX-r.left,y:s.clientY-r.top};}
  function start(e){e.preventDefault();drawing=true;var p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y);}
  function move(e){if(!drawing)return;e.preventDefault();var p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke();
    if(!hasSig){hasSig=true;if(placeholder)placeholder.style.display='none';if(wrapper)wrapper.classList.add('has-sig');}}
  function end(){drawing=false;}
  canvas.addEventListener('mousedown',start);canvas.addEventListener('mousemove',move);canvas.addEventListener('mouseup',end);
  canvas.addEventListener('touchstart',start,{passive:false});canvas.addEventListener('touchmove',move,{passive:false});canvas.addEventListener('touchend',end);
  var limpiar=document.getElementById('sig-clear');
  if(limpiar)limpiar.addEventListener('click',function(){
    ctx.clearRect(0,0,canvas.width/(window.devicePixelRatio||1),canvas.height/(window.devicePixelRatio||1));
    hasSig=false;if(placeholder)placeholder.style.display='';if(wrapper)wrapper.classList.remove('has-sig');});
  window.getSignatureData=function(){return hasSig?canvas.toDataURL('image/png'):null;};
})();

(function(){
  var sel=document.getElementById('firmante-calidad'),wrap=document.getElementById('firmante-otro-wrap');
  var nom=document.getElementById('firmante-nombre');
  if(!sel||!wrap)return;
  if(nom&&nom.value)nom.dataset.deSugerencia='1';
  if(nom)nom.addEventListener('input',function(){delete nom.dataset.deSugerencia;});
  sel.addEventListener('change',function(){
    wrap.style.display=sel.value===D.calidadLibre?'block':'none';
    if(sel.value===D.calidadLibre){var o=document.getElementById('firmante-otro');if(o)o.focus();}
    if(nom&&nom.dataset.deSugerencia==='1'&&sel.value&&sel.value!==D.calidadPropia){
      nom.value='';delete nom.dataset.deSugerencia;nom.focus();
    }
  });
})();

function nuevo(tag,clase,texto){var n=document.createElement(tag);if(clase)n.className=clase;if(texto!=null)n.textContent=texto;return n;}
function ponerEnLaTarjeta(caja){var card=document.querySelector('.card');card.textContent='';card.appendChild(caja);return caja;}

function pintarFirmado(d){
  var caja=nuevo('div');caja.style.textAlign='center';caja.style.padding='12px 0';
  caja.appendChild(nuevo('div','success-check',T.marcaFirmado));
  caja.appendChild(nuevo('h1','',T.firmadoTitulo));
  caja.appendChild(nuevo('p','meta',T.firmadoGracias));
  ponerEnLaTarjeta(caja);
  if(d&&typeof d.portalUrl==='string'&&/^https?:\/\//.test(d.portalUrl)){
    caja.appendChild(nuevo('p','meta',T.portalLinea));
    var a=nuevo('a','btn-accept btn-portal',T.portalBoton);a.href=d.portalUrl;caja.appendChild(a);
  }
}

function pintarCambiado(){
  var caja=nuevo('div','status-aviso');
  caja.appendChild(nuevo('strong','',T.cambiado));
  var b=nuevo('button','btn-accept',T.cambiadoBoton);b.type='button';b.style.marginTop='14px';
  b.addEventListener('click',function(){location.reload();});
  caja.appendChild(b);
  ponerEnLaTarjeta(caja);
}

var boton=document.getElementById('btn-sign');
if(boton)boton.addEventListener('click',async function(){
  var sig=window.getSignatureData?window.getSignatureData():null;
  var err=document.getElementById('sig-error');
  if(!sig){err.textContent=T.sinFirma;err.style.display='block';return;}
  var nomEl=document.getElementById('firmante-nombre');
  if(nomEl&&!nomEl.value.trim()){err.textContent=T.sinNombre;err.style.display='block';nomEl.focus();return;}
  var calEl0=document.getElementById('firmante-calidad');
  var otroEl0=document.getElementById('firmante-otro');
  if(calEl0&&calEl0.value===D.calidadLibre&&otroEl0&&!otroEl0.value.trim()){
    err.textContent=T.calidadOtroVacio;err.style.display='block';otroEl0.focus();return;
  }
  err.style.display='none';
  var btn=this;btn.disabled=true;btn.textContent=T.enviando;
  try{
    var cal=document.getElementById('firmante-calidad');
    var r=await fetch(D.firmarUrl,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        signatureData:sig,
        version:D.version,
        firmadoPorNombre:(document.getElementById('firmante-nombre')||{}).value||'',
        firmadoPorCalidad:cal?cal.value:'',
        firmadoPorCalidadOtro:(document.getElementById('firmante-otro')||{}).value||''
      })});
    if(r.ok){
      var ok=await r.json().catch(function(){return {};});
      pintarFirmado(ok);
    }else{
      var d=(await r.json().catch(function(){return {};}))||{};
      if(d.error===D.errorCambiado){pintarCambiado();return;}
      btn.disabled=false;btn.textContent=T.botonFirmar;
      var e=document.getElementById('sig-error');
      e.textContent=d.message||T.reserva;e.style.display='block';
    }
  }catch(_){btn.disabled=false;btn.textContent=T.botonFirmar;
    var e2=document.getElementById('sig-error');e2.textContent=T.sinRespuesta;e2.style.display='block';}
});
})();
`;

/** Huella del guion: cambia si y sólo si cambia el contenido. */
export const HUELLA_FIRMA_JS = huellaDeContenido(ALBARAN_FIRMA_JS);

/** La `src` que pinta la página. Relativa al propio servidor: `script-src 'self'`. */
export const SRC_FIRMA_JS = `/albaran/js/firma.js?v=${HUELLA_FIRMA_JS}`;

/** `Cache-Control` según la huella pedida: `immutable` sólo si cuadra; si no, revalidar siempre. */
export function cacheDelGuion(pedida: unknown): string {
  return pedida === HUELLA_FIRMA_JS ? CACHE_CON_HUELLA : 'no-cache';
}

/**
 * Los datos de la página, listos para soltarlos dentro de `<script type="application/json">`.
 * `<` se escribe `<` (el mismo carácter para `JSON.parse`): un «</script>» o un «<!--» en un
 * nombre que escribe el profesional o el cliente cerraría el bloque y abriría HTML.
 */
export function datosParaLaPagina(datos: unknown): string {
  return JSON.stringify(datos).replace(/</g, '\\u003c');
}
