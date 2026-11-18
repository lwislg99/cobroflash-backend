// src/modules/billing/app/routes/pagoNavegador.ts — SCRUM-1647 (CSP paso 2, mitad J2: las páginas de pago)
//
// EL GUION DE LAS TRES PÁGINAS DE PAGO (`/pay/bank`, `/pay/bizum`, `/pay/invoice`), FUERA DEL HTML.
//
// Hasta SCRUM-1647 vivía en línea: tres `onclick="copyText('<IBAN|CLABE|referencia>', this)"` y un
// `<script>` en `/pay/bank`; un `<script>` en `/pay/bizum`; y un `onerror="this.style.display='none'"`
// en el logo del profesional de `/pay/bizum` y de `/pay/invoice`. Con `script-src 'self'` aplicada
// (SCRUM-1637, paso 3) nada de eso corre: el botón «Copiar IBAN» dejaría de copiar.
//
// ⚠️ LAS DOS REGLAS DE ESTE FICHERO (las mismas que `albaranFirmaNavegador.ts`, SCRUM-1646):
//
//  1 · NI UN DATO DENTRO DEL CÓDIGO. El guion es una cadena CONSTANTE (`String.raw` sin `${`): lo que
//      copia cada botón lo lee de su atributo `data-copy`, escapado con `esc` al pintarlo. Por eso no
//      vale un nonce: si un dato viajara dentro del script, la inyección correría con el nonce puesto.
//
//  2 · NINGÚN TEXTO VISIBLE NUEVO. «¡Copiado!» y los rótulos de los botones son los que ya había; el
//      rótulo de vuelta sale del `data-label` de cada botón, como antes. Mismo comportamiento: en
//      `/pay/bank`, clase `copied`, 2000 ms y el respaldo con `execCommand`; en `/pay/bizum`, 1600 ms y
//      sin respaldo. Qué página es lo dice `data-pagina` en la propia etiqueta `<script>`.
//
// POR QUÉ LO SIRVE EL ROUTER Y NO `public/`: `public/**` es carril S2; estas páginas las pinta el
// servidor (J2). Va con huella (`?v=`, patrón SCRUM-274 y SCRUM-1646): `immutable` sólo con la buena.
//
// EL LOGO QUE NO CARGA: `error` de una imagen no burbujea, así que se escucha en FASE DE CAPTURA en el
// documento. La etiqueta `<script src>` va en el `<head>`, síncrona: el escuchador existe antes de que
// el analizador cree el `<img>` del `<body>`, así que ningún error llega antes que él.
//
// SCRUM-1756c · EL RECIBO Y EL PORTAL, POR LA MISMA RUTA. Las estrellas de la valoración del recibo
// (`receipt.routes.ts`) y el pie del portal del cliente (`customerPortal.routes.ts`: desplegar líneas y
// «Solicitar nuevo presupuesto») vivían en `<script>` en línea; el portal, además, escribía la URL de la
// solicitud en `window.PF_REQUEST_URL` desde el servidor. Ahora son dos ramas de este guion
// (`data-pagina="recibo"` / `"portal"`), con los mismos textos que ya había, y la URL se lee del `data-url`
// del formulario (regla 1). Ninguna ruta nueva: la de arriba ya está declarada.
import { huellaDeContenido, CACHE_CON_HUELLA } from '../../../../core/http/huellaEstaticos';

export const PAGO_JS = String.raw`(function(){
'use strict';
var yo=document.currentScript;
var pagina=(yo&&yo.getAttribute('data-pagina'))||'';

if(pagina==='recibo'){
  var btns=document.querySelectorAll('.fb-stars button');
  var input=document.getElementById('fb-stars-input');
  btns.forEach(function(b){
    b.addEventListener('click',function(){
      var n=Number(b.getAttribute('data-star'));
      input.value=String(n);
      btns.forEach(function(x){
        x.classList.toggle('on',Number(x.getAttribute('data-star'))<=n);
      });
    });
  });
  document.getElementById('fb-form').addEventListener('submit',function(ev){
    if(!input.value){ev.preventDefault();btns[4].focus();}
  });
  return;
}

if(pagina==='portal'){
  document.querySelectorAll('.pf-lines-toggle').forEach(function(btn){
    btn.addEventListener('click',function(){
      var body=btn.nextElementSibling;
      var open=body.classList.toggle('open');
      btn.querySelector('.pf-chevron').textContent=open?'▲':'▼';
    });
  });
  var reqBtn=document.getElementById('pf-req-btn');
  var reqForm=document.getElementById('pf-req-form');
  var reqCancel=document.getElementById('pf-req-cancel');
  var reqSubmit=document.getElementById('pf-req-submit');
  var reqTa=document.getElementById('pf-req-ta');
  var reqSuccess=document.getElementById('pf-req-success');
  if(!reqBtn)return;
  var reintentar=function(msg){
    alert(msg);
    reqSubmit.disabled=false;
    reqSubmit.textContent='Enviar solicitud';
  };
  reqBtn.addEventListener('click',function(){
    reqBtn.style.display='none';
    reqForm.classList.add('open');
    reqTa.focus();
  });
  reqCancel.addEventListener('click',function(){
    reqBtn.style.display='block';
    reqForm.classList.remove('open');
  });
  reqSubmit.addEventListener('click',function(){
    var desc=reqTa.value.trim();
    if(!desc){reqTa.focus();return;}
    reqSubmit.disabled=true;
    reqSubmit.textContent='Enviando…';
    fetch(reqForm.getAttribute('data-url')||'',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({description:desc})
    }).then(function(r){
      if(r.ok){
        reqForm.classList.remove('open');
        reqSuccess.style.display='block';
      }else reintentar('Error al enviar. Inténtalo de nuevo.');
    },function(){reintentar('Error de conexión.');});
  });
  return;
}

document.addEventListener('error',function(e){
  var t=e.target;
  if(t&&t.tagName==='IMG'&&t.classList&&t.classList.contains('logo-img'))t.style.display='none';
},true);

function copiarBanco(text,btn){
  navigator.clipboard.writeText(text).then(function(){
    btn.textContent='¡Copiado!';
    btn.classList.add('copied');
    setTimeout(function(){btn.textContent=btn.dataset.label||'Copiar';btn.classList.remove('copied');},2000);
  }).catch(function(){
    var el=document.createElement('textarea');
    el.value=text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    btn.textContent='¡Copiado!';
    btn.classList.add('copied');
    setTimeout(function(){btn.textContent=btn.dataset.label||'Copiar';btn.classList.remove('copied');},2000);
  });
}

function copiarBizum(btn){
  navigator.clipboard.writeText(btn.getAttribute('data-copy')||'').then(function(){
    btn.textContent='¡Copiado!';
    setTimeout(function(){btn.textContent=btn.getAttribute('data-label');},1600);
  });
}

document.addEventListener('click',function(e){
  var btn=e.target&&e.target.closest?e.target.closest('.copy-btn[data-copy]'):null;
  if(!btn)return;
  if(pagina==='banco')copiarBanco(btn.getAttribute('data-copy')||'',btn);
  else if(pagina==='bizum')copiarBizum(btn);
});
})();
`;

/** Huella del guion: cambia si y sólo si cambia el contenido. */
export const HUELLA_PAGO_JS = huellaDeContenido(PAGO_JS);

/** Ruta del guion dentro del router montado en `/pay`. */
export const RUTA_PAGO_JS = '/js/pago.js';

/** La `src` que pinta la página. Relativa al propio servidor: `script-src 'self'`. */
export const SRC_PAGO_JS = `/pay${RUTA_PAGO_JS}?v=${HUELLA_PAGO_JS}`;

/** `Cache-Control` según la huella pedida: `immutable` sólo si cuadra; si no, revalidar siempre. */
export function cacheDelGuionDePago(pedida: unknown): string {
  return pedida === HUELLA_PAGO_JS ? CACHE_CON_HUELLA : 'no-cache';
}

/**
 * La etiqueta del guion. `pagina` es una constante del servidor, nunca un dato. En las tres de pago va en
 * el `<head>`; en `recibo` y `portal` (SCRUM-1756c) va DESPUÉS del marcado que maneja, donde estaba su
 * `<script>` en línea: al correr, sus botones ya existen. Esas dos ramas salen antes del escuchador del
 * logo, que no tenían.
 */
export function etiquetaGuionDePago(pagina: 'banco' | 'bizum' | 'factura' | 'recibo' | 'portal'): string {
  return `<script src="${SRC_PAGO_JS}" data-pagina="${pagina}"></script>`;
}
