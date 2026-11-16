// src/modules/system/app/routes/quoteDecisionNavegador.ts — SCRUM-1646c (CSP paso 2, firma del presupuesto)
//
// EL GUION DE LA PÁGINA PÚBLICA DE FIRMA DEL PRESUPUESTO, FUERA DEL HTML.
//
// Hasta SCRUM-1646c vivía en tres `<script>` en línea de `quoteDecisionLanding.routes.ts` —la
// elección de opción (`TIER_JS`), el lienzo de firma (`SIG_JS`) y el botón de aceptar, que llevaba
// el token, los textos y el nombre del negocio INTERPOLADOS dentro del código y montaba el éxito con
// `innerHTML`— más un `onclick="selectTier(…)"` en cada opción. Con `script-src 'self'`
// (SCRUM-1637) nada de eso corre y el cliente no podría firmar.
//
// Mismo patrón que el parte (`jobs/app/routes/albaranFirmaNavegador.ts`, SCRUM-1646), y las mismas
// dos reglas, por lo mismo:
//
//  1 · NI UN DATO DENTRO DEL CÓDIGO. El guion es una cadena CONSTANTE (`String.raw` sin
//      sustituciones): la ruta del POST, los códigos de recarga y TODOS los textos llegan en el
//      bloque `<script type="application/json" id="presupuesto-firma-datos">` que pinta el servidor.
//      Un nonce no valdría: un trozo de URL metido dentro de un script legítimo correría igual.
//
//  2 · NINGÚN TEXTO VISIBLE AQUÍ. Los textos se quedan en `quoteDecisionLanding.routes.ts`, donde
//      estaban, y viajan en los datos (regla 39: esto mueve código, no copy). Y nada se pinta con
//      `innerHTML`: todo nodo nace de `createElement` y todo texto entra por `textContent`.
//
// Lo sirve el router de la página (`GET /pay/quote/js/firma.js`), con huella `?v=` = sha1 del
// contenido (SCRUM-274): `immutable` sólo con la huella buena; si no, `no-cache`.
//
// 🔴 La CONDUCTA es la de antes, línea a línea: la elección pinta lo mismo, el lienzo se dimensiona
// igual (SCRUM-892), el 409 de «ya decidido» o «versión no vigente» recarga (SCRUM-1276/1302r), el
// 5xx no afirma nada (SCRUM-1302t) y el mensaje humano gana al código (SCRUM-264).
import { huellaDeContenido, CACHE_CON_HUELLA } from '../../../../core/http/huellaEstaticos';

/** Id del bloque de datos. Un solo sitio lo define: el HTML lo pinta y el guion lo lee. */
export const ID_DATOS_FIRMA_PRESUPUESTO = 'presupuesto-firma-datos';

export const PRESUPUESTO_FIRMA_JS = String.raw`(function(){
'use strict';
var nodo=document.getElementById('presupuesto-firma-datos');
if(!nodo)return;
var D;try{D=JSON.parse(nodo.textContent||'');}catch(_){return;}
var T=D.textos||{};

// ── La elección de opción (antes TIER_JS + onclick) ──────────────────────────────────────────
var selectedTierId=null;
function selectTier(tierId){
  selectedTierId=tierId;
  document.querySelectorAll('.tier-card').forEach(function(c){c.classList.remove('selected');});
  var card=document.querySelector('[data-tier-id="'+tierId+'"]');
  if(card)card.classList.add('selected');
  var label=card?card.querySelector('.tier-label').textContent:tierId;
  var totalTxt=card?card.querySelector('.tier-total').textContent:'';
  document.getElementById('chosen-tier-label').textContent=label+(totalTxt?T.separadorTotal+totalTxt:'');
  document.getElementById('tier-confirm').style.display='block';
  var wrap=document.getElementById('btn-accept-wrapper');
  if(wrap)wrap.style.display='block';
  var heroVal=document.querySelector('.amount-hero-value');
  if(heroVal&&totalTxt)heroVal.textContent=totalTxt;
  var heroLabel=document.querySelector('.amount-hero-label');
  var conIva=!!document.querySelector('.totals-block');
  if(heroLabel)heroLabel.textContent=T.totalDeLaOpcion+label+(conIva?T.ivaIncluido:'');
  var btn=document.getElementById('btn-accept');
  if(btn&&totalTxt)btn.textContent=T.firmarOpcion+label+' ('+totalTxt+')';
  document.getElementById('tier-confirm').scrollIntoView({behavior:'smooth',block:'start'});
}
document.querySelectorAll('.tier-card .btn-tier').forEach(function(b){
  b.addEventListener('click',function(){
    var card=b.closest('.tier-card');
    if(card)selectTier(card.getAttribute('data-tier-id'));
  });
});

// ── El lienzo de firma (antes SIG_JS, sin cambios de conducta) ───────────────────────────────
(function(){
  var canvas=document.getElementById('sig-canvas');
  var wrapper=canvas?canvas.parentElement:null;
  var placeholder=document.getElementById('sig-placeholder');
  if(!canvas)return;
  var ctx=canvas.getContext('2d');
  var drawing=false;
  var hasSig=false;
  // SCRUM-892: oculto no se toca (0x0); al mostrarse lo dimensiona el ResizeObserver.
  function resize(){
    var rect=canvas.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    var dpr=window.devicePixelRatio||1;
    var prev=ctx.getImageData(0,0,canvas.width,canvas.height);
    canvas.width=rect.width*dpr;
    canvas.height=rect.height*dpr;
    ctx.scale(dpr,dpr);
    ctx.putImageData(prev,0,0);
    ctx.strokeStyle='#0f1c17';
    ctx.lineWidth=2.5;
    ctx.lineCap='round';
    ctx.lineJoin='round';
  }
  resize();
  window.addEventListener('resize',resize);
  if(window.ResizeObserver)new ResizeObserver(resize).observe(canvas);
  function getPos(e){
    var rect=canvas.getBoundingClientRect();
    var src=e.touches?e.touches[0]:e;
    return {x:src.clientX-rect.left,y:src.clientY-rect.top};
  }
  function start(e){e.preventDefault();drawing=true;var p=getPos(e);ctx.beginPath();ctx.moveTo(p.x,p.y);}
  function move(e){
    if(!drawing)return;
    e.preventDefault();
    var p=getPos(e);
    ctx.lineTo(p.x,p.y);
    ctx.stroke();
    if(!hasSig){
      hasSig=true;
      if(placeholder)placeholder.style.display='none';
      if(wrapper)wrapper.classList.add('has-sig');
    }
  }
  function end(){drawing=false;}
  canvas.addEventListener('mousedown',start);
  canvas.addEventListener('mousemove',move);
  canvas.addEventListener('mouseup',end);
  canvas.addEventListener('touchstart',start,{passive:false});
  canvas.addEventListener('touchmove',move,{passive:false});
  canvas.addEventListener('touchend',end);
  var limpiar=document.getElementById('sig-clear');
  if(limpiar)limpiar.addEventListener('click',function(){
    ctx.clearRect(0,0,canvas.width/(window.devicePixelRatio||1),canvas.height/(window.devicePixelRatio||1));
    hasSig=false;
    if(placeholder)placeholder.style.display='';
    if(wrapper)wrapper.classList.remove('has-sig');
  });
  window.getSignatureData=function(){
    if(!hasSig)return null;
    return canvas.toDataURL('image/png');
  };
  window.sigIsEmpty=function(){return !hasSig;};
})();

// ── El botón de aceptar ──────────────────────────────────────────────────────────────────────
function fireConfetti(){
  // AB6: respetar prefers-reduced-motion — sin celebración con movimiento.
  if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  var colors=['#22c55e','#16a34a','#22d3ee','#fbbf24','#f87171','#a78bfa'];
  for(var i=0;i<80;i++){
    var p=document.createElement('div');
    p.className='confetti-piece';
    p.style.left=Math.random()*100+'vw';
    p.style.background=colors[i%colors.length];
    p.style.animationDuration=(2+Math.random()*1.5)+'s';
    p.style.animationDelay=(Math.random()*0.4)+'s';
    document.body.appendChild(p);
    (function(n){setTimeout(function(){n.remove();},4200);})(p);
  }
}
function nuevo(tag,clase,texto){var n=document.createElement(tag);if(clase)n.className=clase;if(texto!=null)n.textContent=texto;return n;}
var SVG='http://www.w3.org/2000/svg';
// El éxito: el MISMO árbol que se pintaba antes desde una cadena, nodo a nodo y en el mismo orden.
function pintarAceptado(conFirma){
  var caja=nuevo('div');caja.style.textAlign='center';caja.style.padding='12px 0';
  caja.appendChild(nuevo('div','success-check',T.marca));
  var h=nuevo('h1','',T.aceptado+(conFirma?T.yFirmado:'')+T.cierreTitulo);
  h.style.fontSize='20px';h.style.margin='0 0 6px';caja.appendChild(h);
  var p=nuevo('p','',T.confirmacion);
  p.style.color='#6b756f';p.style.fontSize='14px';p.style.margin='0 0 18px';caja.appendChild(p);
  if(T.sinPago){
    var sp=nuevo('p','sin-pago',T.sinPago);
    sp.style.color='#6b756f';sp.style.fontSize='14px';sp.style.margin='0 0 18px';caja.appendChild(sp);
  }
  var a=nuevo('a','btn-share');a.target='_blank';a.rel='noopener';a.href=D.compartirUrl;
  var svg=document.createElementNS(SVG,'svg');
  svg.setAttribute('width','18');svg.setAttribute('height','18');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','currentColor');
  var path=document.createElementNS(SVG,'path');path.setAttribute('d',D.iconoCompartir);
  svg.appendChild(path);a.appendChild(svg);
  a.appendChild(document.createTextNode(T.compartir));
  caja.appendChild(a);
  var card=document.querySelector('.card');card.textContent='';card.appendChild(caja);
}
var botonAceptar=document.getElementById('btn-accept');
if(botonAceptar)botonAceptar.addEventListener('click',async function(){
  var noSig=document.getElementById('no-sig-check').checked;
  var sigData=window.getSignatureData?window.getSignatureData():null;
  if(!sigData&&!noSig){
    document.getElementById('sig-error').style.display='block';
    return;
  }
  document.getElementById('sig-error').style.display='none';
  var btn=document.getElementById('btn-accept');
  btn.disabled=true;btn.textContent=T.enviando;
  try{
    var res=await fetch(D.decisionUrl,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        decision:'accept',
        comment:sigData?D.comentarioConFirma:D.comentarioSinFirma,
        signatureData:sigData,
        tierId:selectedTierId
      })
    });
    var data=await res.json().catch(function(){return {};});
    if(res.ok){
      fireConfetti();
      pintarAceptado(!!sigData);
    }else if(res.status===409&&(D.erroresQueRecargan||[]).indexOf(data.error)>=0){
      location.reload();
    }else if(res.status>=500){
      btn.disabled=false;btn.textContent=T.botonFirmar;
      var aviso=document.getElementById('sig-error');
      aviso.textContent=T.sinConfirmar;
      aviso.style.display='block';
    }else{
      btn.disabled=false;btn.textContent=T.botonFirmar;
      document.getElementById('sig-error').textContent=data.message||data.error||T.reserva;
      document.getElementById('sig-error').style.display='block';
    }
  }catch(_){
    btn.disabled=false;btn.textContent=T.botonFirmar;
    document.getElementById('sig-error').textContent=T.sinRespuesta;
    document.getElementById('sig-error').style.display='block';
  }
});
})();
`;

/** Huella del guion: cambia si y sólo si cambia el contenido. */
export const HUELLA_PRESUPUESTO_FIRMA_JS = huellaDeContenido(PRESUPUESTO_FIRMA_JS);

/** La `src` que pinta la página. Relativa al propio servidor: `script-src 'self'`. */
export const SRC_PRESUPUESTO_FIRMA_JS = `/pay/quote/js/firma.js?v=${HUELLA_PRESUPUESTO_FIRMA_JS}`;

/** `Cache-Control` según la huella pedida: `immutable` sólo si cuadra; si no, revalidar siempre. */
export function cacheDelGuionDelPresupuesto(pedida: unknown): string {
  return pedida === HUELLA_PRESUPUESTO_FIRMA_JS ? CACHE_CON_HUELLA : 'no-cache';
}

/**
 * Los datos de la página, listos para soltarlos dentro de `<script type="application/json">`.
 * `<` se escribe `<` (el mismo carácter para `JSON.parse`): un «</script>» en el nombre del
 * negocio cerraría el bloque y abriría HTML.
 */
export function datosDeLaFirmaDelPresupuesto(datos: unknown): string {
  return JSON.stringify(datos).replace(/</g, '\\u003c');
}
