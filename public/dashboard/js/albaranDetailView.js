// public/dashboard/js/albaranDetailView.js — SCRUM-302 (C2)
//
// LA PÁGINA DE DETALLE DEL ALBARÁN. Hasta hoy el albarán no tenía página: vivía como una FILA
// dentro de la pila de DOCUMENTOS del Trabajo, con sus acciones apretadas en la fila.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA LEY NO SE ESCRIBE AQUÍ
//
// Qué acción va de primaria, cuáles de secundarias y cuáles al «⋮» lo dice
// `albaranActionsRegistry.js`, y la regla que lo gobierna vive en `patronDetalleAcciones.js` —
// la MISMA que usa la factura. Esta vista solo CREA los botones (con su handler) y los coloca
// donde el registro diga. Si mañana cambia el patrón, cambia en un sitio.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS RÓTULOS (regla 30: los aprueba el fundador, no esta sesión)
//
// `ROTULOS` es el ÚNICO sitio donde vive el texto de una acción. Ninguno se ha redactado aquí:
//   · cuatro los aprobó el fundador para este ticket — son NUEVOS en el árbol;
//   · los otros cinco se reutilizan LETRA POR LETRA de la fila del Trabajo, que es de donde
//     estas mismas acciones se están mudando. Reutilizar no es redactar: el rótulo aprobado
//     para «emitir este albarán» no cambia de significado por cambiar de superficie.
//
// El `||` del fondo NO es decorativo. Una acción que el registro declare y que nadie haya
// rotulado se pinta con el marcador VISIBLE, no con un hueco: un botón sin texto es un botón
// que el pro no puede usar y que nadie ve en una captura.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL RAIL ES DE SOLO LECTURA, Y ESO INCLUYE LO QUE **NO** ENSEÑA
//
// Trabajo, cliente, dirección, estado de facturación y lo que queda por facturar. Lo que NO hay
// —y no por olvido— es ninguna comparación entre las líneas del albarán y las del presupuesto:
// **no existe campo que las ate** (medido en A0.2; el libro de facturadas referencia el índice
// de la línea del ALBARÁN, del presupuesto nada). Enseñarlas emparejadas sería inventar una
// correspondencia por coincidencia de concepto.

// El nombre lleva sufijo A PROPÓSITO: los scripts clásicos del dashboard comparten ámbito
// léxico, y un `const ROTULOS` a secas es el tipo de nombre que otra pantalla vuelve a declarar
// tarde o temprano. Dos `const` iguales = SyntaxError EN PARSEO y la pantalla desaparece sin
// 500 ni log (caso `copyRojo`, SCRUM-210).
const ROTULOS_ALBARAN = {
  // Aprobados para ESTE ticket (nuevos en el árbol)
  btnFacturar: 'Facturar lo entregado',
  btnFirmarAqui: 'Firmar aquí mismo',
  btnVerTrabajo: 'Ver trabajo',
  // Reutilizados letra por letra de la fila del Trabajo (jobDetailView.js), de donde se mudan
  btnEmitir: 'Emitir',
  btnEnviarFirmar: 'Enviar para firmar',
  btnPdf: 'PDF',
  btnWhatsApp: 'Enviar por WhatsApp',
  btnEditarLineas: 'Editar líneas',
  btnFoto: '📷 Añadir foto',
};

// EL CONTRATO CON LA FILA DEL TRABAJO, en un sitio que una máquina puede leer.
//
// Clave = acción de esta página que NO hace el trabajo, solo navega. Valor = la función de
// `jobDetailView.js` que tiene el mecanismo de verdad y que por eso NO se puede borrar de la fila.
//
// `btnVerTrabajo` no está aquí y no es un olvido: ese botón navega porque navegar ES lo que hace.
// Es la diferencia entre un destino y un callejón sin salida, y el guard la respeta.
const PUENTES_A_LA_FILA = {
  btnFacturar: 'openFacturarParcialSheet',
  btnEditarLineas: 'openAlbEditorSheet',
};

async function renderAlbaranDetailView(container, albaranId) {
  container.innerHTML = '';
  const page = document.createElement('div');
  page.className = 'detail-page';
  container.appendChild(page);

  const setStatus = (tipo, texto) => {
    let box = page.querySelector('.alb-status');
    if (!box) {
      box = document.createElement('div');
      box.className = 'alb-status';
      page.prepend(box);
    }
    box.className = 'alb-status alert ' + (tipo === 'error' ? 'error' : 'info');
    box.textContent = texto || '';
    box.style.display = texto ? 'block' : 'none';
  };

  let alb;
  try {
    alb = await apiRequest(`/admin/albaranes/${albaranId}`);
  } catch (e) {
    setStatus('error', 'No se pudo cargar el albarán: ' + (e?.data?.message || e.message));
    return;
  }

  const recargar = () => renderAlbaranDetailView(container, albaranId);
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // ── CABECERA ────────────────────────────────────────────────────────────────────────────
  const head = document.createElement('div');
  head.className = 'detail-head';
  head.innerHTML =
    `<div><div class="detail-total-label">Albarán</div>` +
    `<h2 style="margin:2px 0 0">${esc(alb.numero || '—')}</h2></div>`;
  page.appendChild(head);

  // ── EL ESTADO, Y SUS DOS DERIVADOS ──────────────────────────────────────────────────────
  // El estado del MODELO es uno de tres (borrador|emitido|firmado). Lo demás que se enseña aquí
  // son DERIVADOS y se pintan como tales, no como estados: «enviado para firmar» y el estado de
  // facturación, que tiene TRES valores y por eso no se aplana a un sí/no.
  const chips = document.createElement('div');
  chips.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 16px';
  chips.innerHTML =
    `<span class="status-pill">${esc(alb.estado)}</span>` +
    (alb.enviadoParaFirma ? '<span class="status-pill status-pill-pending">enviado para firmar</span>' : '') +
    (alb.estadoFacturacion && alb.estadoFacturacion !== 'sin_facturar'
      ? `<span class="status-pill">${esc(alb.estadoFacturacion)}</span>` : '');
  page.appendChild(chips);

  // ── ACCIONES · una primaria, dos secundarias, el resto en «⋮» ───────────────────────────
  const acts = document.createElement('div');
  acts.className = 'job-doc-toolbar';
  page.appendChild(acts);

  const post = async (ruta, body) => {
    setStatus('info', MICROCOPY_PENDIENTE);
    try {
      await apiRequest(`/admin/albaranes/${alb.id}${ruta}`, {
        method: 'POST', body: body ? JSON.stringify(body) : undefined,
      });
      recargar();
    } catch (e) { setStatus('error', e?.data?.message || e.message); }
  };

  /**
   * SCRUM-128 · LA COMPROBACIÓN VA JUNTO A LA LLAMADA, no en un helper.
   *
   * Un envío de WhatsApp responde **200 aunque Meta lo rechace**: el resultado viene DENTRO del
   * cuerpo. Dar por enviado lo que no salió es el fallo mudo que aquel ticket cerró — el pro cree
   * que su cliente tiene el parte y no lo tiene.
   *
   * Las dos primeras versiones de esta página lo escondieron: una dentro del `post` genérico y
   * otra dentro de un `enviar()`. Su guard cazó las dos, porque mide la distancia entre la RUTA y
   * la comprobación — y tiene razón más allá del guard: quien lee el handler tiene que ver que
   * aquí se comprueba, sin ir a buscarlo a otra función.
   */
  const mk = (id, onClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.accion = id;
    b.textContent = ROTULOS_ALBARAN[id] || MICROCOPY_PENDIENTE;
    b.addEventListener('click', onClick);
    return b;
  };

  // Los handlers son los MISMOS endpoints que usaba la fila del Trabajo: la página no inventa
  // caminos nuevos, se lleva los que ya existían.
  const botones = {
    btnEmitir: () => mk('btnEmitir', () => post('/emitir')),
    btnEnviarFirmar: () => mk('btnEnviarFirmar', async () => {
      setStatus('info', MICROCOPY_PENDIENTE);
      try {
        const d = await apiRequest(`/admin/albaranes/${alb.id}/enviar-para-firmar`, { method: 'POST' });
        if (waSendFailed(d)) { setStatus('error', d?.message || MICROCOPY_PENDIENTE); return; }
        recargar();
      } catch (e) { setStatus('error', e?.data?.message || e.message); }
    }),
    // ⚠️ LOS DOS PUENTES QUE QUEDAN, y son un CONTRATO con la fila del Trabajo.
    //
    // `btnFacturar` y `btnEditarLineas` no hacen el trabajo: llevan al Trabajo, donde SÍ está el
    // mecanismo. Sus dos hojas (`openFacturarParcialSheet`, `openAlbEditorSheet`) viven ANIDADAS
    // dentro de `renderJobDetailView` — medido: columna 2, no son globales — así que desde aquí
    // no se pueden invocar sin sacarlas antes, y eso es un refactor de otra pantalla (y el de
    // facturar toca el camino del dinero).
    //
    // Consecuencia dura, y por eso está escrita: mientras estos dos naveguen, la fila NO puede
    // quedarse solo con el enlace — tiene que conservar «Editar líneas» y «Facturar parte» o
    // estos botones se convierten en callejones sin salida. Lo vigila
    // `tests/scrum302-sin-callejones.test.mjs`, que lo DERIVA de este fichero: no es una promesa
    // de comentario.
    btnFacturar: () => mk('btnFacturar', () => {
      if (window.renderAppView) window.renderAppView('jobs-detail', { jobId: alb.job?.id });
    }),
    // FIRMAR ES DE VERDAD AQUÍ. El rótulo aprobado dice «aquí mismo» y tiene que ser cierto: un
    // botón que promete firmar y te manda a otra pantalla a buscar otro botón es peor que no
    // tenerlo. El componente de firma ya es global (`signaturePad.js`), así que esto es la MISMA
    // mecánica en otra superficie, no una nueva.
    btnFirmarAqui: () => mk('btnFirmarAqui', () => {
      if (!window.openSignaturePad) { setStatus('error', 'El componente de firma no está cargado.'); return; }
      window.openSignaturePad({
        title: 'Firma del cliente',
        onConfirm: async (dataUri) => {
          try {
            await apiRequest(`/admin/albaranes/${alb.id}/firmar`, {
              method: 'POST', body: JSON.stringify({ signatureData: dataUri }),
            });
            recargar();
          } catch (e) { setStatus('error', 'No se pudo firmar: ' + (e?.data?.message || e.message)); }
        },
      });
    }),
    btnPdf: () => mk('btnPdf', () => window.open(`/admin/albaranes/${alb.id}/pdf`, '_blank')),
    btnWhatsApp: () => mk('btnWhatsApp', async () => {
      setStatus('info', MICROCOPY_PENDIENTE);
      try {
        const d = await apiRequest(`/admin/albaranes/${alb.id}/enviar-whatsapp`, { method: 'POST' });
        if (waSendFailed(d)) { setStatus('error', d?.message || MICROCOPY_PENDIENTE); return; }
        recargar();
      } catch (e) { setStatus('error', e?.data?.message || e.message); }
    }),
    btnEditarLineas: () => mk('btnEditarLineas', () => {
      if (window.renderAppView) window.renderAppView('jobs-detail', { jobId: alb.job?.id });
    }),
    // La foto también se sube aquí: el endpoint ya existe y el límite de 5 MB se comprueba ANTES
    // de leer el fichero — un móvil de gama media leyendo 12 MB en base64 se queda clavado, y el
    // pro no sabría si está subiendo o si se ha colgado.
    btnFoto: () => mk('btnFoto', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp';
      input.style.display = 'none';
      page.appendChild(input);
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { setStatus('error', 'Cada foto puede ocupar como máximo 5 MB.'); input.value = ''; return; }
        const rd = new FileReader();
        rd.onload = async () => {
          try {
            await apiRequest(`/admin/albaranes/${alb.id}/fotos`, {
              method: 'POST', body: JSON.stringify({ data: rd.result, mime: file.type }),
            });
            recargar();
          } catch (e) { setStatus('error', e?.data?.message || 'No se pudo subir la foto.'); }
        };
        rd.readAsDataURL(file);
      });
      input.click();
    }),
    btnVerTrabajo: () => mk('btnVerTrabajo', () => {
      if (window.renderAppView) window.renderAppView('jobs-detail', { jobId: alb.job?.id });
    }),
  };

  // El CONTEXTO de la primaria contextual: facturar solo es el siguiente paso si el albarán lleva
  // precios y queda algo pendiente. Sale del derivado de TRES valores, no de un booleano.
  const ctx = {
    'valorado-con-pendiente':
      alb.modoValoracion === 'VALORADO' && alb.estadoFacturacion !== 'facturado',
  };

  const cubos = { primaria: [], secundaria: [], overflow: [] };
  for (const accion of (window.ALBARAN_ACTION_REGISTRY || [])) {
    const destino = window.destinoEfectivo(accion, alb.estado, ctx);
    if (destino === 'oculta' || destino === 'seccion-propia') continue;
    const crear = botones[accion.id];
    if (!crear) continue; // acción declarada sin botón: la caza el guard, no se inventa aquí
    const b = crear();
    b.className = destino === 'primaria' ? 'btn-primary btn-sm'
      : (destino === 'secundaria' ? 'btn-secondary btn-sm' : 'btn-ghost btn-sm');
    cubos[destino].push(b);
  }
  for (const b of cubos.primaria) acts.appendChild(b);
  for (const b of cubos.secundaria) acts.appendChild(b);
  if (cubos.overflow.length) {
    acts.appendChild(typeof overflowMenu === 'function'
      ? overflowMenu(cubos.overflow)
      : (() => { const d = document.createElement('div'); cubos.overflow.forEach((b) => d.appendChild(b)); return d; })());
  }

  // ── RAIL DE SOLO LECTURA ────────────────────────────────────────────────────────────────
  const rail = document.createElement('div');
  rail.className = 'detail-rail';
  rail.style.cssText = 'margin-top:18px;display:flex;flex-direction:column;gap:8px;font-size:13px';
  const fila = (etiqueta, valor) =>
    `<div><span class="detail-total-label">${esc(etiqueta)}</span><div>${esc(valor ?? '—')}</div></div>`;
  const pendientes = Array.isArray(alb.pendientes) ? alb.pendientes.filter((p) => p.pendiente > 0) : [];
  rail.innerHTML =
    fila('Trabajo', alb.job?.titulo) +
    fila('Cliente', alb.customer?.name) +
    fila('Dirección', alb.job?.direccion) +
    fila('Facturación', alb.estadoFacturacion) +
    // El «parcial» se enseña con su detalle: decir «parcial» sin decir QUÉ queda es la mitad del
    // dato, y es el caso normal en una obra por fases.
    (pendientes.length ? fila('Pendiente de facturar', `${pendientes.length} línea(s)`) : '');
  page.appendChild(rail);
}

if (typeof window !== 'undefined') window.renderAlbaranDetailView = renderAlbaranDetailView;
