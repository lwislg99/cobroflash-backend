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
  // SCRUM-302 · APROBADO por el fundador el 5-ago-2026: es la palabra del ticket y la que usa
  // todo el mundo en un menu de desbordamiento. Describe lo que hace sin adornarlo.
  btnDuplicar: 'Duplicar',
};

// SCRUM-302 · APROBADO por el fundador el 5-ago-2026. Dice lo que SÍ trae ANTES de lo que no: el
// profesional necesita saber que su trabajo está ahí, no empezar por una carencia. Y el «nunca»
// hace el trabajo pesado — convierte una ausencia en una REGLA; sin él, se lee como que esta vez
// ha fallado algo y se vuelve a intentar. No se explica el motivo legal: eso es razonamiento
// nuestro, no suyo. Él necesita saber qué tiene delante.
const COPY_DUPLICADO_CREADO = 'Duplicado creado. Trae las líneas y las notas del original; la firma y las fotos no se copian nunca.';
const _FIN_ROTULOS = {
  // Reutilizados letra por letra de la fila del Trabajo (jobDetailView.js), de donde se mudan
  btnEmitir: 'Emitir',
  btnEnviarFirmar: 'Enviar para firmar',
  btnPdf: 'PDF',
  btnWhatsApp: 'Enviar por WhatsApp',
  btnEditarLineas: 'Editar líneas',
  btnFoto: '📷 Añadir foto',
};

// LOS RÓTULOS DEL RAIL — SIN APROBAR (regla 30), y por eso valen `null`.
//
// No son un descuido ni un hueco a rellenar deprisa: el fundador NO aprueba textos por su
// descripción, así que hasta que los dicte LITERALES cada uno se pinta con el marcador VISIBLE.
// El pro ve `[PENDIENTE microcopy oficial]`, que es feo a propósito — un rótulo provisional que
// se lee bien se queda para siempre y nadie vuelve a preguntarse quién lo escribió.
//
// ⚠️ `presupuestoOrigen` es el que más cuidado pide, y el motivo NO es el texto: es que un rótulo
// que hable de «estas líneas» convertiría un enlace del DOCUMENTO en una afirmación sobre CADA
// línea, que es falsa en modo SIN_VALORAR y en todo albarán que no venga del prellenado.
const ROTULOS_RAIL_ALBARAN = {
  presupuestoOrigen: null,
  fotos: null,
};

// Reutilizado LETRA POR LETRA del precedente que ya funciona (`jobDetailView.js`, las miniaturas
// de la fila): es el mismo objeto en otra superficie. Reutilizar no es redactar.
const ALT_FOTO_ALBARAN = 'Foto del albarán';

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
    // SCRUM-302 · duplicar: el POST crea el parte nuevo y se navega a EL, no al original —
    // quedarse en el de ayer haria pensar que no ha pasado nada.
    btnDuplicar: () => mk('btnDuplicar', async () => {
      try {
        const copia = await apiRequest(`/admin/albaranes/${alb.id}/duplicar`, { method: 'POST' });
        // El aviso tiene que sobrevivir a la navegación: un `setStatus` aquí se pierde al
        // re-renderizar. Marca de UN SOLO USO, que la vista consume al montar.
        if (window.appState) window.appState.avisoDuplicado = true;
        if (window.renderAppView) window.renderAppView('albaran-detail', { albaranId: copia.id });
      } catch (e) { setStatus('error', e?.data?.message || MICROCOPY_PENDIENTE); }
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

  // ── SCRUM-302 · EL AVISO DEL DUPLICADO, al aterrizar ────────────────────────────────────
  //
  // 🔴 POR QUÉ HACE FALTA: al duplicar un albarán FIRMADO se aterriza en el duplicado, y la única
  // señal de que la firma NO ha viajado es el chip `borrador`. Hay que DEDUCIRLO — medido: esta
  // página **no pinta la firma en ningún estado**, así que ni siquiera queda un hueco donde antes
  // se veía. Duplicar un documento firmado y que el resultado no diga que la firma no viajó es la
  // clase de silencio que alguien descubre el día que enseña el papel equivocado.
  //
  // ⚠️ ESTO ES UN PARCHE SOBRE UN HUECO, NO SU SOLUCIÓN. Que la firma se vea en esta página es
  // `FIRMADO POR`, y eso es **SCRUM-300** (bloque C5, bloqueado por su migración). Cuando 300
  // entre, este aviso sigue siendo útil, pero el problema de fondo se arregla allí — que nadie lea
  // esto dentro de dos meses y crea que está resuelto.
  //
  // Se consume la marca (un solo uso): si se quedara puesta, el aviso reaparecería en cada visita
  // a la ficha, y un aviso permanente deja de leerse.
  if (window.appState && window.appState.avisoDuplicado) {
    window.appState.avisoDuplicado = false;
    setStatus('info', COPY_DUPLICADO_CREADO);
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

  // ── ① PRESUPUESTO ORIGEN · ENLACE DEL **DOCUMENTO**, EN EL RAIL ─────────────────────────
  //
  // 🔴 POR QUÉ VIVE AQUÍ Y NO JUNTO A LAS LÍNEAS, que es donde parecería más útil:
  //
  // Sí existe un vínculo línea a línea —`AlbaranLinea.quoteLineIndex`, desde SCRUM-367— pero **no
  // cubre todos los casos**: no lo hay en modo SIN_VALORAR, solo lo escribe el prellenado, y el
  // índice no sabe de QUÉ presupuesto es. Un enlace pegado a las líneas AFIRMA que esas líneas
  // vienen de ese presupuesto, y eso es cierto solo a veces. Colocarlo lejos no es estética: es
  // la diferencia entre decir «este parte nació de este presupuesto» (verdad, siempre) y «cada
  // línea de aquí sale de allí» (mentira, a menudo).
  //
  // Y LA PROXIMIDAD ES LA QUE AFIRMA, no el rótulo: cambiarle el texto no salvaría a un enlace
  // colocado dentro de la tabla. Por eso el guard mide DÓNDE cuelga —el rail—, y exige además que
  // las líneas no entren en el rail: `tests/scrum302-presupuesto-y-fotos.test.mjs`.
  //
  // Se omite entero si el Trabajo no vino de un presupuesto (`Job.quoteId` es nullable): una
  // etiqueta con un guion invita a pulsar algo que no lleva a ningún sitio.
  if (alb.quote && alb.quote.id != null) {
    const filaQuote = document.createElement('div');
    filaQuote.className = 'detail-rail-linea';
    const etiquetaQuote = document.createElement('span');
    etiquetaQuote.className = 'detail-rail-etiqueta';
    etiquetaQuote.textContent = ROTULOS_RAIL_ALBARAN.presupuestoOrigen || MICROCOPY_PENDIENTE;
    filaQuote.appendChild(etiquetaQuote);
    // Navegación DENTRO del dashboard, con la misma llamada que ya usa el rail del Trabajo
    // (`jobRailBlocks`/`jobDetailView`): un `href` de verdad a otra URL recargaría la app entera.
    const enlaceQuote = document.createElement('a');
    enlaceQuote.className = 'detail-rail-enlace';
    enlaceQuote.href = '#';
    enlaceQuote.textContent = `#${alb.quote.number ?? alb.quote.id}`;
    enlaceQuote.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.renderAppView) window.renderAppView('quotes-detail', { quoteId: alb.quote.id });
    });
    filaQuote.appendChild(enlaceQuote);
    rail.appendChild(filaQuote);
  }

  // ── ② LAS FOTOS DEL PARTE ───────────────────────────────────────────────────────────────
  //
  // El camino de lectura YA EXISTE entero y esta página no abre ninguno nuevo: lista con
  // `GET /:id/fotos` y sirve el binario con `GET /admin/attachments/:id`, que es exactamente lo
  // que hace la fila del Trabajo hoy (`jobDetailView.js`, las miniaturas). Misma mecánica, otra
  // superficie — la cookie de sesión viaja en el `<img>`, así que la tenencia la sigue guardando
  // el backend y no hace falta token en la URL.
  //
  // El bloque se pinta SOLO si hay fotos: un rótulo sobre un hueco vacío hace pensar que algo se
  // ha perdido. Y el `catch` es mudo a propósito, igual que en el precedente: que no carguen las
  // miniaturas no puede tapar con un error rojo la ficha del albarán, que sí ha cargado.
  apiRequest(`/admin/albaranes/${alb.id}/fotos`).then((fotos) => {
    const lista = Array.isArray(fotos) ? fotos : [];
    if (!lista.length) return;
    const filaFotos = document.createElement('div');
    filaFotos.className = 'detail-rail-linea';
    const etiquetaFotos = document.createElement('span');
    etiquetaFotos.className = 'detail-rail-etiqueta';
    etiquetaFotos.textContent = ROTULOS_RAIL_ALBARAN.fotos || MICROCOPY_PENDIENTE;
    filaFotos.appendChild(etiquetaFotos);
    const galeria = document.createElement('div');
    galeria.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';
    for (const f of lista) {
      const img = document.createElement('img');
      img.src = `/admin/attachments/${f.id}`;
      img.alt = ALT_FOTO_ALBARAN;
      img.loading = 'lazy';
      img.style.cssText = 'width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid var(--border)';
      galeria.appendChild(img);
    }
    filaFotos.appendChild(galeria);
    rail.appendChild(filaFotos);
  }).catch(() => {});
}

if (typeof window !== 'undefined') window.renderAlbaranDetailView = renderAlbaranDetailView;
