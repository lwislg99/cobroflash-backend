// src/modules/jobs/app/routes/albaranPublic.routes.ts — SCRUM-49 (ALBARAN-3)
// Página PÚBLICA de firma REMOTA del albarán: GET /albaran/:token (revisar + firmar en el móvil
// del cliente) y POST /albaran/:token/firmar (emitido → firmado + auto-envío de la copia firmada).
// SIN auth: la autoriza el TOKEN OPACO (Albaran.firmaToken, 128 bits; findUnique). Documento NO
// fiscal (regla 24). SCRUM-468: el VALORADO SI ensena importes -- los mismos que su PDF, sin
// desglose de cuota de IVA. El SIN_VALORAR sigue con concepto/cantidad/unidad. Molde: quoteDecisionLanding
// (página + canvas de firma) + el token opaco de customerPortal. Tenancy = el token.
import { Router, Request, Response } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { esc } from '../../../../core/utils/utils';
import { documentNotFoundHtml } from '../../../../core/http/publicNotFound';
import { rateLimit } from '../../../../core/http/rateLimit';
import { buildFirmaEvidencia, canTransitionAlbaran, ensureAlbaranPdf } from '../../domain/albaran.service';
import { renderLineasAlbaran } from './albaranPublicVista';
// SCRUM-300 (C5): microcopy del firmante en su fuente única (regla 30) — aquí no se escribe copy.
import {
  ALBARAN_ROTULOS,
  FIRMANTE_CALIDAD_ETIQUETAS,
  FIRMANTE_CALIDAD_LIBRE,
  FIRMANTE_NOMBRE_MAX,
  FIRMANTE_OTRO_MAX,
  COPY_CALIDAD_OTRO_VACIO,
  COPY_FIRMA_SIN_NOMBRE,
  COPY_ALBARAN_CAMBIADO,
  COPY_ALBARAN_CAMBIADO_BOTON,
  firmanteCalidadOpciones,
  exigirNombreFirmante,
  puedeFirmarEstaVersion,
  resolverCalidadFirmante,
} from '../../domain/albaranFirmante';
import { sendAlbaranFirmadoWhatsApp } from '../../domain/albaranWhatsApp.service';
import { requestIp } from '../../../system/audit.service';

const router = Router();
// Superficie pública → rate-limit (patrón decisionLimiter del presupuesto).
const firmaLimiter = rateLimit({ scope: 'albaran_firma_publica', max: 20, windowMs: 60_000 });
const FIRMA_MAX_CHARS = 500_000; // mismo tope que la firma en obra (albaranes.routes.ts)

function renderPage(title: string, body: string): string {
  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"/><title>${esc(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="theme-color" content="#16a34a"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
  *,*::before,*::after{box-sizing:border-box}
  body{font-family:'Inter',system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;
    margin:0;padding:16px;background:#f6f7f5;color:#3f4a45;min-height:100vh}
  .card{max-width:460px;margin:24px auto;background:#fff;border:1px solid #e7e9e5;border-radius:18px;
    padding:26px 24px;box-shadow:0 1px 2px rgba(16,24,40,.04),0 18px 40px -16px rgba(16,24,40,.16)}
  .merchant-hero{text-align:center;padding:4px 0 16px}
  .merchant-logo{max-height:56px;max-width:160px;object-fit:contain;margin-bottom:8px}
  .merchant-avatar{width:60px;height:60px;border-radius:50%;margin:0 auto 8px;
    background:linear-gradient(135deg,#22c55e,#22d3ee);color:#052e16;font-weight:800;font-size:24px;
    display:flex;align-items:center;justify-content:center}
  .merchant-name{font-size:20px;font-weight:800;color:#0f1c17}
  h1{font-size:19px;margin:0 0 4px;color:#0f1c17;text-align:center}
  .meta{font-size:13px;color:#6b756f;text-align:center;margin-bottom:16px}
  .lines-table{width:100%;border-collapse:collapse;font-size:14px;margin:12px 0}
  .lines-table th{text-align:left;padding:4px 6px;color:#6b756f;font-size:12px;border-bottom:1px solid #e7e9e5}
  .lines-table td{padding:6px 6px;border-bottom:1px solid #f1f2ee}
  .lines-table th:nth-child(2),.lines-table td:nth-child(2),
  .lines-table th:nth-child(3),.lines-table td:nth-child(3){text-align:right;white-space:nowrap}
  /* SCRUM-468 · columnas de importe y totales del albarán VALORADO. Solo casan con marcado que
     el SIN_VALORAR NO genera (.num / .totales), así que esa pantalla no cambia ni un píxel.
     Cero colores nuevos: los tres son los que ya usa este mismo fichero. */
  .lines-table th.num,.lines-table td.num{text-align:right;white-space:nowrap}
  .totales{text-align:right;margin-top:-4px}
  .totales p{margin:2px 0}
  .totales .base{font-size:14px;color:#3f4a45}
  .totales .total{font-size:18px;font-weight:800;color:#0f1c17}
  .totales .leyenda{font-size:11px;color:#8b948e;line-height:1.45;margin-top:6px}
  .divider{border:none;border-top:1px solid #e7e9e5;margin:16px 0}
  .sig-label{font-size:13px;font-weight:600;color:#333c37;margin-bottom:6px;display:block}
  .sig-sub{font-size:12px;color:#6b756f;margin-bottom:8px}
  .sig-wrapper{border:2px solid #cdd2cb;border-radius:10px;background:#f7f8f6;position:relative;overflow:hidden;margin-bottom:8px}
  .sig-wrapper.has-sig{border-color:#22c55e;background:#fff}
  #sig-canvas{display:block;width:100%;height:150px;cursor:crosshair;touch-action:none}
  .sig-placeholder{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#cdd2cb;
    font-size:14px;pointer-events:none;user-select:none}
  .sig-actions{display:flex;gap:8px;margin-bottom:16px;align-items:center}
  /* SCRUM-300: los dos campos de FIRMADO POR. El NOMBRE es OBLIGATORIO y viene precargado con el
     del cliente —quien tiene el móvil en la mano suele ser él—, así que el camino normal no
     añade toques: trazo y botón. La CALIDAD viene SIN marcar y es opcional.
     ⚠️ El nombre precargado se BORRA si se declara que firmó otra persona. */
  .firmante-campo{margin-bottom:10px}
  .firmante-campo label{display:block;font-size:13px;font-weight:600;color:#333c37;margin-bottom:4px}
  .firmante-campo input,.firmante-campo select{width:100%;padding:11px 12px;font-size:15px;font-family:inherit;
    color:#0f1c17;background:#fff;border:1px solid #cdd2cb;border-radius:10px;min-height:44px}
  .btn-clear{font-size:13px;padding:6px 12px;border-radius:8px;border:1px solid #e7e9e5;background:#fff;cursor:pointer;color:#6b756f}
  .btn-accept{width:100%;padding:15px;font-size:16px;font-weight:700;background:#16a34a;color:#fff;border:none;
    border-radius:14px;cursor:pointer;min-height:52px;box-shadow:0 4px 14px -2px rgba(22,163,74,.35)}
  .btn-accept:active{background:#15803d;transform:translateY(1px)}
  .btn-accept:disabled{opacity:.5;cursor:default}
  .status-ok{background:#ecfdf5;border-radius:12px;padding:16px;text-align:center}
  /* SCRUM-361 (H6): el albarán cambió mientras esta página estaba abierta. Hermana de .status-ok
     y NO de un error: mismo radio, mismo padding, mismo centrado — solo cambia el tono. Que no
     parezca un fallo del programa es condición del texto aprobado, y el color es parte del texto. */
  .status-aviso{background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px;
    text-align:center;color:#3f4a45;font-size:15px;line-height:1.45}
  .status-ok strong{color:#166534}
  .success-check{width:72px;height:72px;border-radius:50%;background:#16a34a;color:#fff;font-size:40px;
    display:flex;align-items:center;justify-content:center;margin:0 auto 16px}
  small{font-size:12px;color:#6b756f;display:block;text-align:center;margin-top:12px}
  .privacy-note{font-size:11px;color:#8b948e;text-align:left;line-height:1.5;margin-top:10px}
  .privacy-note a{color:#8b948e;text-decoration:underline}
  :focus-visible{outline:none;box-shadow:0 0 0 3px rgba(34,197,94,.30)}
</style></head>
<body><div class="card">${body}</div></body></html>`;
}

// Cabecera del negocio (logo o avatar con inicial).
function merchantHero(merchant: { name: string | null; legalName: string | null; logoUrl: string | null } | null): string {
  const name = esc(merchant?.legalName || merchant?.name || 'Tu proveedor');
  const hero = merchant?.logoUrl
    ? `<img class="merchant-logo" src="${esc(merchant.logoUrl)}" alt="logo"/>`
    : `<div class="merchant-avatar">${esc((name || '?').charAt(0).toUpperCase())}</div>`;
  return `<div class="merchant-hero">${hero}<div class="merchant-name">${name}</div></div>`;
}

// SCRUM-93b: aviso RGPD breve para el cliente final que firma (capa 1, RGPD_TRATAMIENTO_DATOS.md
// §5). PASIVO a propósito — sin casilla, sin registro de aceptación: la base de IP/UA de la
// firma es ejecución del contrato + interés legítimo (eIDAS/Ley 6/2020), no consentimiento, que
// es revocable y no serviría para "des-probar" una firma ya prestada. ⚠️ Este bloque NUNCA debe
// incluir ip/ua (regla SCRUM-68): solo texto informativo + nombre/contacto del profesional.
function avisoPrivacidad(merchant: { name: string | null; legalName: string | null; email: string | null } | null): string {
  const nombre = esc(merchant?.legalName || merchant?.name || 'El profesional');
  const contacto = merchant?.email ? ` escribiendo a ${esc(merchant.email)}` : '';
  return `<p class="privacy-note">Al firmar, <strong>${nombre}</strong> tratará tus datos (nombre, contacto y
    dirección del servicio) para gestionar este parte de trabajo y su cobro. También registramos
    la fecha, hora, IP y navegador de esta firma para poder acreditarla si fuera necesario.
    ${nombre} es responsable de tus datos; YaQu los trata en su nombre como proveedor
    tecnológico. Puedes ejercer tus derechos${contacto} — más información en la
    <a href="/privacidad">política de privacidad</a>.</p>`;
}

// Canvas de firma (adaptado de quoteDecisionLanding SIG_JS): expone getSignatureData().
const SIG_JS = `<script>(function(){
  const canvas=document.getElementById('sig-canvas');if(!canvas)return;
  const wrapper=canvas.parentElement,placeholder=document.getElementById('sig-placeholder');
  const ctx=canvas.getContext('2d');let drawing=false,hasSig=false;
  function resize(){const r=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
    const prev=ctx.getImageData(0,0,canvas.width,canvas.height);
    canvas.width=r.width*dpr;canvas.height=r.height*dpr;ctx.scale(dpr,dpr);ctx.putImageData(prev,0,0);
    ctx.strokeStyle='#0f1c17';ctx.lineWidth=2.5;ctx.lineCap='round';ctx.lineJoin='round';}
  resize();window.addEventListener('resize',resize);
  function pos(e){const r=canvas.getBoundingClientRect(),s=e.touches?e.touches[0]:e;return{x:s.clientX-r.left,y:s.clientY-r.top};}
  function start(e){e.preventDefault();drawing=true;const p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y);}
  function move(e){if(!drawing)return;e.preventDefault();const p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke();
    if(!hasSig){hasSig=true;if(placeholder)placeholder.style.display='none';if(wrapper)wrapper.classList.add('has-sig');}}
  function end(){drawing=false;}
  canvas.addEventListener('mousedown',start);canvas.addEventListener('mousemove',move);canvas.addEventListener('mouseup',end);
  canvas.addEventListener('touchstart',start,{passive:false});canvas.addEventListener('touchmove',move,{passive:false});canvas.addEventListener('touchend',end);
  document.getElementById('sig-clear')?.addEventListener('click',function(){
    ctx.clearRect(0,0,canvas.width/(window.devicePixelRatio||1),canvas.height/(window.devicePixelRatio||1));
    hasSig=false;if(placeholder)placeholder.style.display='';if(wrapper)wrapper.classList.remove('has-sig');});
  window.getSignatureData=function(){return hasSig?canvas.toDataURL('image/png'):null;};
})();</script>`;

/**
 * SCRUM-300 (C5): los dos campos de FIRMADO POR, sin añadir toques al camino normal.
 *
 * ⚠️ DOS DECISIONES QUE PARECEN LA MISMA Y SON OPUESTAS:
 *
 *  · El NOMBRE llega precargado con el del cliente. Lo pide el enunciado del ticket
 *    («el nombre precargado con el del cliente para el caso más común») y es un dato que
 *    nosotros ya sabemos, no una declaración de nadie.
 *
 *  · La CALIDAD llega SIN NADA MARCADO, y es deliberado: una casilla premarcada es una
 *    declaración que el firmante no ha hecho. Lo dice también el comentario de
 *    `firmadoPorCalidad` en `prisma/schema.prisma`. La rama `scrum-300-firmado-por` la
 *    premarcaba con «El propio cliente»; se ha retirado.
 *
 * El campo es OPCIONAL, así que no marcar nada no bloquea nada: el camino normal sigue siendo
 * trazo + botón. Solo paga toques quien firma siendo otra persona, que es justo el caso que el
 * documento necesita capturar.
 *
 * Los textos NO se escriben aquí: salen de `albaranFirmante.ts`, su fuente única (regla 30).
 * Hoy las seis etiquetas son `[PENDIENTE microcopy oficial]` porque nadie las ha aprobado.
 */
function firmanteCamposHtml(nombrePrecargado: string): string {
  // La primera opción va vacía y seleccionada: es la que deja el campo sin declarar.
  const opciones = firmanteCalidadOpciones()
    .map((o) => `<option value="${esc(o.id)}">${esc(o.etiqueta)}</option>`)
    .join('');
  const libre = esc(FIRMANTE_CALIDAD_LIBRE);
  return `
    <div class="firmante-campo">
      <label for="firmante-nombre">${esc(ALBARAN_ROTULOS.firmadoPorNombre)}</label>
      <input id="firmante-nombre" type="text" value="${nombrePrecargado}" maxlength="${FIRMANTE_NOMBRE_MAX}" autocomplete="name"/>
    </div>
    <div class="firmante-campo">
      <label for="firmante-calidad">${esc(ALBARAN_ROTULOS.firmadoPorCalidad)}</label>
      <select id="firmante-calidad"><option value="" selected></option>${opciones}</select>
    </div>
    <div class="firmante-campo" id="firmante-otro-wrap" style="display:none">
      <input id="firmante-otro" type="text" maxlength="${FIRMANTE_OTRO_MAX}" placeholder="${esc(FIRMANTE_CALIDAD_ETIQUETAS[FIRMANTE_CALIDAD_LIBRE])}"/>
    </div>
    <script>(function(){
      var sel=document.getElementById('firmante-calidad'),wrap=document.getElementById('firmante-otro-wrap');
      var nom=document.getElementById('firmante-nombre');
      if(!sel||!wrap)return;
      // El nombre llega PRECARGADO con el del cliente: se marca como sugerencia NUESTRA.
      if(nom&&nom.value)nom.dataset.deSugerencia='1';
      if(nom)nom.addEventListener('input',function(){delete nom.dataset.deSugerencia;});
      sel.addEventListener('change',function(){
        wrap.style.display = sel.value===${JSON.stringify(libre)} ? '' : 'none';
        if(sel.value===${JSON.stringify(libre)}){var o=document.getElementById('firmante-otro'); if(o)o.focus();}
        // 🔴 SCRUM-300: el nombre PRECARGADO se borra al cambiar de opción. Si quien firma dice
        // que no es el cliente, dejar ahí el nombre del cliente que pusimos nosotros sellaría una
        // declaración falsa. Lo que haya tecleado él a mano NO se toca.
        if(nom&&nom.dataset.deSugerencia==='1'&&sel.value&&sel.value!=='el_propio_cliente'){
          nom.value='';delete nom.dataset.deSugerencia;nom.focus();
        }
      });
    })();</script>`;
}

async function loadContext(token: string) {
  const albaran = await prisma.albaran.findUnique({ where: { firmaToken: token } });
  if (!albaran) return null;
  const [merchant, job] = await Promise.all([
    prisma.merchant.findUnique({ where: { id: albaran.merchantId }, select: { name: true, legalName: true, logoUrl: true, email: true } }),
    prisma.job.findUnique({ where: { id: albaran.jobId }, select: { customerId: true, titulo: true, direccion: true } }),
  ]);
  const customer = job ? await prisma.customer.findUnique({ where: { id: job.customerId }, select: { name: true } }) : null;
  return { albaran, merchant, job, customer };
}

// GET /albaran/:token — revisar + firmar (o estado "ya firmado" / no encontrado).
router.get('/:token', async (req: Request, res: Response) => {
  const html = (t: string, b: string) => res.setHeader('Content-Type', 'text/html; charset=utf-8').send(renderPage(t, b));
  const ctx = await loadContext(req.params.token).catch(() => null);
  if (!ctx) return res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8').send(documentNotFoundHtml());
  const { albaran, merchant, job, customer } = ctx;
  const hero = merchantHero(merchant);
  const customerName = esc(customer?.name || 'Cliente');
  const obra = esc((job?.direccion || job?.titulo || '').trim());

  if (albaran.estado === 'firmado') {
    return html('Parte de trabajo firmado', `${hero}<div class="status-ok"><strong>Este parte de trabajo ya está firmado.</strong><br/>Gracias, ${customerName}. Recibirás tu copia por WhatsApp.</div>`);
  }
  if (albaran.estado !== 'emitido') {
    // borrador u otro: el token solo se emite en 'emitido', pero degradamos con dignidad.
    return html('Parte de trabajo', `${hero}<div class="status-ok"><strong>Este parte de trabajo aún no está listo para firmar.</strong><br/>El profesional te avisará.</div>`);
  }

  /**
   * SCRUM-468 · LA PANTALLA ENSEÑA LO MISMO QUE EL PDF, y para el VALORADO eso incluye importes.
   *
   * Hasta aquí ocultaba precios a TODOS los albaranes: regla de cuando solo existía SIN_VALORAR.
   * SCRUM-65 metió el modo valorado en el PDF y **no tocó esta pantalla**, así que el cliente
   * firmaba una pantalla sin importes y quedaba vinculado a un papel con Base y Total.
   *
   * El QUÉ se pinta vive en `albaranPublicVista.ts` — aparte para poder ejecutarlo en un test
   * contra el PDF, campo por campo. Aquí solo se llama.
   */
  // SCRUM-607 (ALB-02): el interruptor viaja tambien a la pantalla que el cliente abre desde el
  // movil. Si el PDF los oculta y esta no, el cliente los ve igual y el control no oculta nada.
  const linesHtml = renderLineasAlbaran(
    albaran.lineas, albaran.modoValoracion, (albaran as any).ocultarPreciosEnDocumento,
  );

  return html('Firmar parte de trabajo', `
    ${hero}
    <h1>Hola, ${customerName} 👋</h1>
    <div class="meta">Parte de trabajo ${esc(albaran.numero)}${obra ? ` · ${obra}` : ''}</div>
    ${linesHtml}
    <hr class="divider"/>
    ${firmanteCamposHtml(customerName)}
    <label class="sig-label">Tu firma</label>
    <p class="sig-sub">Revisa el parte y firma con el dedo o el ratón.</p>
    <div class="sig-wrapper" id="sig-wrapper">
      <canvas id="sig-canvas"></canvas>
      <span class="sig-placeholder" id="sig-placeholder">✍️ Firma aquí</span>
    </div>
    <div class="sig-actions"><button type="button" class="btn-clear" id="sig-clear">Borrar</button></div>
    <button class="btn-accept" id="btn-sign">Firmar el parte de trabajo</button>
    <div id="sig-error" style="color:#dc2626;font-size:13px;margin-top:8px;display:none">Dibuja tu firma para continuar.</div>
    <small>Documento no fiscal — no constituye factura. Si no esperabas esto, cierra esta página.</small>
    ${avisoPrivacidad(merchant)}
    ${SIG_JS}
    <script>
      document.getElementById('btn-sign').addEventListener('click', async function(){
        const sig = window.getSignatureData ? window.getSignatureData() : null;
        const err = document.getElementById('sig-error');
        if(!sig){ err.textContent=${JSON.stringify('Dibuja tu firma para continuar.')}; err.style.display='block'; return; }
        // SCRUM-300: el NOMBRE es obligatorio al firmar (la columna admite nulo solo por las
        // filas anteriores a C5). Se corta aquí para no gastarle al cliente un viaje al servidor.
        // El texto sale de la fuente única y está APROBADO (fundador, 6-ago-2026).
        const nomEl = document.getElementById('firmante-nombre');
        if(nomEl && !nomEl.value.trim()){
          err.textContent=${JSON.stringify(COPY_FIRMA_SIN_NOMBRE)}; err.style.display='block'; nomEl.focus(); return;
        }
        // Y si se ha elegido la ranura libre, su texto también.
        const calEl0 = document.getElementById('firmante-calidad');
        const otroEl0 = document.getElementById('firmante-otro');
        if(calEl0 && calEl0.value===${JSON.stringify(FIRMANTE_CALIDAD_LIBRE)} && otroEl0 && !otroEl0.value.trim()){
          err.textContent=${JSON.stringify(COPY_CALIDAD_OTRO_VACIO)}; err.style.display='block'; otroEl0.focus(); return;
        }
        err.style.display='none';
        const btn=this; btn.disabled=true; btn.textContent='Enviando…';
        try{
          // SCRUM-300: los dos datos de FIRMADO POR viajan CON la firma, para que entren en el
          // contenido ANTES de sellarlo. Pegarlos después rompería el hash.
          const cal=document.getElementById('firmante-calidad');
          const r=await fetch(${JSON.stringify(`/albaran/${req.params.token}/firmar`)},{
            method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
              signatureData:sig,
              // SCRUM-361 (H6): la versión que ESTA PÁGINA pintó. El servidor la compara con la de
              // ahora y NO sella si difieren — el cliente no puede firmar algo que no vio. No es
              // un hash: es el contador de fila que el PATCH ya incrementaba.
              version:${JSON.stringify(albaran.version)},
              firmadoPorNombre:(document.getElementById('firmante-nombre')||{}).value||'',
              firmadoPorCalidad:cal?cal.value:'',
              firmadoPorCalidadOtro:(document.getElementById('firmante-otro')||{}).value||''
            })});
          if(r.ok){
            document.querySelector('.card').innerHTML=
              '<div style="text-align:center;padding:12px 0"><div class="success-check">✓</div>'+
              '<h1>¡Parte firmado!</h1><p class="meta">Gracias, ${customerName}. Recibirás tu copia por WhatsApp.</p></div>';
          } else {
            const d=await r.json().catch(()=>({}));
            // 🔴 SCRUM-361: el albarán cambió mientras esta página estaba abierta. NO es un error
            // de validación y no puede parecerlo: va en un aviso propio con su botón, no en la
            // línea roja de «dibuja tu firma». Y se RETIRA el botón de firmar — dejarlo activo
            // invitaría a reintentar lo mismo, que es exactamente lo que no debe pasar.
            if(d.error===${JSON.stringify('albaran_cambiado')}){
              document.querySelector('.card').innerHTML=
                '<div class="status-aviso"><strong>'+${JSON.stringify(COPY_ALBARAN_CAMBIADO)}+'</strong>'+
                '<button type="button" class="btn-accept" style="margin-top:14px" onclick="location.reload()">'+
                ${JSON.stringify(COPY_ALBARAN_CAMBIADO_BOTON)}+'</button></div>';
              return;
            }
            btn.disabled=false; btn.textContent='Firmar el parte de trabajo';
            const e=document.getElementById('sig-error');
            e.textContent=d.message||'No se pudo firmar. Inténtalo de nuevo.'; e.style.display='block';
          }
        }catch(_){ btn.disabled=false; btn.textContent='Firmar el parte de trabajo';
          const e=document.getElementById('sig-error'); e.textContent='Error de conexión.'; e.style.display='block'; }
      });
    </script>
  `);
});

// POST /albaran/:token/firmar — emitido → firmado + auto-envío de la copia firmada (best-effort).
router.post('/:token/firmar', firmaLimiter, async (req: Request, res: Response) => {
  try {
    const albaran = await prisma.albaran.findUnique({ where: { firmaToken: req.params.token } });
    if (!albaran) return res.status(404).json({ error: 'not_found', message: 'Este enlace no es válido.' });
    if (albaran.estado === 'firmado') return res.json({ ok: true, already: true }); // idempotente
    if (!canTransitionAlbaran(albaran.estado, 'firmado')) {
      return res.status(409).json({ error: 'invalid_transition', message: 'Este parte de trabajo no se puede firmar ahora.' });
    }

    // ── 🔴 SCRUM-361 (H6) · ¿SIGUE SIENDO EL ALBARÁN QUE EL CLIENTE VIO? ──────────────────────
    //
    // El PATCH solo se bloquea cuando el albarán ya está FIRMADO (`albaranes.routes.ts`), así que
    // un albarán ENVIADO A FIRMAR todavía se puede editar. Si el profesional corrige una línea
    // mientras el cliente tiene el enlace abierto, el cliente firma la pantalla que tenía y queda
    // sellado un contenido que NO VIO. La firma vale cero y parece que vale.
    //
    // Se compara ANTES de mirar la firma a propósito: si el documento ya no es el mismo, lo que
    // haya dibujado da igual, y el cliente prefiere enterarse antes que después de firmar.
    //
    // ⚠️ NO se recalcula ningún hash aquí ni en el navegador. `Albaran.version` es —hoy,
    // medido— «el contenido del documento cambió»: la incrementa un solo escritor, el PATCH, y
    // es el único que toca contenido. Duplicar `computeAlbaranContentHash` en el cliente era el
    // riesgo que H0 señaló (dos implementaciones que derivan en silencio) y esto lo evita entero.
    // Que siga siendo verdad lo vigila `tests/scrum361-version-al-firmar.test.mjs`.
    const mismaVersion = puedeFirmarEstaVersion(req.body?.version, albaran.version);
    if (!mismaVersion.ok) {
      return res.status(409).json({ error: mismaVersion.error, message: mismaVersion.message });
    }

    const signatureData = String(req.body?.signatureData || '');
    if (!/^data:image\/(png|jpeg);base64,/.test(signatureData)) {
      return res.status(400).json({ error: 'firma_invalida', message: 'La firma no es válida.' });
    }
    if (signatureData.length > FIRMA_MAX_CHARS) {
      return res.status(413).json({ error: 'firma_demasiado_grande', message: 'La firma es demasiado grande.' });
    }

    // Firma remota: sella evidencias (SCRUM-68) → estado firmado, congelado. Canal 'remoto'
    // y tokenId = firmaToken usado. ⚠️ ip/ua se guardan SOLO en evidenciaFirma y NUNCA se
    // exponen aquí: esta página pública jamás los devuelve (ni en el HTML ni en el JSON).
    // SCRUM-300 (C5): quién firma y en calidad de qué, también en el canal remoto. Resueltos
    // ANTES de sellar. Aquí quien tiene el móvil es normalmente el propio cliente, así que la
    // ranura precargada acierta aún más que en obra.
    const calidad = resolverCalidadFirmante({
      ranura: req.body?.firmadoPorCalidad,
      textoLibre: req.body?.firmadoPorCalidadOtro,
    });
    if (!calidad.ok) return res.status(400).json({ error: calidad.error, message: calidad.message });
    // SCRUM-300: el nombre es OBLIGATORIO al firmar (columna nullable por las filas viejas; el
    // acto de firmar lo exige). Ver `exigirNombreFirmante` para el porqué de las dos reglas.
    const nombre = exigirNombreFirmante(req.body?.firmadoPorNombre);
    if (!nombre.ok) return res.status(400).json({ error: nombre.error, message: nombre.message });
    const firmadoPorNombre = nombre.nombre;

    const firmadoAt = new Date();
    const evidencia = await buildFirmaEvidencia({
      albaran,
      canal: 'remoto',
      ip: requestIp(req),
      ua: (req.headers['user-agent'] as string) || null,
      tokenId: albaran.firmaToken,
      firmadoAt,
      firmadoPorNombre,
      firmadoPorCalidad: calidad.valor,
    });
    await prisma.albaran.update({
      where: { id: albaran.id },
      data: {
        estado: 'firmado', signatureUrl: signatureData, firmadoAt, evidenciaFirma: evidencia as any,
        firmadoPorNombre, firmadoPorCalidad: calidad.valor,
      },
    });
    await ensureAlbaranPdf(albaran.id, true).catch((e) => console.error('[albaranPublic] PDF tras firmar:', e?.message || e));

    // AUTO-ENVÍO de la copia firmada (SCRUM-49): best-effort, fire-and-forget. La firma NUNCA
    // falla por el envío; si el tope 3/día (J6) corta, la copia queda en la plataforma y el pro
    // puede reenviarla a mano (botón de la 47). Guards completos vía el servicio.
    sendAlbaranFirmadoWhatsApp(albaran.id).catch((e) => console.error('[albaranPublic] auto-envío:', e?.message || e));

    return res.json({ ok: true });
  } catch (err: any) {
    console.error('[POST /albaran/:token/firmar]', err?.message || err);
    return res.status(500).json({ error: 'internal_error', message: 'Error inesperado. Inténtalo más tarde.' });
  }
});

export default router;
