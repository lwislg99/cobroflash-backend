// public/dashboard/js/customerDetailView.js
// Vista Customer 360: historial completo de un cliente

/**
 * SCRUM-980 · EL HISTORIAL DE TRABAJO: las piezas sin DOM de la pestaña «Trabajos».
 *
 * ✅ TEXTOS FIRMADOS por el orquestador por delegación del fundador (21-sep-2026, SCRUM-980;
 * registro en `docs/microcopy/2026-09-21-SCRUM-980-historial-del-cliente.md`). Viven aquí juntos
 * para poder fijarlos con `===` desde un solo test.
 *
 * Los datos salen de `GET /admin/customers/:id/historial` (SCRUM-980, primera mitad): el técnico
 * recibe solo sus trabajos, así que esta pieza no filtra nada por rol.
 */
const HISTORIAL_CLIENTE = {
  TEXTOS: {
    pestana: 'Trabajos',
    vacio: 'Sin trabajos',
    proxima: 'Próxima visita: ',
    columnas: ['Fecha', 'Trabajo', 'Estado', 'Documentos'],
    verMas: 'Ver más trabajos',
    sueltos: 'Partes sin trabajo',
  },
  /** «Trabajos (n)», o «Trabajos (20+)» cuando el servidor dice que hay más páginas. */
  tituloPestana(n, hayMas) {
    return HISTORIAL_CLIENTE.TEXTOS.pestana + ' (' + (hayMas ? n + '+' : n) + ')';
  },
  /** «5 oct 2026, 10:00». `null` si no hay fecha o no es una fecha: la línea NO se pinta. */
  fechaProxima(v) {
    if (v === null || v === undefined || v === '') return null;
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  },
  /** El nombre accesible del «📷 n». */
  ariaFotos(n) { return n === 1 ? '1 foto' : n + ' fotos'; },
  /** La fecha de la fila: la agendada; si no la hay, la de alta. */
  fechaDeTrabajo(t) { return (t && (t.scheduledAt || t.createdAt)) || null; },
};
if (typeof window !== 'undefined') window.historialCliente = HISTORIAL_CLIENTE;

/**
 * SCRUM-1133 · LOS WHATSAPP QUE SE LE HAN ENVIADO AL CLIENTE: las piezas sin DOM de su pestaña.
 *
 * `GET /admin/customers/:id/whatsapp` (SCRUM-1062) estaba construido y no lo llamaba nadie. Textos
 * firmados en SCRUM-1133 (registro en `docs/microcopy/2026-09-28-SCRUM-1133-whatsapp-del-cliente.md`).
 * El ESTADO de cada mensaje no se escribe aquí: lo pinta `waDeliveryChip` (api.js, WA-0b), el mismo
 * chip que ya enseñan presupuestos y facturas. Y se callan dos campos a propósito: `error` es el
 * texto crudo de Meta, en inglés, y `templateName` el nombre interno de la plantilla.
 */
const WHATSAPP_CLIENTE = {
  TEXTOS: {
    pestana: 'WhatsApp',
    vacio: 'Sin mensajes de WhatsApp',
    columnas: ['Fecha', 'Documento', 'Estado'],
    verMas: 'Ver más mensajes',
    factura: 'Factura',
    cobro: 'Cobro',
    sinDocumento: '—',
  },
  /**
   * «WhatsApp (n)», o «WhatsApp (n+)» cuando el servidor dice que hay más páginas. `n` es lo
   * cargado: el tamaño de página lo decide el servidor y aquí no se escribe (SCRUM-1133 17448, ①).
   */
  tituloPestana(n, hayMas) {
    return WHATSAPP_CLIENTE.TEXTOS.pestana + ' (' + (hayMas ? n + '+' : n) + ')';
  },
  /**
   * El documento de la fila. El número sale de las listas que la ficha YA tiene, nunca del id
   * interno (`relatedId`): «#57» por un presupuesto que el profesional conoce como el 12 sería falso.
   * Si no está en la lista, se nombra el tipo sin número.
   */
  documento(m, quotes, invoices, nombrePresupuesto) {
    const T = WHATSAPP_CLIENTE.TEXTOS;
    if (!m || !m.relatedType) return T.sinDocumento;
    if (m.relatedType === 'quote') {
      const q = (quotes || []).find((x) => x.id === m.relatedId);
      const numero = q ? (q.quoteNumber ?? q.id) : null;
      return nombrePresupuesto + (numero != null ? ' #' + numero : '');
    }
    if (m.relatedType === 'invoice') {
      const f = (invoices || []).find((x) => x.id === m.relatedId);
      return T.factura + (f && f.number ? ' ' + f.number : '');
    }
    if (m.relatedType === 'charge') return T.cobro;
    return T.sinDocumento;
  },
};
if (typeof window !== 'undefined') window.whatsappCliente = WHATSAPP_CLIENTE;

/**
 * SCRUM-1145 + SCRUM-1044 · LA PESTAÑA «SITIOS»: las piezas sin DOM de la agenda de sitios.
 *
 * El servidor es de SCRUM-1014 (`GET/POST /admin/customers/:id/sites`, `PUT/DELETE …/:siteId`, con
 * tenencia en las cuatro). La lista se pide AL ABRIR la pestaña, no al pintar la ficha: abrir la
 * ficha no hace ninguna petición más que antes.
 *
 * Los textos llevan su firma en SU línea (registro en
 * `docs/microcopy/2026-10-23-SCRUM-1145-sitios-del-cliente.md`). «Cómo llegar» es el de SCRUM-1004,
 * y «Dirección fiscal» el rótulo de la primera fila (SCRUM-1044).
 *
 * 🔴 La primera fila es la dirección FISCAL, de sólo lectura: se compone al pintar con los
 * `billing*` del cliente, que se siguen editando donde siempre. No es un `CustomerSite`.
 *
 * Borrar un sitio CONSERVA lo que ya lo usaba (c.20592, decisión de c.16245), y sin preguntar:
 * ningún modelo apunta a `CustomerSite` y el selector de SCRUM-1144 copia la dirección como texto
 * en el documento, así que el borrado no alcanza a nada guardado.
 */
const SITIOS_CLIENTE = {
  TEXTOS: {
    pestana: 'Sitios', // APROBADO por el fundador el 23-oct-2026 (SCRUM-1145 comentario 20592)
    nuevo: '+ Nuevo sitio', // APROBADO por el fundador el 23-oct-2026 (SCRUM-1145 comentario 20592)
    vacio: 'Todavía no hay sitios guardados para este cliente.', // APROBADO por el fundador el 23-oct-2026 (SCRUM-1145 comentario 20592)
    fiscal: 'Dirección fiscal', // APROBADO por el fundador el 23-oct-2026 (SCRUM-1145 comentario 20592)
    comoLlegar: 'Cómo llegar', // APROBADO por el orquestador por delegación del fundador el 22-sep-2026 (SCRUM-1004 comentario 16402)
    ejemploNombre: 'Piso 3ºB / Nave del polígono', // APROBADO por el fundador el 23-oct-2026 (SCRUM-1145 comentario 20598)
    CAMPOS: {
      name: 'Nombre del sitio', // APROBADO por el fundador el 23-oct-2026 (SCRUM-1145 comentario 20592)
      address: 'Dirección', // APROBADO por el fundador el 23-oct-2026 (SCRUM-1145 comentario 20592)
      city: 'Ciudad', // APROBADO por el fundador el 23-oct-2026 (SCRUM-1145 comentario 20592)
      postalCode: 'Código postal', // APROBADO por el fundador el 23-oct-2026 (SCRUM-1145 comentario 20592)
      province: 'Provincia', // APROBADO por el fundador el 23-oct-2026 (SCRUM-1145 comentario 20592)
      country: 'País', // APROBADO por el fundador el 23-oct-2026 (SCRUM-1145 comentario 20592)
      contactName: 'Contacto en el sitio', // APROBADO por el fundador el 23-oct-2026 (SCRUM-1145 comentario 20592)
      phone: 'Teléfono del contacto', // APROBADO por el fundador el 23-oct-2026 (SCRUM-1145 comentario 20592)
    },
    editar: 'Editar', // APROBADO por el fundador el 23-oct-2026 (SCRUM-1145 comentario 20598)
    eliminar: '🗑 Eliminar', // APROBADO por el fundador el 23-oct-2026 (SCRUM-1145 comentario 20598)
    guardar: 'Guardar', // APROBADO por el fundador el 23-oct-2026 (SCRUM-1145 comentario 20598)
    cancelar: 'Cancelar', // APROBADO por el fundador el 23-oct-2026 (SCRUM-1145 comentario 20598)
    errorCarga: 'No se pudieron cargar los sitios guardados. Inténtalo de nuevo.', // APROBADO por el fundador el 23-oct-2026 (SCRUM-1145 comentario 20598)
    generico: 'No se ha podido completar la acción. Vuelve a intentarlo.', // APROBADO por el fundador el 23-oct-2026 (SCRUM-1145 comentario 20598)
  },
  /** El orden del formulario. `name` es el único obligatorio (como en `customerSiteCreateSchema`). */
  ORDEN: ['name', 'address', 'city', 'postalCode', 'province', 'country', 'contactName', 'phone'],
  /** La dirección en una línea, con la composición del selector de SCRUM-1144: no hay dos. */
  direccion(s) {
    return window.sitiosGuardados.componerDireccionSitio(s);
  },
  /** La fila fiscal, o `null` si el cliente no tiene ninguno de los cinco `billing*`. */
  direccionFiscal(customer) {
    const c = customer || {};
    return SITIOS_CLIENTE.direccion({
      address: c.billingAddress, postalCode: c.billingPostalCode, city: c.billingCity,
      province: c.billingProvince, country: c.billingCountry,
    });
  },
  /** El «Cómo llegar» de un sitio: el mismo `hrefAbrirEnMapa` de la fiscal. Sin dirección, nada. */
  hrefComoLlegar(direccion) {
    return direccion ? window.hrefAbrirEnMapa(direccion) : null;
  },
  /**
   * Lo que viaja al servidor desde el formulario. «Ausente ≠ vacío»: un campo en blanco va `null`
   * (así se BORRA al editar), nunca `""`. El nombre, recortado.
   */
  cuerpo(valores) {
    const v = valores || {};
    const out = {};
    SITIOS_CLIENTE.ORDEN.forEach((k) => {
      const t = String(v[k] === null || v[k] === undefined ? '' : v[k]).trim();
      out[k] = k === 'name' ? t : (t === '' ? null : t);
    });
    return out;
  },
};
if (typeof window !== 'undefined') window.sitiosCliente = SITIOS_CLIENTE;

/**
 * SCRUM-1126 · FUSIONAR DOS CLIENTES DUPLICADOS: las piezas sin DOM del flujo de la ficha.
 *
 * `GET /admin/customers/:id/fusion-preview` y `POST /admin/customers/:id/fusionar` (SCRUM-1057)
 * estaban construidos y no los llamaba nadie. `:id` es el cliente de ESTA ficha, el que se queda;
 * `con` es el elegido, el que desaparece. Operación destructiva: GO del fundador para la UI en
 * SCRUM-1126, comentario 17572 (registro en `docs/master/SCRUM-1126.md`).
 *
 * ✅ TEXTOS FIRMADOS por el orquestador por delegación del fundador (29-sep-2026, SCRUM-1126
 * comentarios 17574 y 17575, que corrige al anterior; registro en `docs/microcopy/2026-09-29-SCRUM-1126-fusion-de-clientes.md`).
 * Tres se REUSAN byte a byte de donde ya estaban firmados, y un test los ancla contra su origen:
 * `generico` (`patronDetalleAcciones.js`, SCRUM-1124), `sinResultados` (`buscadorDeClientes.js`)
 * y `cancelar`.
 *
 * ⛔ El `error` que devuelve el servidor en el 409 NO se pinta: se traduce por `motivo()`, y un
 * código que no esté en la tabla cae en el genérico (regla 39, el aviso de SCRUM-1135).
 */
const FUSION_CLIENTE = {
  TEXTOS: {
    boton: 'Fusionar con otro cliente',
    selector: '¿Con qué cliente lo fusionas?',
    placeholder: 'Busca por nombre o NIF',
    tituloPrevia: 'Revisa la fusión antes de confirmar',
    sinEtiquetas: 'Sin etiquetas',
    confirmar: 'Fusionar',
    cancelar: 'Cancelar',
    exito: 'Clientes fusionados',
    sinResultados: 'Sin resultados para tu búsqueda',
    generico: 'No se ha podido completar la acción. Vuelve a intentarlo.',
    MOTIVOS: {
      factura_emitida: 'No se puede fusionar: uno de los dos tiene una factura emitida, y una factura emitida no se modifica.',
      mismo_cliente: 'Elige un cliente distinto.',
      cliente_no_encontrado: 'Uno de los clientes ya no existe. Recarga la lista.',
    },
  },
  seQueda(principal) { return 'Se queda: ' + principal + ' (sus datos no cambian)'; },
  desaparece(fusionado) { return 'Desaparece: ' + fusionado; },
  /**
   * 🔴 Lo que se MUEVE va entero y sin número: la fusión reasigna más tablas de las que el servidor
   * cuenta, y una lista de tres en una acción irreversible se leería como «eso es todo».
   */
  todoPasa(fusionado, principal) {
    return 'Todo lo de ' + fusionado + ' pasa a ' + principal
      + ': presupuestos, solicitudes de presupuesto, trabajos, direcciones de obra, notas, cobros, partes de trabajo, mensajes de WhatsApp, correos y mantenimientos.';
  },
  /** `desvincularYBorrar` deja sin empresa a quien la tenía en el fusionado: NO se re-enlazan. */
  sinEmpresa(fusionado) { return 'Las personas de contacto de ' + fusionado + ' se quedan sin empresa.'; },
  /**
   * Lo que SÍ cuenta el servidor, rotulado «Contados» para que no se lea como la lista entera.
   * Singular POR ELEMENTO (SCRUM-1126 c.17580): puede haber 1 presupuesto y 4 trabajos. Con 0, plural.
   */
  contados(presupuestos, trabajos, notas) {
    const uno = (n, singular, plural) => (Number(n) === 1 ? '1 ' + singular : n + ' ' + plural);
    return 'Contados: ' + uno(presupuestos, 'presupuesto', 'presupuestos') + ' · ' + uno(trabajos, 'trabajo', 'trabajos')
      + ' · ' + uno(notas, 'nota', 'notas');
  },
  etiquetas(lista) {
    return Array.isArray(lista) && lista.length ? 'Etiquetas tras fusionar: ' + lista.join(', ') : FUSION_CLIENTE.TEXTOS.sinEtiquetas;
  },
  avisoNif(nifPrincipal, nifFusionado) {
    return 'Ojo: los NIF no coinciden (' + nifPrincipal + ' / ' + nifFusionado + '). Comprueba que es el mismo cliente.';
  },
  confirmacion(fusionado) { return 'Esta acción no se puede deshacer. ' + fusionado + ' dejará de existir.'; },
  /** El texto firmado de un motivo de rechazo; `null` si el código no es uno de los tres. */
  motivo(codigo) {
    return Object.prototype.hasOwnProperty.call(FUSION_CLIENTE.TEXTOS.MOTIVOS, codigo) ? FUSION_CLIENTE.TEXTOS.MOTIVOS[codigo] : null;
  },
  /** Lo que se le enseña a la persona cuando `/fusionar` falla: el motivo firmado o el genérico. */
  textoDelError(err) {
    const propio = err && err.status === 409 ? FUSION_CLIENTE.motivo(err.code) : null;
    return propio || window.mensajeParaPersona(err, FUSION_CLIENTE.TEXTOS.generico);
  },
  /**
   * Los clientes que se ofrecen: todos menos el de la ficha, filtrados por nombre o NIF (lo que
   * promete el placeholder, y nada más) con la comparación de `buscadorDeClientes.js`, y recortados
   * a sus `MAX_COINCIDENCIAS`.
   */
  candidatos(clientes, idActual, consulta) {
    const B = window.buscadorDeClientes;
    const q = B.normalizar(consulta);
    return (Array.isArray(clientes) ? clientes : [])
      .filter((c) => c && Number(c.id) !== Number(idActual))
      .filter((c) => q === '' || B.normalizar(c.name).indexOf(q) >= 0 || B.normalizar(c.taxId).indexOf(q) >= 0)
      .slice(0, B.MAX_COINCIDENCIAS);
  },
};
if (typeof window !== 'undefined') window.fusionCliente = FUSION_CLIENTE;

/**
 * SCRUM-1132 · LA PESTAÑA «NOTAS»: las notas con fecha y autor de `GET /admin/customers/:id/notes`
 * (SCRUM-1036) y el campo para añadir una con `POST` a la misma ruta. SCRUM-1132c (c.20627): es
 * una pestaña y no una tarjeta, y la lista se pide al ABRIRLA, como la de «Sitios».
 *
 * ✅ TEXTOS FIRMADOS por el fundador: los cuatro de SCRUM-1132 c.19617 (registro en
 * `docs/microcopy/2026-10-14-SCRUM-1132-notas-del-cliente.md`) y el respaldo de c.20435
 * (`docs/microcopy/2026-10-23-SCRUM-1132-notas-respaldo.md`). Ni uno más: la fecha y el autor son
 * datos del servidor, y el campo se nombra con el rótulo de la pestaña.
 *
 * 🔴 LA «NOTA FIJA» NO SE PINTA AQUÍ. Es `customer.notes`, que ya va en la cabecera de la ficha, y
 * la forma firmada es la (B): sólo en la cabecera. El servidor la manda al final con `esFija`.
 *
 * Detrás de «No se pudo guardar:» va el motivo del servidor SÓLO si viene en `message`
 * (`mensajeParaPersona`, api.js); sin él, el respaldo. Nunca un código interno ni el «Failed to
 * fetch» del navegador.
 */
const NOTAS_CLIENTE = {
  TEXTOS: {
    titulo: 'Notas',
    vacio: 'Sin notas',
    boton: 'Añadir nota',
    error: 'No se pudo guardar:',
    respaldo: 'No se pudo guardar: inténtalo de nuevo', // APROBADO por el fundador el 23-oct-2026 (SCRUM-1132 comentario 20435)
  },
  /** Las que se pintan: las del servidor, sin la Nota fija. */
  conFecha(notas) { return (Array.isArray(notas) ? notas : []).filter((n) => n && !n.esFija); },
  /** «1 oct 2026, 11:30 · Autor»; sin autor, sólo la fecha. */
  linea(n) {
    const d = new Date(n.fecha);
    const fecha = isNaN(d.getTime()) ? '' : d.toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    return [fecha, n.autor || ''].filter(Boolean).join(' · ');
  },
  /** El error que se le enseña a la persona. */
  textoDelError(err) {
    const motivo = window.mensajeParaPersona(err, '');
    return motivo ? NOTAS_CLIENTE.TEXTOS.error + ' ' + motivo : NOTAS_CLIENTE.TEXTOS.respaldo;
  },
};
if (typeof window !== 'undefined') window.notasCliente = NOTAS_CLIENTE;

/**
 * Monta la pestaña en `card` y la llena. Las dos rutas son `requireRole('admin')`: sólo se llama
 * para admin. `viva()` dice si esta apertura sigue siendo la última: la lista que llega tarde no pinta.
 */
function montarNotasDelCliente(card, customerId, viva = () => true) {
  const T = NOTAS_CLIENTE.TEXTOS;
  card.classList.add('notas-cliente');
  card.dataset.tarjeta = 'notas';
  const lista = document.createElement('ul');
  lista.className = 'notas-cliente-lista';
  const form = document.createElement('div');
  form.className = 'field notas-cliente-form';
  const campo = document.createElement('textarea');
  campo.rows = 2;
  campo.setAttribute('aria-label', T.titulo);
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'btn-secondary';
  boton.textContent = T.boton;
  const error = document.createElement('div');
  error.className = 'alert error';
  error.dataset.errorNota = '';
  error.setAttribute('role', 'alert');
  error.hidden = true;
  form.append(campo, boton, error);
  card.append(lista, form);

  function pintar(notas) {
    lista.textContent = '';
    const visibles = NOTAS_CLIENTE.conFecha(notas);
    if (!visibles.length) {
      const li = document.createElement('li');
      li.className = 'notas-cliente-vacio';
      li.textContent = T.vacio;
      lista.appendChild(li);
      return;
    }
    visibles.forEach((n) => {
      const li = document.createElement('li');
      li.className = 'notas-cliente-nota';
      li.dataset.nota = String(n.id);
      const texto = document.createElement('p');
      texto.className = 'notas-cliente-texto';
      texto.textContent = n.texto;
      const meta = document.createElement('p');
      meta.className = 'notas-cliente-meta';
      meta.textContent = NOTAS_CLIENTE.linea(n);
      li.append(texto, meta);
      lista.appendChild(li);
    });
  }

  async function cargar() {
    const r = await apiRequest(`/admin/customers/${customerId}/notes`);
    if (!viva()) return;
    pintar(r && r.notas);
  }

  boton.addEventListener('click', async () => {
    error.hidden = true;
    error.textContent = '';
    boton.disabled = true;
    try {
      await apiRequest(`/admin/customers/${customerId}/notes`, { method: 'POST', body: JSON.stringify({ texto: campo.value }) });
      campo.value = '';
      await cargar();
    } catch (err) {
      error.textContent = NOTAS_CLIENTE.textoDelError(err);
      error.hidden = false;
    } finally {
      boton.disabled = false;
    }
  });

  // Si la lista no llega, la pestaña se queda sin filas y el resto de la ficha sale igual.
  cargar().catch(() => {});
}

async function renderCustomer360View(container, customerId) {
  container.innerHTML = '';

  const id = Number(customerId || window.appState?.customerId360);
  if (!id) {
    container.innerHTML = '<p style="color:var(--neutral-400);padding:24px">Sin cliente seleccionado.</p>';
    return;
  }

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:20px;max-width:920px';
  container.appendChild(wrap);

  // Back button
  const backBtn = document.createElement('button');
  backBtn.className = 'btn-ghost btn-sm';
  backBtn.style.cssText = 'align-self:flex-start';
  backBtn.innerHTML = '← Volver a Clientes';
  backBtn.onclick = () => window.renderAppView && renderAppView('customers');
  wrap.appendChild(backBtn);

  const alertEl = document.createElement('div');
  alertEl.className = 'alert';
  alertEl.style.display = 'block';
  wrap.appendChild(alertEl);

  function setAlert(type, msg) {
    alertEl.textContent = msg || '';
    alertEl.className = 'alert';
    if (type === 'success') alertEl.classList.add('success');
    if (type === 'error')   alertEl.classList.add('error');
    alertEl.style.display = (msg || type) ? 'block' : 'none';
  }

  alertEl.textContent = 'Cargando…';

  let data;
  // SCRUM-980 · el historial de trabajo, EN PARALELO y a parte: si falla, la ficha sale igual que
  // antes —sin pestaña «Trabajos» ni «Próxima visita»— en vez de caerse entera por él.
  let historial = null;
  // SCRUM-1133 · y los WhatsApp, igual: en paralelo y aparte. La ruta es `requireRole('admin')`,
  // así que a un técnico ni se le pide (sería un 403) ni se le pinta la pestaña.
  let whatsapp = null;
  const pideWhatsapp = window.appUserRole === 'admin';
  try {
    [data, historial, whatsapp] = await Promise.all([
      apiRequest(`/admin/customers/${id}/detail`),
      apiRequest(`/admin/customers/${id}/historial`).catch(() => null),
      pideWhatsapp ? apiRequest(`/admin/customers/${id}/whatsapp`).catch(() => null) : null,
    ]);
  } catch {
    alertEl.textContent = 'Error al cargar el historial del cliente.';
    alertEl.className = 'alert error';
    return;
  }
  alertEl.textContent = '';

  const { customer, quotes, invoices, stats, events } = data;
  const fmt = (n, cur) => fmtMoneyEs(n, cur || currency); // P-A66-3: es-ES compartido
  const currency = invoices[0]?.currency || quotes[0]?.currency || 'EUR';
  const L = window.appLocale || {};

  // ── Header del cliente ─────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'customers-card';
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap';

  // SCRUM-980 · sin próxima visita la clave no viene y la línea NO se pinta: ausente no es cero.
  const proximaVisita = historial && historial.proximaVisita ? HISTORIAL_CLIENTE.fechaProxima(historial.proximaVisita.fecha) : null;
  const initials = (customer.name || 'C').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  // SCRUM-1032 (CRM-02) · teléfono, móvil, WhatsApp y correo con UN TOQUE: enlaces del navegador, no
  // envíos de YaQu. La normalización es la de `contactoDelCliente` (api.js), la misma que la lista.
  // Sin dato válido no hay enlace: el texto se pinta como antes, o nada.
  const contacto = window.contactoDelCliente(customer);
  const enlaceHtml = (e, icono) => `<span>${icono} <a class="contacto-link" href="${escC(e.href)}">${escC(e.texto)}</a></span>`;
  const telefonoHtml = contacto.telefono ? enlaceHtml(contacto.telefono, '📱') : (customer.phone ? `<span>📱 ${escC(customer.phone)}</span>` : '');
  const movilHtml = contacto.movil ? enlaceHtml(contacto.movil, '📱') : '';
  const whatsappHtml = contacto.whatsapp ? `<span><a class="contacto-link" href="${escC(contacto.whatsapp.href)}" target="_blank" rel="noopener">💬 WhatsApp</a></span>` : '';
  const correoHtml = contacto.correo ? enlaceHtml(contacto.correo, '✉️') : (customer.email ? `<span>✉️ ${escC(customer.email)}</span>` : '');
  header.innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;flex:1;min-width:0">
      <div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,var(--green-500),#22d3ee);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;color:var(--green-900);flex-shrink:0">${initials}</div>
      <div>
        <h2 style="margin:0 0 4px;font-size:18px;font-weight:800;color:var(--neutral-900)">${escC(customer.name)}</h2>
        <div style="font-size:13px;color:var(--neutral-500);display:flex;gap:12px;flex-wrap:wrap">
          ${telefonoHtml}
          ${movilHtml}
          ${whatsappHtml}
          ${correoHtml}
          <span style="color:var(--neutral-400)">Cliente desde ${new Date(customer.createdAt).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</span>
        </div>
        ${customer.notes ? `<div style="font-size:12.5px;color:var(--neutral-500);margin-top:6px;font-style:italic">${escC(customer.notes)}</div>` : ''}
        ${proximaVisita ? `<div class="historial-proxima">${escC(HISTORIAL_CLIENTE.TEXTOS.proxima + proximaVisita)}</div>` : ''}
      </div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;flex-shrink:0">
      <button class="btn-secondary btn-sm" id="btn-edit-360" title="Editar los datos del cliente">✎ Editar</button>
      <button class="btn-secondary btn-sm" id="btn-copy-portal-360" title="Copiar enlace del portal del cliente">
        🔗 Portal
      </button>
      <!-- ✅ SCRUM-1003, texto firmado por el orquestador por delegación del fundador (22-sep-2026) -->
      <button class="btn-secondary btn-sm" id="btn-vcard-360" title="Descargar la ficha del cliente como contacto">📇 Guardar en mis contactos</button>
      ${window.appUserRole === 'admin' ? `<button class="btn-secondary btn-sm" id="btn-fusionar-360">${escC(FUSION_CLIENTE.TEXTOS.boton)}</button>` : ''}
      <button class="btn-primary btn-sm" id="btn-new-quote-360">+ ${L.quoteNew || 'Nuevo presupuesto'}</button>
    </div>
  `;
  wrap.appendChild(header);

  // SCRUM-1003 (CRM-03) · descarga el .vcf en el navegador; nada se manda al servidor.
  header.querySelector('#btn-vcard-360').onclick = () => {
    const blob = new Blob([construirVCard(customer)], { type: 'text/vcard;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = nombreDeFicheroVCard(customer);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
  };

  // SCRUM-1126 · las dos rutas son `requireRole('admin')`: a quien no lo es ni se le pinta el botón.
  const btnFusionar = header.querySelector('#btn-fusionar-360');
  if (btnFusionar) btnFusionar.addEventListener('click', () => abrirFusionDeClientes(customer, id, container));

  // ── SCRUM-1033 · chips de la cabecera: NIF/CIF, dirección y referencia interna ──────────────
  // Sólo lo que tenga valor: un cliente sin ninguno de los tres no pinta el bloque.
  // SCRUM-1034 · las etiquetas, en el mismo bloque, editables con el patrón YA existente de
  // `etiquetasDelDocumento.js` (mismos avisos, mismo componente): nada nuevo que decidir aquí, la
  // decisión (qué es una etiqueta válida) sigue en `filtroClientes.js`/`tagsDelCliente.ts`.
  const meta = document.createElement('div');
  meta.className = 'customers-card';
  meta.id = 'c360-meta';
  wrap.appendChild(meta);

  const chipsFila = document.createElement('div');
  chipsFila.id = 'c360-chips';
  chipsFila.className = 'c360-chips';
  meta.appendChild(chipsFila);
  const chipMeta = (etiqueta, valor) => {
    const el = document.createElement('span');
    el.className = 'badge badge-slate';
    el.textContent = etiqueta + ': ' + valor;
    chipsFila.appendChild(el);
  };
  if (customer.taxId) chipMeta('NIF/CIF', customer.taxId);
  // Las 5 columnas de dirección, unidas en una sola línea: sin las que falten (ausente ≠ vacío).
  const direccionTexto = [customer.billingAddress, customer.billingPostalCode, customer.billingCity, customer.billingProvince, customer.billingCountry]
    .filter(Boolean).join(', ');
  if (direccionTexto) {
    chipMeta('Dirección', direccionTexto);
    // ✅ SCRUM-1004, texto firmado por el orquestador por delegación del fundador (22-sep-2026):
    // reuso literal del enlace de `jobRailBlocks.js` (mismo proveedor, sin mapa incrustado).
    const comoLlegar = document.createElement('a');
    comoLlegar.id = 'c360-como-llegar';
    comoLlegar.className = 'contacto-link';
    comoLlegar.target = '_blank';
    comoLlegar.rel = 'noopener';
    comoLlegar.href = hrefAbrirEnMapa(direccionTexto);
    comoLlegar.textContent = 'Cómo llegar';
    chipsFila.appendChild(comoLlegar);
  }
  if (customer.internalRef) chipMeta('Referencia', customer.internalRef);
  if (!chipsFila.children.length) chipsFila.remove();

  // El mismo componente que ya usan presupuesto y factura: chips + campo + guardado automático.
  // `endpoint` es el PUT general del cliente (el mismo que usa la lista), no uno nuevo.
  montarEtiquetasDelDocumento(meta, customer, `/admin/customers/${id}`);
  // ✅ TEXTO FIRMADO por el orquestador por delegación del fundador (21-sep-2026, SCRUM-1034).
  // Sólo aquí: el componente es compartido con presupuesto/factura y no se toca (otro carril).
  const limiteTags = document.createElement('div');
  limiteTags.id = 'c360-tags-limite';
  limiteTags.className = 'c360-tags-limite';
  limiteTags.textContent = 'Máximo 20 etiquetas, de hasta 40 caracteres cada una.';
  meta.appendChild(limiteTags);

  // Editar cliente desde la ficha (antes solo se podía desde la lista)
  header.querySelector('#btn-edit-360').onclick = () => {
    openEdit360Modal(customer, id, container);
  };

  // SCRUM-795 · EL BOTÓN SE PINTA SIEMPRE, Y EL ENLACE SE PIDE AL PULSAR — como en la lista.
  //
  // Antes se pintaba sólo `if (customer.portalUrl)`, y el detalle sirve esa URL EN CRUDO
  // (`customersAdmin.routes.ts`: `customer.portalToken ? url : null`). Sin token el botón NO
  // EXISTÍA: no fallaba el enlace, desaparecía el botón y sin decir nada. Medido en navegador el
  // 6-sep-2026 — y los SIETE clientes del demo estaban en ese caso.
  //
  // 🔴 LA LLAMADA ES DEL CLIC, NO DEL RENDER, y ésa es la decisión entera. `/portal-url` pasa por
  // `ensurePortalToken`, que ESCRIBE. Curar al abrir la ficha convertiría el simple hecho de mirar
  // un cliente en una escritura, disparada sola y sin que nadie pulse nada. La lista ya lo resuelve
  // así desde siempre: esto pone la ficha de acuerdo con ella, no estrena un patrón.
  header.querySelector('#btn-copy-portal-360').onclick = async () => {
    const btn = header.querySelector('#btn-copy-portal-360');
    try {
      const res = await apiRequest(`/admin/customers/${id}/portal-url`);
      await navigator.clipboard.writeText(res.portalUrl).catch(() => {});
      btn.textContent = '¡Copiado!';
      setTimeout(() => { btn.innerHTML = '🔗 Portal'; }, 2000);
    } catch {
      // 🔴 EL LITERAL ES EL DE LA LISTA, BYTE A BYTE — no un recorte. `customersView.js:660` pinta
      // esta misma acción y su literal son 28 bytes que terminan en `: `; aquí van los 28, medidos
      // (mismo sha256). Un recorte —quitarle los dos caracteres finales para que la frase quedara
      // redonda— sería microcopy NUEVO, y la regla 30 no distingue entre inventar una frase y
      // recortar la oficial.
      //
      // ⚠️ LO QUE NO VA, Y CUESTA: la lista sigue con `+ err.message`. Este fichero NO puede
      // (SCRUM-644: techo CERO, y su segundo trinquete impide volver a la tabla del censo
      // heredado). Así que el usuario ve un `: ` sin nada detrás. Es feo y está DECLARADO:
      // se prefiere a estrenar texto por mi cuenta o a asomar `customer_not_found` a la interfaz.
      setAlert('error', 'Error al obtener el portal: ');
    }
  };
  header.querySelector('#btn-new-quote-360').onclick = () => {
    if (window.renderAppView) renderAppView('quotes-new');
  };

  // ── KPIs ────────────────────────────────────────────────────────────────
  const kpiGrid = document.createElement('div');
  kpiGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px';

  // A18.3 (AB4 "deuda/pagos/presupuestos"): la DEUDA es lo primero que se ve
  // SCRUM-1035: la deuda la suma el SERVIDOR sobre todas las facturas del cliente (la lista trae 20).
  const debt = stats.totalPending !== undefined
    ? Number(stats.totalPending)
    : (invoices || [])
      .filter((i) => String(i.status).toLowerCase() === 'pending')
      .reduce((a, i) => a + Number(i.total || 0), 0);

  // SCRUM-1403b: al técnico el servidor no le manda las cifras de dinero (SCRUM-1403 c.20375). Una
  // tarjeta con `cifra` se pinta sólo si esa cifra viene: ausente no es cero, y la deuda calculada aquí
  // sobre SUS facturas diría otra cosa bajo el mismo rótulo. No se añade texto: se quita la tarjeta.
  const kpis = [
    { cifra: 'totalPending', label: 'Pendiente de cobro', value: fmt(debt),
      // SCRUM-1108b: con garantía retenida sin cobrar, «al día ✓» es falso. No se añade texto: se quita.
      sub: debt > 0 ? `${stats.pendingCount ?? invoices.filter(i=>String(i.status).toLowerCase()==='pending').length} sin cobrar` : (stats.garantiaRetenida ? '' : 'al día ✓'),
      color: debt > 0 ? 'var(--red-600)' : 'var(--green-600)' },
    { label: `${L.quotePlural || 'Presupuestos'}`, value: stats.totalQuotes, sub: `${stats.acceptedQuotes} aceptados` },
    { label: 'Facturas',  value: invoices.length, sub: `${invoices.filter(i=>i.status==='paid').length} pagadas` },
    { cifra: 'totalBilled', label: 'Facturado', value: fmt(stats.totalBilled), sub: '' },
    { cifra: 'totalPaid', label: 'Cobrado',   value: fmt(stats.totalPaid), sub: '', color: 'var(--green-600)' },
    { cifra: 'profit', label: 'Beneficio', value: fmt(stats.profit), sub: '', color: stats.profit >= 0 ? 'var(--green-600)' : 'var(--red-600)' },
  ].filter((k) => !k.cifra || stats[k.cifra] !== undefined);

  kpis.forEach(({ label, value, sub, color }) => {
    const k = document.createElement('div');
    k.className = 'kpi-card';
    k.innerHTML = `
      <div class="kpi-label">${label}</div>
      <div class="kpi-value" style="font-size:18px${color ? ';color:' + color : ''}">${value}</div>
      ${sub ? `<div class="kpi-sub">${sub}</div>` : ''}
    `;
    kpiGrid.appendChild(k);
  });
  wrap.appendChild(kpiGrid);

  // SCRUM-1108b: una línea POR RETENCIÓN (con dos fechas, «total · desde la más temprana» diría que
  // todo se libera ya). `liberacionDia` es el día en la zona del merchant: lo resuelve el servidor.
  // `.alert warning` si la fecha ya llegó, `.alert info` si no. Literal firmado (docs/microcopy/).
  (stats.garantiaRetenida?.retenciones || []).forEach((r) => {
    const [y, m, d] = String(r.liberacionDia).split('-');
    const linea = document.createElement('div');
    linea.className = r.aviso ? 'alert warning' : 'alert info';
    linea.textContent = `Garantía retenida: ${fmt(r.importe)} · liberación desde el ${d}/${m}/${y} · sin cobrar`;
    wrap.appendChild(linea);
  });

  // ── Actividad / historial de comunicaciones (ENT-3) ───────────────────
  if (Array.isArray(events) && events.length) {
    const actCard = document.createElement('div');
    actCard.className = 'customers-card';
    actCard.innerHTML = '<h3 style="margin:0 0 14px;font-size:13px;font-weight:700;color:var(--neutral-600);text-transform:uppercase;letter-spacing:.04em">Actividad reciente</h3>';

    const EV_ICON = {
      quote_sent: '📤', quote_accepted: '✅', quote_rejected: '✖',
      invoice_issued: '🧾', payment_received: '💰', quote_requested: '✏️',
      reminder_sent: '🔔', review_requested: '⭐',
    };
    const EV_COLOR = {
      quote_accepted: 'var(--green-600)', payment_received: 'var(--green-600)',
      quote_rejected: 'var(--red-600)',
    };

    const list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:0';
    events.forEach((ev, i) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:12px;align-items:flex-start;padding:10px 0' +
        (i < events.length - 1 ? ';border-bottom:1px solid var(--neutral-100)' : '');
      const when = new Date(ev.createdAt).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      row.innerHTML = `
        <div style="flex-shrink:0;width:30px;height:30px;border-radius:50%;background:var(--neutral-50);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:14px">${EV_ICON[ev.type] || '•'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13.5px;font-weight:600;color:${EV_COLOR[ev.type] || 'var(--ink)'}">${escC(ev.title)}</div>
          ${ev.detail ? `<div style="font-size:12.5px;color:var(--muted);margin-top:1px">${escC(ev.detail)}</div>` : ''}
        </div>
        <div style="flex-shrink:0;font-size:11.5px;color:var(--muted);white-space:nowrap">${escC(when)}</div>
      `;
      list.appendChild(row);
    });
    actCard.appendChild(list);
    wrap.appendChild(actCard);
  }

  // ── Tabs: Presupuestos / Facturas ─────────────────────────────────────
  const tabsWrap = document.createElement('div');
  tabsWrap.className = 'c360-pestanas';
  tabsWrap.style.cssText = 'display:flex;gap:4px;border-bottom:2px solid var(--neutral-200);margin-bottom:-2px';

  const tabContent = document.createElement('div');

  function makeTab(label, key) {
    const btn = document.createElement('button');
    btn.style.cssText = 'background:none;border:none;padding:10px 16px;font-size:13.5px;font-weight:600;color:var(--neutral-400);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;font-family:inherit';
    btn.textContent = label;
    btn.dataset.key = key;
    btn.addEventListener('click', () => {
      tabsWrap.querySelectorAll('button').forEach(b => {
        b.style.color = 'var(--neutral-400)';
        b.style.borderBottomColor = 'transparent';
      });
      btn.style.color = 'var(--green-600)';
      btn.style.borderBottomColor = 'var(--green-500)';
      renderTab(key);
    });
    return btn;
  }

  const tabQuotes   = makeTab(`${L.quotePlural || 'Presupuestos'} (${quotes.length})`,   'quotes');
  const tabInvoices = makeTab(`Facturas (${invoices.length})`, 'invoices');
  tabsWrap.appendChild(tabQuotes);
  tabsWrap.appendChild(tabInvoices);
  // SCRUM-980 · la tercera, con el MISMO mecanismo que las otras dos. Solo si el historial llegó.
  const trabajos = historial && Array.isArray(historial.trabajos) ? historial.trabajos.slice() : null;
  let siguiente = historial ? historial.siguiente ?? null : null;
  const tabJobs = trabajos
    ? makeTab(HISTORIAL_CLIENTE.tituloPestana(trabajos.length, !!siguiente), 'jobs')
    : null;
  if (tabJobs) tabsWrap.appendChild(tabJobs);
  // SCRUM-1133 · la cuarta, con el mismo mecanismo. Solo si la respuesta llegó.
  const mensajesWa = whatsapp && Array.isArray(whatsapp.mensajes) ? whatsapp.mensajes.slice() : null;
  let siguienteWa = whatsapp ? whatsapp.siguiente ?? null : null;
  const tabWhatsapp = mensajesWa
    ? makeTab(WHATSAPP_CLIENTE.tituloPestana(mensajesWa.length, !!siguienteWa), 'whatsapp')
    : null;
  if (tabWhatsapp) tabsWrap.appendChild(tabWhatsapp);
  // SCRUM-1145 · la quinta, sin número: su lista se pide al abrirla, no antes.
  const tabSitios = makeTab(SITIOS_CLIENTE.TEXTOS.pestana, 'sitios');
  tabsWrap.appendChild(tabSitios);
  // SCRUM-1132c · la sexta, igual que «Sitios»: sin número, y sus notas se piden al abrirla.
  // Rutas `requireRole('admin')`: al técnico ni se le pinta la pestaña ni se le piden.
  if (window.appUserRole === 'admin') tabsWrap.appendChild(makeTab(NOTAS_CLIENTE.TEXTOS.titulo, 'notas'));
  wrap.appendChild(tabsWrap);
  wrap.appendChild(tabContent);

  const STATUS_LABELS = { draft:'Borrador', sent:'Enviado', accepted:'Aceptado', rejected:'Rechazado', pending:'Pendiente', paid:'Pagada', expired:'Caducada', pending_approval:'Pend. aprob.' };
  const STATUS_CLASS  = { accepted:'status-pill-accepted', paid:'status-pill-accepted', sent:'status-pill-pending', pending:'status-pill-pending', rejected:'status-pill-rejected', expired:'status-pill-draft', draft:'status-pill-draft', pending_approval:'status-pill-approval' };

  // Numera cada apertura de «Notas», como `peticionSitios`.
  let peticionNotas = 0;
  function renderTab(key) {
    tabContent.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'data-card';
    tabContent.appendChild(card);
    if (key === 'sitios') { pintarSitios(card); return; }
    if (key === 'notas') {
      const esta = ++peticionNotas;
      montarNotasDelCliente(card, id, () => esta === peticionNotas);
      return;
    }

    const scroll = document.createElement('div');
    scroll.className = 'table-scroll';
    card.appendChild(scroll);

    const table = document.createElement('table');
    table.className = 'table';
    scroll.appendChild(table);

    if (key === 'quotes') {
      table.innerHTML = `<thead><tr><th>ID</th><th>Fecha</th><th>Total</th><th>Estado</th><th></th></tr></thead>`;
      const tbody = document.createElement('tbody');
      if (quotes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--neutral-400);padding:24px">Sin ${L.quotePlural||'presupuestos'}</td></tr>`;
      }
      quotes.forEach(q => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-weight:600">#${q.quoteNumber ?? q.id}</td>
          <td style="color:var(--muted)">${new Date(q.createdAt).toLocaleDateString('es-ES')}</td>
          <td class="amount">${fmt(Number(q.total), q.currency)}</td>
          <td><span class="status-pill ${STATUS_CLASS[q.status]||'status-pill-draft'}">${STATUS_LABELS[q.status]||q.status}</span></td>
          <td><button class="btn-ghost btn-sm">Ver →</button></td>
        `;
        tr.querySelector('button').onclick = () => {
          if (window.renderAppView) {
            window.appState.quoteId = q.id;
            renderAppView('quotes-detail');
          }
        };
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
    } else if (key === 'jobs') {
      pintarTrabajos(card, table);
    } else if (key === 'whatsapp') {
      pintarWhatsapp(card, table);
    } else {
      table.innerHTML = `<thead><tr><th>Nº</th><th>Fecha</th><th>Total</th><th>Estado</th><th></th></tr></thead>`;
      const tbody = document.createElement('tbody');
      if (invoices.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--neutral-400);padding:24px">Sin facturas</td></tr>`;
      }
      invoices.forEach(inv => {
        const tr = document.createElement('tr');
        const pdfCell = inv.pdfUrl && inv.pdfUrl !== 'PENDING_PDF'
          ? `<a href="${inv.pdfUrl}" target="_blank" class="btn-ghost btn-sm" style="text-decoration:none">PDF</a>`
          : '';
        tr.innerHTML = `
          <td style="font-weight:600">${escC(inv.number)}</td>
          <td style="color:var(--muted)">${new Date(inv.createdAt).toLocaleDateString('es-ES')}</td>
          <td class="amount">${fmt(Number(inv.total), inv.currency)}</td>
          <td><span class="status-pill ${STATUS_CLASS[inv.status]||'status-pill-draft'}">${STATUS_LABELS[inv.status]||inv.status}</span></td>
          <td>
            <div style="display:flex;gap:6px;align-items:center">
              ${pdfCell}
              <button class="btn-ghost btn-sm" data-iid="${inv.id}">Ver →</button>
            </div>
          </td>
        `;
        tr.querySelector(`[data-iid="${inv.id}"]`).onclick = () => {
          if (window.renderAppView) {
            window.appState.invoiceId = inv.id;
            renderAppView('invoice-detail');
          }
        };
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
    }
  }

  // ── SCRUM-980 · LA PESTAÑA «TRABAJOS» ─────────────────────────────────────────────────
  // Fecha · trabajo · estado · documentos. El estado sale de `jobStatusMeta` (api.js), la MISMA
  // etiqueta y pastilla que el resto del panel: aquí no se escribe ni un rótulo de estado.
  // Todo con `textContent`: el título y los números los escribe el profesional.
  function abrir(vista, clave, valor) {
    if (!window.renderAppView) return;
    window.appState[clave] = valor;
    renderAppView(vista);
  }
  function enlace(texto, alPulsar) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn-ghost btn-sm';
    b.textContent = texto;
    b.addEventListener('click', (e) => { e.stopPropagation(); alPulsar(); });
    return b;
  }

  // SCRUM-1133 · la pestaña «WhatsApp»: fecha, documento y el chip de estado de WA-0b.
  function pintarWhatsapp(card, table) {
    const T = WHATSAPP_CLIENTE.TEXTOS;
    // 🔴 `waOptOut` llega en la respuesta y NO se pinta. La línea firmada («… no se le envían
    // mensajes») afirma que la baja corta TODOS los envíos, y medido es falso: `isWaOptedOut` sólo
    // se consulta en 2 de los 8 envíos y falla abierto. Va a SCRUM-1262; no se publica hasta que sea verdad.
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    T.columnas.forEach((c) => { const th = document.createElement('th'); th.textContent = c; trh.appendChild(th); });
    thead.appendChild(trh);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);

    if (mensajesWa.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = T.columnas.length;
      td.className = 'historial-vacio';
      td.textContent = T.vacio;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    mensajesWa.forEach((m) => {
      const tr = document.createElement('tr');
      tr.dataset.mensaje = String(m.id);
      const tdFecha = document.createElement('td');
      tdFecha.className = 'historial-fecha';
      tdFecha.textContent = m.createdAt ? new Date(m.createdAt).toLocaleDateString('es-ES') : '';
      tr.appendChild(tdFecha);
      const tdDoc = document.createElement('td');
      tdDoc.textContent = WHATSAPP_CLIENTE.documento(m, quotes, invoices, L.quote || 'Presupuesto');
      tr.appendChild(tdDoc);
      const tdEstado = document.createElement('td');
      // El chip ya lleva su fecha en la columna de al lado: `sinFecha`, como en la lista (SCRUM-986).
      tdEstado.innerHTML = window.waDeliveryChip ? window.waDeliveryChip({ status: m.status, templateName: m.templateName }, { sinFecha: true }) : '';
      tr.appendChild(tdEstado);
      tbody.appendChild(tr);
    });

    if (siguienteWa) {
      const mas = document.createElement('button');
      mas.type = 'button';
      mas.className = 'btn-secondary btn-sm historial-ver-mas';
      mas.textContent = T.verMas;
      mas.addEventListener('click', async () => {
        mas.disabled = true;
        try {
          const r = await apiRequest(`/admin/customers/${id}/whatsapp?despuesDe=${encodeURIComponent(siguienteWa)}`);
          (r.mensajes || []).forEach((x) => mensajesWa.push(x));
          siguienteWa = r.siguiente ?? null;
          tabWhatsapp.textContent = WHATSAPP_CLIENTE.tituloPestana(mensajesWa.length, !!siguienteWa);
          renderTab('whatsapp');
        } catch {
          mas.disabled = false; // se puede reintentar: la página que ya estaba sigue en pantalla
        }
      });
      card.appendChild(mas);
    }
  }

  function pintarTrabajos(card, table) {
    const T = HISTORIAL_CLIENTE.TEXTOS;
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    T.columnas.forEach((c) => { const th = document.createElement('th'); th.textContent = c; trh.appendChild(th); });
    thead.appendChild(trh);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);

    if (trabajos.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = T.columnas.length;
      td.className = 'historial-vacio';
      td.textContent = T.vacio;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    trabajos.forEach((t) => {
      const tr = document.createElement('tr');
      tr.dataset.trabajo = String(t.id);
      const tdFecha = document.createElement('td');
      tdFecha.className = 'historial-fecha';
      const f = HISTORIAL_CLIENTE.fechaDeTrabajo(t);
      tdFecha.textContent = f ? new Date(f).toLocaleDateString('es-ES') : '';
      tr.appendChild(tdFecha);

      const tdTitulo = document.createElement('td');
      const bTitulo = enlace(t.titulo, () => abrir('jobs-detail', 'jobId', t.id));
      bTitulo.className = 'btn-ghost btn-sm cell-title';
      tdTitulo.appendChild(bTitulo);
      tr.appendChild(tdTitulo);

      const tdEstado = document.createElement('td');
      const meta = jobStatusMeta(t.estado);
      const pill = document.createElement('span');
      pill.className = 'status-pill ' + meta.pillClass;
      pill.textContent = meta.label;
      tdEstado.appendChild(pill);
      tr.appendChild(tdEstado);

      const tdDocs = document.createElement('td');
      const docs = document.createElement('div');
      docs.className = 'historial-docs';
      (t.partes || []).forEach((p) => docs.appendChild(enlace(p.numero, () => abrir('parte-detail', 'parteId', p.id))));
      (t.albaranes || []).forEach((a) => {
        const b = enlace(a.numero, () => abrir('albaran-detail', 'albaranId', a.id));
        if (a.fotos > 0) {
          const fotos = document.createElement('span');
          fotos.className = 'historial-fotos';
          fotos.textContent = ' 📷 ' + a.fotos;
          fotos.setAttribute('aria-label', HISTORIAL_CLIENTE.ariaFotos(a.fotos));
          b.appendChild(fotos);
        }
        docs.appendChild(b);
      });
      tdDocs.appendChild(docs);

      // ── SCRUM-1061 (CRM-18) · miniaturas de las fotos del trabajo (hasta 3, tope de SCRUM-1060) ──
      // Ausente ≠ vacío: `t.fotos` solo viaja si el trabajo tiene alguna. Reutiliza
      // `GET /admin/attachments/:id` (ya sirve el binario con su propio check de merchantId): sin
      // ruta nueva, sin tocar el almacenamiento.
      if (t.fotos && t.fotos.ids && t.fotos.ids.length) {
        const galeria = document.createElement('div');
        galeria.className = 'historial-fotos-mini';
        t.fotos.ids.forEach((fotoId) => {
          const enlaceFoto = document.createElement('a');
          enlaceFoto.href = `/admin/attachments/${fotoId}`;
          enlaceFoto.target = '_blank';
          enlaceFoto.rel = 'noopener';
          enlaceFoto.className = 'historial-foto-mini';
          const img = document.createElement('img');
          img.src = `/admin/attachments/${fotoId}`;
          // ✅ TEXTO FIRMADO por el orquestador por delegación del fundador (22-sep-2026, SCRUM-1061).
          img.alt = 'Foto del trabajo';
          img.loading = 'lazy';
          // Una foto que falla al cargar no rompe la ficha: se retira en vez de enseñar el icono roto.
          img.onerror = () => { img.hidden = true; };
          enlaceFoto.appendChild(img);
          galeria.appendChild(enlaceFoto);
        });
        const restantes = t.fotos.total - t.fotos.ids.length;
        if (restantes > 0) {
          const mas = document.createElement('span');
          mas.className = 'historial-fotos-mas';
          mas.textContent = '+' + restantes + ' más'; // ✅ FIRMADO, SCRUM-1061
          mas.setAttribute('aria-label', restantes + ' fotos más'); // ✅ FIRMADO, SCRUM-1061
          galeria.appendChild(mas);
        }
        tdDocs.appendChild(galeria);
      }

      tr.appendChild(tdDocs);
      tbody.appendChild(tr);
    });

    if (siguiente) {
      const mas = document.createElement('button');
      mas.type = 'button';
      mas.className = 'btn-secondary btn-sm historial-ver-mas';
      mas.textContent = T.verMas;
      mas.addEventListener('click', async () => {
        mas.disabled = true;
        try {
          const r = await apiRequest(`/admin/customers/${id}/historial?despuesDe=${encodeURIComponent(siguiente)}`);
          (r.trabajos || []).forEach((x) => trabajos.push(x));
          siguiente = r.siguiente ?? null;
          tabJobs.textContent = HISTORIAL_CLIENTE.tituloPestana(trabajos.length, !!siguiente);
          renderTab('jobs');
        } catch {
          mas.disabled = false; // se puede reintentar: la página que ya estaba sigue en pantalla
        }
      });
      card.appendChild(mas);
    }

    // Los partes sin trabajo (el servidor solo los manda a quien puede verlos).
    const sueltos = historial.partesSueltos || [];
    if (sueltos.length) {
      const h = document.createElement('h3');
      h.className = 'historial-sueltos';
      h.textContent = T.sueltos;
      card.appendChild(h);
      const lista = document.createElement('div');
      lista.className = 'historial-sueltos-lista';
      sueltos.forEach((p) => lista.appendChild(enlace(p.numero, () => abrir('parte-detail', 'parteId', p.id))));
      card.appendChild(lista);
    }
  }

  // ── SCRUM-1145 + SCRUM-1044 · LA PESTAÑA «SITIOS» ─────────────────────────────────────
  // Primero la fiscal (sólo lectura), luego los sitios guardados, con su alta, edición y borrado.
  // Todo con `textContent`: nombres y direcciones los escribe el profesional.
  // Numera cada apertura: si se vuelve a abrir la pestaña mientras llega la lista, la que llega
  // tarde no pinta (si se cambia a otra, pinta en una tarjeta que ya no está en pantalla).
  let peticionSitios = 0;
  function pintarSitios(card) {
    const T = SITIOS_CLIENTE.TEXTOS;
    const esta = ++peticionSitios;
    const viva = () => esta === peticionSitios;
    card.classList.add('sitios-cliente');

    const nuevo = document.createElement('button');
    nuevo.type = 'button';
    nuevo.id = 'c360-sitio-nuevo';
    nuevo.className = 'btn btn-secondary sitios-cliente__nuevo';
    nuevo.textContent = T.nuevo;
    card.appendChild(nuevo);

    const hueco = document.createElement('div');
    card.appendChild(hueco);

    const aviso = document.createElement('p');
    aviso.className = 'sitios-cliente__error';
    aviso.setAttribute('role', 'alert');
    aviso.hidden = true;
    card.appendChild(aviso);
    function avisar(texto) { aviso.textContent = texto || ''; aviso.hidden = !texto; }

    const lista = document.createElement('ul');
    lista.className = 'sitios-cliente__lista';
    card.appendChild(lista);

    function comoLlegar(direccion) {
      const href = SITIOS_CLIENTE.hrefComoLlegar(direccion);
      if (!href) return null;
      const a = document.createElement('a');
      a.className = 'contacto-link sitios-cliente__llegar';
      a.target = '_blank';
      a.rel = 'noopener';
      a.href = href;
      a.textContent = T.comoLlegar;
      return a;
    }
    function linea(clase, texto) {
      const d = document.createElement('div');
      d.className = clase;
      d.textContent = texto;
      return d;
    }
    function fila(titulo, direccion) {
      const li = document.createElement('li');
      li.className = 'sitios-cliente__fila';
      li.appendChild(linea('sitios-cliente__nombre', titulo));
      if (direccion) li.appendChild(linea('sitios-cliente__direccion', direccion));
      return li;
    }

    // La fiscal no depende de la petición: un cliente sin sitios la ve igual (SCRUM-1044).
    const fiscal = SITIOS_CLIENTE.direccionFiscal(customer);
    const filaFiscal = fiscal ? fila(T.fiscal, fiscal) : null;
    if (filaFiscal) {
      filaFiscal.classList.add('sitios-cliente__fila--fiscal');
      filaFiscal.dataset.sitio = 'fiscal';
      const acciones = document.createElement('div');
      acciones.className = 'sitios-cliente__acciones';
      acciones.appendChild(comoLlegar(fiscal));
      filaFiscal.appendChild(acciones);
    }

    function pintarLista(sitios) {
      lista.replaceChildren();
      if (filaFiscal) lista.appendChild(filaFiscal);
      if (!sitios.length) {
        const li = document.createElement('li');
        li.className = 'sitios-cliente__vacio';
        li.textContent = T.vacio;
        lista.appendChild(li);
        return;
      }
      sitios.forEach((s) => {
        const direccion = SITIOS_CLIENTE.direccion(s);
        const li = fila(s.name, direccion);
        li.dataset.sitio = String(s.id);
        const contacto = [s.contactName, s.phone].filter((x) => x && String(x).trim()).join(' · ');
        if (contacto) li.appendChild(linea('sitios-cliente__contacto', contacto));
        const acciones = document.createElement('div');
        acciones.className = 'sitios-cliente__acciones';
        const llegar = comoLlegar(direccion);
        if (llegar) acciones.appendChild(llegar);
        const editar = document.createElement('button');
        editar.type = 'button';
        editar.className = 'btn-ghost btn-sm';
        editar.dataset.accion = 'editar';
        editar.textContent = T.editar;
        editar.addEventListener('click', () => abrirFormulario(s));
        acciones.appendChild(editar);
        // Borrar NO es la acción principal (sin confirmación, c.20592): botón fantasma, al final.
        const eliminar = document.createElement('button');
        eliminar.type = 'button';
        eliminar.className = 'btn-ghost btn-sm';
        eliminar.dataset.accion = 'eliminar';
        eliminar.textContent = T.eliminar;
        eliminar.addEventListener('click', () => borrar(s, eliminar));
        acciones.appendChild(eliminar);
        li.appendChild(acciones);
        lista.appendChild(li);
      });
    }

    function cargar() {
      avisar('');
      return apiRequest(`/admin/customers/${id}/sites`).then((r) => {
        if (!viva()) return;
        pintarLista(r && Array.isArray(r.sitios) ? r.sitios : []);
      }, (err) => {
        if (!viva()) return;
        if (filaFiscal) lista.replaceChildren(filaFiscal);
        // `handled` = la prueba vencida: `_pedir` ya ha llevado al profesional a Planes.
        if (err && err.handled) return;
        avisar(window.mensajeParaPersona(err, T.errorCarga));
      });
    }

    function borrar(s, boton) {
      boton.disabled = true;
      avisar('');
      apiRequest(`/admin/customers/${id}/sites/${s.id}`, { method: 'DELETE' }).then(() => {
        if (viva()) cargar();
      }, (err) => {
        if (!viva()) return;
        boton.disabled = false;
        if (err && err.handled) return;
        avisar(window.mensajeParaPersona(err, T.generico));
      });
    }

    /** Alta (`sitio` nulo) o edición: UN formulario a la vez, encima de la lista. */
    function abrirFormulario(sitio) {
      avisar('');
      const form = document.createElement('form');
      form.className = 'sitios-cliente__form';
      const campos = {};
      SITIOS_CLIENTE.ORDEN.forEach((k) => {
        const caja = document.createElement('div');
        caja.className = 'field';
        const label = document.createElement('label');
        label.htmlFor = 'c360-sitio-' + k;
        label.textContent = T.CAMPOS[k];
        caja.appendChild(label);
        let input;
        if (k === 'country') {
          // El mismo selector de país que la ficha del cliente (`prefijosPais.js`, SCRUM-578): el
          // servidor guarda el ISO de dos letras y el nombre lo pone el navegador.
          input = document.createElement('select');
          const vacia = document.createElement('option');
          vacia.value = '';
          vacia.textContent = '—';
          input.appendChild(vacia);
          window.prefijosPais.listaDePrefijos().forEach((p) => {
            const o = document.createElement('option');
            o.value = p.iso;
            o.textContent = p.nombre;
            input.appendChild(o);
          });
        } else {
          input = document.createElement('input');
          input.type = k === 'phone' ? 'tel' : 'text';
          // Los topes de `customerSiteCreateSchema`: el servidor contestaría 400 a uno más largo.
          input.maxLength = { name: 200, address: 200, city: 100, postalCode: 20, province: 100, contactName: 200, phone: 30 }[k];
        }
        if (k === 'name') {
          input.required = true;
          input.placeholder = T.ejemploNombre;
        }
        input.id = 'c360-sitio-' + k;
        input.name = k;
        input.className = 'input';
        input.value = sitio && sitio[k] != null ? String(sitio[k]) : '';
        caja.appendChild(input);
        campos[k] = input;
        form.appendChild(caja);
      });
      const errorForm = document.createElement('p');
      errorForm.className = 'sitios-cliente__error';
      errorForm.setAttribute('role', 'alert');
      errorForm.hidden = true;
      form.appendChild(errorForm);

      const pie = document.createElement('div');
      pie.className = 'sitios-cliente__pie';
      const cancelar = document.createElement('button');
      cancelar.type = 'button';
      cancelar.className = 'btn btn-secondary';
      cancelar.textContent = T.cancelar;
      const guardar = document.createElement('button');
      guardar.type = 'submit';
      guardar.className = 'btn btn-primary';
      guardar.textContent = T.guardar;
      pie.appendChild(cancelar);
      pie.appendChild(guardar);
      form.appendChild(pie);

      function cerrar() { hueco.replaceChildren(); nuevo.hidden = false; }
      cancelar.addEventListener('click', cerrar);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const valores = {};
        SITIOS_CLIENTE.ORDEN.forEach((k) => { valores[k] = campos[k].value; });
        const cuerpo = SITIOS_CLIENTE.cuerpo(valores);
        // Sólo espacios: el `required` del navegador lo deja pasar y el servidor lo guardaría.
        if (!cuerpo.name) { campos.name.value = ''; campos.name.reportValidity && campos.name.reportValidity(); return; }
        guardar.disabled = true;
        errorForm.hidden = true;
        const peticion = sitio
          ? apiRequest(`/admin/customers/${id}/sites/${sitio.id}`, { method: 'PUT', body: JSON.stringify(cuerpo) })
          : apiRequest(`/admin/customers/${id}/sites`, { method: 'POST', body: JSON.stringify(cuerpo) });
        peticion.then(() => {
          if (!viva()) return;
          cerrar();
          cargar();
        }, (err) => {
          if (!viva()) return;
          guardar.disabled = false;
          if (err && err.handled) return;
          errorForm.textContent = window.mensajeParaPersona(err, T.generico);
          errorForm.hidden = false;
        });
      });

      hueco.replaceChildren(form);
      nuevo.hidden = true;
      campos.name.focus();
    }

    nuevo.addEventListener('click', () => abrirFormulario(null));
    if (filaFiscal) lista.appendChild(filaFiscal);
    cargar();
  }

  // Activar primer tab
  tabQuotes.style.color = 'var(--green-600)';
  tabQuotes.style.borderBottomColor = 'var(--green-500)';
  renderTab('quotes');
}

function escC(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── SCRUM-1003 (CRM-03) · el .vcf del cliente, en una función PURA ──────────────────────────
// Sin endpoint nuevo y sin más datos que los que la ficha ya muestra (nombre, teléfono, móvil,
// email, dirección de facturación). Separada del `onclick` a propósito: así se puede probar el
// TEXTO del .vcf sin tocar `Blob`/`URL.createObjectURL`, que el banco de vistas no implementa de
// verdad (`tests/_banco-vistas.mjs`: `Blob: class {}` — límite declarado, no un hueco silencioso).
function escapeVCard(v) {
  return String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}
function construirVCard(customer) {
  const nombre = escapeVCard(customer && customer.name ? customer.name : 'Cliente');
  const lineas = ['BEGIN:VCARD', 'VERSION:3.0', 'N:;' + nombre + ';;;', 'FN:' + nombre];
  if (customer && customer.phone) lineas.push('TEL;TYPE=WORK,VOICE:' + escapeVCard(customer.phone));
  if (customer && customer.mobile) lineas.push('TEL;TYPE=CELL:' + escapeVCard(customer.mobile));
  if (customer && customer.email) lineas.push('EMAIL:' + escapeVCard(customer.email));
  const dir = customer || {};
  if (dir.billingAddress || dir.billingCity || dir.billingProvince || dir.billingPostalCode || dir.billingCountry) {
    // ADR: casilla;extendida;calle;ciudad;provincia;CP;país (RFC 6350)
    lineas.push('ADR;TYPE=WORK:;;' + escapeVCard(dir.billingAddress) + ';' + escapeVCard(dir.billingCity) + ';'
      + escapeVCard(dir.billingProvince) + ';' + escapeVCard(dir.billingPostalCode) + ';' + escapeVCard(dir.billingCountry));
  }
  lineas.push('END:VCARD');
  return lineas.join('\r\n') + '\r\n';
}
/** El nombre del fichero: el del cliente, sin caracteres que rompan el sistema de ficheros. */
function nombreDeFicheroVCard(customer) {
  const base = String((customer && customer.name) || 'cliente').replace(/[\\/:*?"<>|]+/g, '').trim();
  return (base || 'cliente') + '.vcf';
}
if (typeof window !== 'undefined') {
  window.construirVCard = construirVCard;
  window.nombreDeFicheroVCard = nombreDeFicheroVCard;
}

// ── SCRUM-1126 · Fusionar con otro cliente ──────────────────────────────────
// Elegir → previsualización (GET, no escribe nada) → «Fusionar» → POST. El POST sólo sale de ese
// botón, y el botón sólo existe con una previsualización NO bloqueada en pantalla. Si la
// previsualización ya trae `bloqueada` (el mismo motivo que daría el 409), se avisa ANTES y no se
// ofrece el botón; el 409 del POST se maneja igual, porque entre mirar y pulsar alguien puede
// haber emitido una factura.
function abrirFusionDeClientes(customer, customerId, container) {
  const T = FUSION_CLIENTE.TEXTOS;
  const el = (tag, clase, texto) => {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto !== undefined) n.textContent = texto;
    return n;
  };

  const overlay = el('div', 'modal-overlay');
  const modal = el('div', 'modal');
  const cerrar = () => overlay.remove();
  modal.appendChild(cabeceraModal({ titulo: T.boton, sinCierre: true }));

  const cuerpo = el('div', 'modal-body');
  const campo = el('div', 'field');
  const etiqueta = el('label', '', T.selector);
  etiqueta.setAttribute('for', 'fusion-buscar');
  const buscar = el('input', 'input');
  buscar.type = 'search';
  buscar.id = 'fusion-buscar';
  buscar.placeholder = T.placeholder;
  buscar.autocomplete = 'off';
  campo.appendChild(etiqueta);
  campo.appendChild(buscar);
  const lista = el('div', 'fusion-candidatos');
  const previa = el('div', 'fusion-previa');
  const aviso = el('div', 'alert error');
  aviso.id = 'fusion-alert';
  cuerpo.appendChild(campo);
  cuerpo.appendChild(lista);
  cuerpo.appendChild(previa);
  cuerpo.appendChild(aviso);
  modal.appendChild(cuerpo);

  const pie = el('div', 'modal-footer');
  const cancelar = el('button', 'btn btn-secondary', T.cancelar);
  cancelar.type = 'button';
  cancelar.id = 'fusion-cancelar';
  const confirmar = el('button', 'btn btn-danger fusion-confirmar', T.confirmar);
  confirmar.type = 'button';
  confirmar.id = 'fusion-confirmar';
  confirmar.disabled = true;
  pie.appendChild(cancelar);
  pie.appendChild(confirmar);
  modal.appendChild(pie);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
  cancelar.addEventListener('click', cerrar);

  const mostrarError = (texto) => { aviso.textContent = texto || ''; };

  // El elegido cuya previsualización está en pantalla y se puede confirmar. `null` = no hay nada
  // que confirmar, y entonces el botón está desactivado Y el clic no llama (dos cierres, no uno).
  let elegido = null;
  // Una previsualización que llega tarde (se eligió otro mientras tanto) no pisa a la buena.
  let turno = 0;
  let clientes = [];

  const pintarLista = () => {
    lista.innerHTML = '';
    const encontrados = FUSION_CLIENTE.candidatos(clientes, customerId, buscar.value);
    if (!encontrados.length) {
      lista.appendChild(el('p', 'fusion-vacio', T.sinResultados));
      return;
    }
    encontrados.forEach((c) => {
      const b = el('button', 'fusion-candidato');
      b.type = 'button';
      b.dataset.id = String(c.id);
      b.appendChild(el('span', 'fusion-candidato-nombre', c.name || ''));
      if (c.taxId) b.appendChild(el('span', 'fusion-candidato-nif', c.taxId));
      b.addEventListener('click', () => previsualizar(c.id));
      lista.appendChild(b);
    });
  };

  async function previsualizar(conId) {
    const miTurno = ++turno;
    elegido = null;
    confirmar.disabled = true;
    previa.innerHTML = '';
    mostrarError('');
    let p;
    try {
      p = await apiRequest(`/admin/customers/${customerId}/fusion-preview?con=${encodeURIComponent(conId)}`);
    } catch (err) {
      if (miTurno === turno) mostrarError(window.mensajeParaPersona(err, T.generico));
      return;
    }
    if (miTurno !== turno) return;
    if (p.bloqueada) {
      mostrarError(FUSION_CLIENTE.motivo(p.bloqueada) || T.generico);
      return;
    }
    if (!p.principal || !p.fusionado) { mostrarError(T.generico); return; }

    previa.appendChild(el('h4', 'fusion-previa-titulo', T.tituloPrevia));
    previa.appendChild(el('p', 'fusion-linea', FUSION_CLIENTE.seQueda(p.principal.name)));
    previa.appendChild(el('p', 'fusion-linea', FUSION_CLIENTE.desaparece(p.fusionado.name)));
    previa.appendChild(el('p', 'fusion-linea', FUSION_CLIENTE.todoPasa(p.fusionado.name, p.principal.name)));
    previa.appendChild(el('p', 'fusion-linea fusion-contados', FUSION_CLIENTE.contados(p.quotesAMover, p.jobsAMover, p.notasAMover)));
    previa.appendChild(el('p', 'fusion-linea', FUSION_CLIENTE.sinEmpresa(p.fusionado.name)));
    previa.appendChild(el('p', 'fusion-linea', FUSION_CLIENTE.etiquetas(p.etiquetasResultantes)));
    if (p.nifDistintos) {
      previa.appendChild(el('div', 'alert warning fusion-nif', FUSION_CLIENTE.avisoNif(p.principal.taxId, p.fusionado.taxId)));
    }
    previa.appendChild(el('p', 'fusion-irreversible', FUSION_CLIENTE.confirmacion(p.fusionado.name)));
    elegido = p.fusionado.id;
    confirmar.disabled = false;
  }

  confirmar.addEventListener('click', async () => {
    if (elegido == null) return;
    const con = elegido;
    confirmar.disabled = true;
    cancelar.disabled = true;
    mostrarError('');
    try {
      await apiRequest(`/admin/customers/${customerId}/fusionar`, { method: 'POST', body: JSON.stringify({ con }) });
    } catch (err) {
      cancelar.disabled = false;
      mostrarError(FUSION_CLIENTE.textoDelError(err));
      // Rechazado por un motivo que no cambia reintentando: no se vuelve a ofrecer.
      if (err && err.status === 409) elegido = null;
      else confirmar.disabled = false;
      return;
    }
    cerrar();
    if (typeof window.showToast === 'function') window.showToast(T.exito);
    // La ficha que se queda, recargada: ya trae lo movido y las etiquetas unidas.
    renderCustomer360View(container, customerId);
  });

  buscar.addEventListener('input', pintarLista);
  apiRequest('/admin/customers')
    .then((r) => { clientes = Array.isArray(r) ? r : []; pintarLista(); })
    .catch((err) => mostrarError(window.mensajeParaPersona(err, T.generico)));
  if (typeof buscar.focus === 'function') buscar.focus();
}

// ── Modal de edición desde la ficha 360 ─────────────────────────────────────
// Mismos campos que el modal de la lista (nombre/teléfono/email/notas/baja WA).
function openEdit360Modal(customer, customerId, container) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.maxWidth = '440px';
  modal.innerHTML = `
    <div class="modal-body" style="flex-direction:column;gap:10px">
      <!-- SCRUM-574 (CONT-01): hueco para el switch Empresa/Persona. Va PRIMERO porque decide qué
           campos tienen sentido debajo. El nodo se inserta después: el switch es un componente con
           comportamiento (switchFormaJuridica.js) y una plantilla de texto no puede tenerlo.
           SIN COMILLAS INVERSAS AQUÍ DENTRO: esto vive en un template literal y una comilla
           inversa lo CIERRA — el navegador descarta el fichero entero. Es el defecto histórico de
           exportView que la suite vigila en «② ROJO: backtick dentro del template». -->
      <div id="e360-forma"></div>
      <div class="field"><label>Nombre</label><input type="text" id="e360-name"/></div>
      <div class="field"><label>Teléfono (E.164 sin +)</label><input type="text" id="e360-phone"/></div>
      <div class="field"><label>Móvil (WhatsApp)</label><input type="text" id="e360-mobile"/></div>
      <div class="field"><label>Email</label><input type="email" id="e360-email"/></div>
      <div class="field"><label>Razón social (empresa, opcional)</label><input type="text" id="e360-legalname"/></div>
      <div class="field"><label>NIF/CIF (opcional)</label><input type="text" id="e360-taxid"/></div>
      <!-- SCRUM-576 (CONT-03): hueco para el selector de empresa. El nodo se inserta después, como
           el switch: es un componente con comportamiento (switchFormaJuridica.js) y una plantilla
           de texto no puede tenerlo. SIN COMILLAS INVERSAS AQUÍ DENTRO. -->
      <div id="e360-empresa"></div>
      <div class="field"><label>Facturación pactada</label>
        <select id="e360-periodicidad" class="input">
          <option value="NINGUNA">Cuando toque (sin periodicidad)</option>
          <option value="QUINCENAL">Cada quince días</option>
          <option value="MENSUAL">Mensual</option>
        </select>
        <div style="font-size:12px;color:var(--muted);margin-top:4px">Solo sirve para avisarte de que toca facturarle. YaQu nunca factura ni envía nada solo — y el plazo legal manda por encima de lo que pactes.</div>
      </div>
      <div class="field"><label>Tipo de cliente</label>
        <select id="e360-tipodestinatario" class="input">
          <option value="">Sin clasificar</option>
          <option value="PARTICULAR">Particular</option>
          <option value="EMPRESARIO">Empresa / profesional</option>
        </select>
      </div>
      <div class="field"><label>Notas</label><textarea id="e360-notes" rows="3" style="resize:vertical"></textarea></div>
      <label class="inline-checkbox" style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--neutral-600)">
        <input type="checkbox" id="e360-waoptout"/> Baja de WhatsApp: no enviarle más mensajes (el cliente lo pidió)
      </label>
      <div class="alert error" id="e360-alert" style="display:none"></div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" id="e360-cancel">Cancelar</button>
      <button type="button" class="btn btn-primary" id="e360-save">Guardar cambios</button>
    </div>
  `;
  // SCRUM-446: la cabecera sale del constructor compartido.
  modal.prepend(cabeceraModal({ titulo: "Editar cliente", sinCierre: true }));
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  const $ = (sel) => modal.querySelector(sel);
  $('#e360-name').value = customer.name || '';
  $('#e360-phone').value = customer.phone || '';
  // SCRUM-590 (CONT-19): sin esta línea, editar un cliente que TIENE móvil lo enseñaría vacío.
  // Y como el vacío no viaja (ver el guardado), el profesional creería haberlo borrado sin
  // haberlo borrado — que es peor que perderlo: es mentir sobre él.
  $('#e360-mobile').value = customer.mobile || '';
  $('#e360-email').value = customer.email || '';
  $('#e360-notes').value = customer.notes || '';
  $('#e360-legalname').value = customer.legalName || ''; // A20.4
  $('#e360-taxid').value = customer.taxId || '';
  $('#e360-tipodestinatario').value = customer.tipoDestinatario || ''; // SCRUM-69
  $('#e360-periodicidad').value = customer.billingPeriodicity || 'NINGUNA'; // SCRUM-171b
  $('#e360-waoptout').checked = !!customer.waOptOut;

  // SCRUM-574 (CONT-01) · el switch, en el SEGUNDO de los dos sitios que lo llevan.
  // La forma jurídica sale de `contactKind` y de NADA MÁS: nunca se deduce de `tipoDestinatario`
  // (que está tres campos más abajo y responde otra pregunta) ni de si hay razón social.
  const wrapperDe = (sel) => $(sel).closest('.field');

  // SCRUM-576 (CONT-03) · el selector de empresa, en el SEGUNDO de los dos formularios.
  //
  // 🔴 SALE DE LA MISMA PIEZA que el de la lista (`switchFormaJuridica.selectorDeEmpresa`) y no de
  // una copia. Es la lección medida de `docs/CONTACTOS_CAMPOS_POR_LADO.md` §2: estos dos modales
  // YA divergieron una vez —uno tiene recargo de equivalencia y le falta facturación pactada, el
  // otro al revés— porque cada uno se editó por su lado. Un campo construido dos veces diverge.
  //
  // Aquí NO hay lista de clientes cargada: la ficha 360 sólo conoce a SU cliente. Se pide, y se
  // refresca cuando llegue — sin esperar, porque el modal ya está en pantalla. `refrescar`
  // conserva lo elegido, así que llegar tarde no desvincula a nadie.
  const selectorEmpresa = switchFormaJuridica.selectorDeEmpresa({ valor: customer.companyId ?? null });
  $('#e360-empresa').appendChild(selectorEmpresa.nodo);
  // ═══ SCRUM-590 (CONT-19) · POR QUÉ EL MÓVIL DE ESTA PANTALLA NO LLEVA SELECTOR DE PREFIJO
  //
  // El modal de la lista sí lo lleva (SCRUM-578). Aquí NO, y es una decisión con su motivo:
  //
  //  · La regla que junta y reparte prefijo + número vive DENTRO de `customersView.js`, y los
  //    guards de SCRUM-578 leen esa región del fichero para comprobarla. Sacarla a un módulo
  //    compartido los dejaría vigilando un delegador vacío —verdes sin medir— y arreglar un
  //    guard bajando lo que exige está prohibido. Copiarla aquí serían DOS sitios donde
  //    divergir, que es justo lo que este ticket ha evitado en el backend.
  //  · Y el fijo de AL LADO tampoco lo lleva: darle selector sólo al móvil dejaría dos campos
  //    del mismo tipo con dos controles distintos en el mismo formulario.
  //
  // ⚠️ LO QUE ESTO CUESTA, dicho y no escondido: aquí se puede guardar «600111222» sin prefijo, y
  // ése es un número que WhatsApp no sabe encaminar. **No es un riesgo nuevo**: es exactamente el
  // que este formulario ya tiene con `phone`, que HOY es el canal de todos los documentos. Es la
  // divergencia entre los dos formularios ya medida en `docs/CONTACTOS_CAMPOS_POR_LADO.md` §2 —
  // reportada, y de otro carril (regla 37).
  //
  // 🔴 EL CAMPO SE VE EN LOS DOS LADOS (Empresa/Persona), y por eso NO entra en este mapa:
  // `SOLO_EMPRESA` es `['legalName']` y §3.1 pone `phone` entre los comunes. Un móvil es canal
  // de contacto, no forma jurídica.
  //
  // 🔴 Y SCRUM-576 (CONT-03) AÑADE LA TERCERA ENTRADA: `companyId`, que SÍ es de un solo lado —el
  // de PERSONA—. Conviven en el mismo mapa sin contradecirse porque responden a la misma
  // pregunta desde los dos extremos: `legalName` sólo se ve en Empresa, `companyId` sólo en
  // Persona, y el móvil de arriba en los dos. La regla de quién esconde a quién no vive aquí:
  // vive en `switchFormaJuridica`, y este mapa sólo dice DÓNDE está cada campo.
  const camposPorLado = {
    legalName: wrapperDe('#e360-legalname'),
    taxId: wrapperDe('#e360-taxid'),
    companyId: selectorEmpresa.nodo, // SCRUM-576: el campo del lado PERSONA
  };
  const switchForma = switchFormaJuridica({
    valor: customer.contactKind,
    alCambiar: (lado) => switchFormaJuridica.aplicarLado(lado, camposPorLado),
  });
  $('#e360-forma').appendChild(switchForma.nodo);
  // Después de rellenar los campos: la regla mira si «razón social» tiene algo para no esconderlo.
  switchFormaJuridica.aplicarLado(switchForma.leer(), camposPorLado);

  // SCRUM-576 · la lista de empresas llega DESPUÉS, y va aquí abajo a propósito: usa
  // `switchForma` y `camposPorLado`, que se declaran justo encima. Ponerlo antes funcionaría
  // —el `.then` no corre hasta que el turno síncrono acaba— pero obligaría a razonar sobre
  // microtareas para leer cuatro líneas.
  getCustomers("")
    .then((lista) => {
      selectorEmpresa.refrescar(lista, customer.id);
      // Repasa la regla: el campo pudo pasar de vacío a con valor, y un valor escrito no se
      // esconde nunca (invariante ② de `switchFormaJuridica`).
      switchFormaJuridica.aplicarLado(switchForma.leer(), camposPorLado);
    })
    .catch(() => { /* el campo es opcional: sin lista se queda con lo que ya tenía */ });

  $('#e360-cancel').onclick = () => overlay.remove();

  function showErr(msg) {
    const a = $('#e360-alert');
    a.textContent = msg;
    a.style.display = 'block';
  }

  $('#e360-save').onclick = async () => {
    const name = $('#e360-name').value.trim();
    if (!name) { showErr('El nombre es obligatorio.'); return; }
    const phone = $('#e360-phone').value.trim();
    const mobile = $('#e360-mobile').value.trim(); // SCRUM-590 (CONT-19)
    const email = $('#e360-email').value.trim();
    // El schema del backend valida formato: omitir vacíos en vez de mandar ""
    const payload = {
      name,
      notes: $('#e360-notes').value.trim() || undefined,
      legalName: $('#e360-legalname').value.trim() || null, // A20.4
      taxId: $('#e360-taxid').value.trim() || null,
      // SCRUM-576 (CONT-03): «sin empresa» viaja como `null`, nunca `""` ni `0`.
      companyId: selectorEmpresa.leer(),
      tipoDestinatario: $('#e360-tipodestinatario').value || null, // SCRUM-69
      // SCRUM-574: forma jurídica. `null` = sin declarar, y viaja como null: no se cae a un lado.
      // Va PEGADO a `tipoDestinatario` en el payload y son campos INDEPENDIENTES — el uno no se
      // deriva del otro ni aquí ni en ningún sitio (fundador, 24-ago-2026).
      contactKind: switchForma.leer(),
      billingPeriodicity: $('#e360-periodicidad').value || 'NINGUNA', // SCRUM-171b
      waOptOut: $('#e360-waoptout').checked,
    };
    if (phone) payload.phone = phone;
    // ═══ 🔴 SCRUM-590 (CONT-19) · EL MÓVIL SÓLO VIAJA SI HAY MÓVIL ══════════════════════════
    //
    // Misma regla que sus vecinos, y aquí NO es estilo. Medido ejecutando `customerCreateSchema`:
    // `mobile: ""` RECHAZA («>=5 characters») y `mobile: null` RECHAZA («expected string»); sólo
    // ausente pasa. Mandar el vacío haría que guardar un cliente SIN móvil devolviera un 400: un
    // campo opcional que rompe el guardado del cliente entero se ha vuelto obligatorio de rebote.
    //
    // Consecuencia, dicha en vez de descubierta: vaciar el móvil de un cliente que lo tiene NO lo
    // borra. Es la limitación que ya tienen `phone` y `email` en esta misma pantalla — se hereda,
    // no se estrena — y se cierra el día que el esquema acepte `null` en los tres a la vez.
    if (mobile) payload.mobile = mobile;
    if (email) payload.email = email;

    // ═══ 🔴 SCRUM-983 · LO QUE NO SE CARGÓ, NO VIAJA ═══════════════════════════════════════
    //
    // Un control vacío puede significar dos cosas: «el profesional lo ha vaciado» o «el dato nunca
    // llegó a este formulario». La primera tiene que viajar como `null` —vaciar a propósito sigue
    // siendo posible (SCRUM-692 ⑤)—; la segunda, NO: sería convertir «no lo sé» en «bórralo».
    // Medido en staging el 21-sep-2026: el /detail no traía el NIF ni otros cinco campos, el modal
    // los pintaba vacíos y editar sólo la nota los borraba. El /detail ya los trae; esto es la
    // otra mitad, para que el día que alguien añada un campo al modal y no al `select`, el
    // resultado sea que ese campo no se guarda, no que se borra.
    for (const k of Object.keys(payload)) {
      if (!Object.prototype.hasOwnProperty.call(customer, k)) delete payload[k];
    }

    const btn = $('#e360-save');
    btn.disabled = true;
    btn.textContent = 'Guardando…';
    try {
      await apiRequest(`/admin/customers/${customerId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      overlay.remove();
      // Recargar la ficha con los datos nuevos
      renderCustomer360View(container, customerId);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Guardar cambios';
      showErr('No se pudo guardar: ' + (err && err.message ? err.message : 'inténtalo de nuevo'));
    }
  };
}
