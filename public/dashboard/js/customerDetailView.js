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
 * el selector de SCRUM-1144 copia la dirección como texto en el documento. Desde SCRUM-914d SÍ hay un
 * modelo que apunta a `CustomerSite`: el equipo del cliente, con su `customerSiteId` opcional
 * (`prisma/schema.prisma`), que la pestaña «Equipos» no rellena (P3 ❌ de SCRUM-1833 c.22811).
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

// SCRUM-1005d · INICIO — la pestaña «Documentos» (ni un `style=` ni un `on*=` en cadenas: SCRUM-1773).
/**
 * SCRUM-1005d · LA PESTAÑA «DOCUMENTOS»: contratos, boletines y planos del cliente.
 *
 * El servidor es de SCRUM-1005b (`GET/POST /admin/customers/:id/documentos`, `GET …/:docId` descarga
 * como adjunto, `DELETE …/:docId` solo admin) y contesta CÓDIGOS; las frases son estas. Los textos son
 * los de SCRUM-1005 c.22192, byte a byte, y cada uno lleva su firma en SU línea: esta cabecera no firma
 * el objeto entero, porque los métodos de abajo no son textos (SCRUM-1215g: una firma de grupo no cubre
 * a quien llega después). Registro:
 * `docs/microcopy/2026-11-20-SCRUM-1005-documentos-del-cliente.md`). Los huecos `{n}`, `{mb}` y
 * `{nombre}` son los del propio comentario: `{mb}` sale de `limites` (bytes) que trae la lista, nunca
 * de una cifra escrita aquí. Permisos de c.22192: ver y subir, todo el equipo; borrar, solo admin.
 * La fila 10 («También se borrarán sus documentos.») no está: hoy ninguna pantalla borra clientes.
 */
const DOCUMENTOS_CLIENTE = {
  TEXTOS: {
    pestana: 'Documentos ({n})', // APROBADO por el fundador el 19-nov-2026 (SCRUM-1005 comentario 22192)
    subir: '+ Subir documento', // APROBADO por el fundador el 19-nov-2026 (SCRUM-1005 comentario 22192)
    vacio: 'Todavía no hay documentos guardados para este cliente.', // APROBADO por el fundador el 19-nov-2026 (SCRUM-1005 comentario 22192)
    subiendo: 'Subiendo…', // APROBADO por el fundador el 19-nov-2026 (SCRUM-1005 comentario 22192)
    subido: 'Documento guardado.', // APROBADO por el fundador el 19-nov-2026 (SCRUM-1005 comentario 22192)
    formato: 'Solo se pueden subir documentos PDF, JPG o PNG.', // APROBADO por el fundador el 19-nov-2026 (SCRUM-1005 comentario 22192)
    grande: 'Cada documento puede ocupar como máximo {mb} MB.', // APROBADO por el fundador el 19-nov-2026 (SCRUM-1005 comentario 22192)
    topeAdmin: 'Este cliente ya tiene {mb} MB en documentos, el máximo. Borra alguno para subir otro.', // APROBADO por el fundador el 19-nov-2026 (SCRUM-1005 comentario 22192)
    topeTecnico: 'Este cliente ha llegado al máximo de {mb} MB en documentos.', // APROBADO por el fundador el 19-nov-2026 (SCRUM-1005 comentario 22192)
    descargar: 'Descargar', // APROBADO por el fundador el 19-nov-2026 (SCRUM-1005 comentario 22192)
    eliminar: '🗑 Eliminar', // APROBADO por el fundador el 19-nov-2026 (SCRUM-1005 comentario 22192)
    confirmarBorrar: '¿Borrar el documento "{nombre}"? Esta acción no se puede deshacer.', // APROBADO por el fundador el 19-nov-2026 (SCRUM-1005 comentario 22192)
    ariaElegir: 'Elegir un documento para subir', // APROBADO por el fundador el 19-nov-2026 (SCRUM-1005 comentario 22192)
    ariaDescargar: 'Descargar {nombre}', // APROBADO por el fundador el 19-nov-2026 (SCRUM-1005 comentario 22192)
    ariaBorrar: 'Borrar {nombre}', // APROBADO por el fundador el 19-nov-2026 (SCRUM-1005 comentario 22192)
    vacioFichero: 'Ese fichero está vacío: elige otro.', // APROBADO por el fundador el 19-nov-2026 (SCRUM-1005 comentario 22192)
    errorCarga: 'No se pudieron cargar los documentos. Inténtalo de nuevo.', // APROBADO por el fundador el 19-nov-2026 (SCRUM-1005 comentario 22192)
  },
  /** Rellena los huecos `{clave}` de un texto firmado. */
  rellenar(texto, valores) {
    return String(texto).replace(/\{(\w+)\}/g, (m, k) => (valores && valores[k] !== undefined ? String(valores[k]) : m));
  },
  tituloPestana(n) {
    return DOCUMENTOS_CLIENTE.rellenar(DOCUMENTOS_CLIENTE.TEXTOS.pestana, { n });
  },
  /** Bytes → la cifra de «{mb}»: entre 1024·1024, sin decimales si es entera. */
  mb(bytes) {
    return (Number(bytes) / (1024 * 1024)).toLocaleString('es-ES', { maximumFractionDigits: 1 });
  },
  /** El tamaño de una fila, con la unidad que pone `Intl` (no es un texto nuestro). */
  tamano(bytes) {
    const b = Number(bytes);
    if (!Number.isFinite(b) || b < 0) return '';
    const mega = b >= 1024 * 1024;
    return new Intl.NumberFormat('es-ES', { style: 'unit', unit: mega ? 'megabyte' : 'kilobyte', maximumFractionDigits: 1 })
      .format(mega ? b / (1024 * 1024) : Math.max(b / 1024, 0.1));
  },
  /**
   * El texto de un código del servidor. `''` = sin texto (NOMBRE_NO_VALIDO, c.22192 fila 13);
   * `null` = el genérico que ya existe en el panel (CUERPO_ILEGIBLE y lo que no tenga fila).
   */
  textoDeError(codigo, { puedeBorrar, limites }) {
    const T = DOCUMENTOS_CLIENTE.TEXTOS;
    const L = limites || {};
    const conMb = (t, bytes) => (bytes ? DOCUMENTOS_CLIENTE.rellenar(t, { mb: DOCUMENTOS_CLIENTE.mb(bytes) }) : null);
    switch (codigo) {
      case 'FORMATO_NO_ADMITIDO': return T.formato;
      case 'FICHERO_DEMASIADO_GRANDE': return conMb(T.grande, L.porFichero);
      case 'TOPE_DEL_CLIENTE': return conMb(puedeBorrar ? T.topeAdmin : T.topeTecnico, L.porCliente);
      case 'FICHERO_VACIO': return T.vacioFichero;
      case 'NOMBRE_NO_VALIDO': return '';
      default: return null;
    }
  },
};
if (typeof window !== 'undefined') window.documentosCliente = DOCUMENTOS_CLIENTE;

/**
 * Pinta la pestaña en `card`. Reusa las clases de «Sitios» (`sitios-cliente__*`): misma forma de lista
 * con acciones, sin hoja nueva. Todo con `textContent`: los nombres los pone quien sube el fichero.
 * `viva()` dice si esta apertura sigue siendo la última; `alContar(n)` repinta el número de la pestaña.
 */
function montarDocumentosDelCliente(card, customerId, viva, alContar) {
  const D = DOCUMENTOS_CLIENTE;
  const T = D.TEXTOS;
  const puedeBorrar = window.appUserRole === 'admin';
  // `base` solo para el enlace de descarga: las llamadas de red llevan la ruta ESCRITA, porque con una
  // variable la sonda de SCRUM-1185 no ve quién consume la ruta (sale «ciega-llamada-opaca»).
  const base = `/admin/customers/${customerId}/documentos`;
  let limites = null;
  card.classList.add('sitios-cliente');

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png';
  input.hidden = true;
  input.setAttribute('aria-label', T.ariaElegir);
  card.appendChild(input);

  const subir = document.createElement('button');
  subir.type = 'button';
  subir.className = 'btn btn-secondary sitios-cliente__nuevo';
  subir.dataset.accion = 'subir';
  subir.textContent = T.subir;
  subir.addEventListener('click', () => input.click());
  card.appendChild(subir);

  const estado = document.createElement('p');
  estado.className = 'sitios-cliente__contacto';
  estado.dataset.rol = 'estado-documentos';
  estado.setAttribute('role', 'status');
  card.appendChild(estado);

  const aviso = document.createElement('p');
  aviso.className = 'sitios-cliente__error';
  aviso.dataset.rol = 'aviso-documentos';
  aviso.setAttribute('role', 'alert');
  aviso.hidden = true;
  card.appendChild(aviso);
  function avisar(texto) { aviso.textContent = texto || ''; aviso.hidden = !texto; }
  function avisarError(err, respaldo) {
    if (err && err.handled) return; // la prueba vencida: `_pedir` ya llevó a Planes
    const codigo = err && err.data && err.data.error;
    const propio = D.textoDeError(codigo, { puedeBorrar, limites });
    avisar(propio === null ? window.mensajeParaPersona(err, respaldo) : propio);
  }

  const lista = document.createElement('ul');
  lista.className = 'sitios-cliente__lista';
  card.appendChild(lista);

  function linea(clase, texto) {
    const s = document.createElement('span');
    s.className = clase;
    s.textContent = texto;
    return s;
  }

  function pintarLista(documentos) {
    lista.replaceChildren();
    if (!documentos.length) {
      const li = document.createElement('li');
      li.className = 'sitios-cliente__vacio';
      li.textContent = T.vacio;
      lista.appendChild(li);
      return;
    }
    documentos.forEach((d) => {
      const nombre = d.fileName || String(d.id);
      const li = document.createElement('li');
      li.className = 'sitios-cliente__fila';
      li.dataset.documento = String(d.id);
      li.appendChild(linea('sitios-cliente__nombre', nombre));
      const fecha = d.createdAt ? new Date(d.createdAt).toLocaleDateString('es-ES') : '';
      li.appendChild(linea('sitios-cliente__direccion', [D.tamano(d.sizeBytes), fecha].filter(Boolean).join(' · ')));
      const acciones = document.createElement('div');
      acciones.className = 'sitios-cliente__acciones';
      const a = document.createElement('a');
      a.className = 'contacto-link';
      a.setAttribute('href', `${base}/${d.id}`);
      a.setAttribute('download', '');
      a.setAttribute('aria-label', D.rellenar(T.ariaDescargar, { nombre }));
      a.textContent = T.descargar;
      acciones.appendChild(a);
      // Borrar: solo admin (c.22192), y no es la acción principal: botón fantasma, al final, y pregunta.
      if (puedeBorrar) {
        const eliminar = document.createElement('button');
        eliminar.type = 'button';
        eliminar.className = 'btn-ghost btn-sm';
        eliminar.dataset.accion = 'eliminar';
        eliminar.setAttribute('aria-label', D.rellenar(T.ariaBorrar, { nombre }));
        eliminar.textContent = T.eliminar;
        eliminar.addEventListener('click', () => borrar(d, nombre, eliminar));
        acciones.appendChild(eliminar);
      }
      li.appendChild(acciones);
      lista.appendChild(li);
    });
  }

  function cargar() {
    return apiRequest(`/admin/customers/${customerId}/documentos`).then((r) => {
      if (!viva()) return;
      const docs = r && Array.isArray(r.documentos) ? r.documentos : [];
      limites = r && r.limites ? r.limites : limites;
      pintarLista(docs);
      alContar(docs.length);
    }, (err) => {
      if (!viva()) return;
      if (err && err.handled) return;
      avisar(T.errorCarga);
    });
  }

  function borrar(d, nombre, boton) {
    if (!window.confirm(D.rellenar(T.confirmarBorrar, { nombre }))) return;
    boton.disabled = true;
    avisar('');
    estado.textContent = '';
    apiRequest(`/admin/customers/${customerId}/documentos/${d.id}`, { method: 'DELETE' }).then(() => {
      if (viva()) cargar();
    }, (err) => {
      if (!viva()) return;
      boton.disabled = false;
      avisarError(err, SITIOS_CLIENTE.TEXTOS.generico);
    });
  }

  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    if (!file) return;
    avisar('');
    estado.textContent = '';
    // Como la foto del albarán: lo que la pantalla ya sabe rechazar, no se envía.
    if (file.size === 0) { avisar(T.vacioFichero); input.value = ''; return; }
    if (limites && limites.porFichero && file.size > limites.porFichero) {
      avisar(D.rellenar(T.grande, { mb: D.mb(limites.porFichero) })); input.value = ''; return;
    }
    estado.textContent = T.subiendo;
    subir.disabled = true;
    apiRequest(`/admin/customers/${customerId}/documentos`, {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-Nombre-Fichero': encodeURIComponent(file.name) },
      body: file,
    }).then(() => {
      if (!viva()) return;
      subir.disabled = false;
      input.value = '';
      estado.textContent = T.subido;
      cargar();
    }, (err) => {
      if (!viva()) return;
      subir.disabled = false;
      input.value = '';
      estado.textContent = '';
      avisarError(err, SITIOS_CLIENTE.TEXTOS.generico);
    });
  });

  cargar();
}
// SCRUM-1005d · FIN

// SCRUM-1833c · INICIO — la pestaña «Equipos» (ni un `style=` ni un `on*=` en cadenas: SCRUM-1773).
/**
 * SCRUM-1833c · LA PESTAÑA «EQUIPOS»: calderas, aires, cuadros… de cada cliente.
 *
 * El servidor es de SCRUM-1833b (`GET/POST /admin/customers/:id/equipos`, `PUT …/:equipoId`, y
 * `DELETE …/:equipoId` con `requireRole('admin')`). La lista se pide AL ABRIR la pestaña, como «Sitios».
 * Los textos llevan su firma en SU línea (registro en
 * `docs/microcopy/2026-11-26-SCRUM-1833-equipos-del-cliente.md`). Decisiones de c.22811: P3 ❌ (el
 * equipo cuelga solo del cliente: sin campo de sitio), P4 ✅ (borrar, solo admin), P5 ❌ (la garantía
 * es una FECHA: ni pastilla ni estado).
 */
const EQUIPOS_CLIENTE = {
  TEXTOS: {
    pestana: 'Equipos', // APROBADO por el fundador el 25-nov-2026 (SCRUM-1833 comentario 22811)
    nuevo: '+ Nuevo equipo', // APROBADO por el fundador el 25-nov-2026 (SCRUM-1833 comentario 22811)
    vacio: 'Todavía no hay equipos guardados para este cliente.', // APROBADO por el fundador el 25-nov-2026 (SCRUM-1833 comentario 22811)
    ejemploTipo: 'Caldera / Aire acondicionado / Cuadro eléctrico', // APROBADO por el fundador el 25-nov-2026 (SCRUM-1833 comentario 22811)
    ejemploNombre: 'Caldera de la cocina', // APROBADO por el fundador el 25-nov-2026 (SCRUM-1833 comentario 22811)
    CAMPOS: {
      type: 'Tipo de equipo', // APROBADO por el fundador el 25-nov-2026 (SCRUM-1833 comentario 22811)
      name: 'Nombre del equipo', // APROBADO por el fundador el 25-nov-2026 (SCRUM-1833 comentario 22811)
      brand: 'Marca', // APROBADO por el fundador el 25-nov-2026 (SCRUM-1833 comentario 22811)
      modelName: 'Modelo', // APROBADO por el fundador el 25-nov-2026 (SCRUM-1833 comentario 22811)
      serialNumber: 'Número de serie', // APROBADO por el fundador el 25-nov-2026 (SCRUM-1833 comentario 22811)
      installedOn: 'Fecha de instalación', // APROBADO por el fundador el 25-nov-2026 (SCRUM-1833 comentario 22811)
      warrantyUntil: 'Garantía hasta', // APROBADO por el fundador el 25-nov-2026 (SCRUM-1833 comentario 22811)
    },
    garantia: 'Garantía hasta {fecha}', // APROBADO por el fundador el 25-nov-2026 (SCRUM-1833 comentario 22811)
    obligatorios: 'Escribe el tipo y el nombre del equipo.', // APROBADO por el fundador el 25-nov-2026 (SCRUM-1833 comentario 22811)
    errorCarga: 'No se pudieron cargar los equipos guardados. Inténtalo de nuevo.', // APROBADO por el fundador el 25-nov-2026 (SCRUM-1833 comentario 22811)
    generico: 'No se ha podido completar la acción. Vuelve a intentarlo.', // APROBADO por el fundador el 25-nov-2026 (SCRUM-1833 comentario 22811)
    editar: 'Editar', // APROBADO por el fundador el 25-nov-2026 (SCRUM-1833 comentario 22811)
    eliminar: '🗑 Eliminar', // APROBADO por el fundador el 25-nov-2026 (SCRUM-1833 comentario 22811)
    guardar: 'Guardar', // APROBADO por el fundador el 25-nov-2026 (SCRUM-1833 comentario 22811)
    cancelar: 'Cancelar', // APROBADO por el fundador el 25-nov-2026 (SCRUM-1833 comentario 22811)
    confirmarBorrar: '¿Borrar el equipo "{nombre}"? Los trabajos ligados a él lo perderán de su historial. Esta acción no se puede deshacer.', // APROBADO por el fundador el 25-nov-2026 (SCRUM-1833 comentario 22811)
  },
  /** El orden del formulario. `type` y `name` son los obligatorios (1-200, como el esquema del servidor). */
  ORDEN: ['type', 'name', 'brand', 'modelName', 'serialNumber', 'installedOn', 'warrantyUntil'],
  FECHAS: ['installedOn', 'warrantyUntil'],
  rellenar(texto, valores) {
    return String(texto).replace(/\{(\w+)\}/g, (m, k) => (valores && valores[k] !== undefined ? String(valores[k]) : m));
  },
  /**
   * `YYYY-MM-DD` → la fecha con el formato de la ficha (`toLocaleDateString('es-ES')`). Se construye en
   * hora LOCAL: `new Date('YYYY-MM-DD')` es medianoche UTC, y en una zona negativa saldría el día anterior.
   */
  fecha(ymd) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
    if (!m) return '';
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('es-ES');
  },
  /** «Garantía hasta {fecha}», o nada si no hay fecha (P5 ❌: no se compara con hoy). */
  garantia(ymd) {
    const f = EQUIPOS_CLIENTE.fecha(ymd);
    return f ? EQUIPOS_CLIENTE.rellenar(EQUIPOS_CLIENTE.TEXTOS.garantia, { fecha: f }) : '';
  },
  /**
   * Lo que viaja al servidor. Recortado; «ausente ≠ vacío»: un texto en blanco va `null` (así se BORRA
   * al editar) y una fecha en blanco va `''`, que es lo que el servidor guarda como null. Sin sitio (P3 ❌).
   */
  cuerpo(valores) {
    const v = valores || {};
    const out = {};
    EQUIPOS_CLIENTE.ORDEN.forEach((k) => {
      const t = String(v[k] === null || v[k] === undefined ? '' : v[k]).trim();
      if (k === 'type' || k === 'name' || EQUIPOS_CLIENTE.FECHAS.includes(k)) out[k] = t;
      else out[k] = t === '' ? null : t;
    });
    return out;
  },
};
if (typeof window !== 'undefined') window.equiposCliente = EQUIPOS_CLIENTE;

/**
 * Pinta la pestaña en `card`, con la forma y las clases de «Sitios» (`sitios-cliente__*`), sin hoja
 * nueva: alta y edición en el mismo formulario encima de la lista; borrar, solo admin y preguntando
 * (como «Documentos»). Todo con `textContent`: los datos los escribe el profesional.
 * `viva()` dice si esta apertura sigue siendo la última.
 */
function montarEquiposDelCliente(card, customerId, viva) {
  const E = EQUIPOS_CLIENTE;
  const T = E.TEXTOS;
  const puedeBorrarEquipo = window.appUserRole === 'admin';
  card.classList.add('sitios-cliente');

  const nuevo = document.createElement('button');
  nuevo.type = 'button';
  nuevo.className = 'btn btn-secondary sitios-cliente__nuevo';
  nuevo.dataset.accion = 'nuevo-equipo';
  nuevo.textContent = T.nuevo;
  card.appendChild(nuevo);

  const hueco = document.createElement('div');
  card.appendChild(hueco);

  const aviso = document.createElement('p');
  aviso.className = 'sitios-cliente__error';
  aviso.dataset.rol = 'aviso-equipos';
  aviso.setAttribute('role', 'alert');
  aviso.hidden = true;
  card.appendChild(aviso);
  function avisar(texto) { aviso.textContent = texto || ''; aviso.hidden = !texto; }

  const lista = document.createElement('ul');
  lista.className = 'sitios-cliente__lista';
  card.appendChild(lista);

  function linea(clase, texto) {
    const d = document.createElement('div');
    d.className = clase;
    d.textContent = texto;
    return d;
  }
  function boton(accion, texto, alPulsar) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn-ghost btn-sm';
    b.dataset.accion = accion;
    b.textContent = texto;
    b.addEventListener('click', () => alPulsar(b));
    return b;
  }

  function pintarLista(equipos) {
    lista.replaceChildren();
    if (!equipos.length) {
      const li = document.createElement('li');
      li.className = 'sitios-cliente__vacio';
      li.textContent = T.vacio;
      lista.appendChild(li);
      return;
    }
    equipos.forEach((q) => {
      const nombre = q.name || String(q.id);
      const li = document.createElement('li');
      li.className = 'sitios-cliente__fila';
      li.dataset.equipo = String(q.id);
      li.appendChild(linea('sitios-cliente__nombre', nombre));
      const queEs = [q.type, q.brand, q.modelName].filter((x) => x && String(x).trim()).join(' · ');
      if (queEs) li.appendChild(linea('sitios-cliente__direccion', queEs));
      const datos = [
        q.serialNumber ? `${T.CAMPOS.serialNumber}: ${q.serialNumber}` : '',
        E.fecha(q.installedOn) ? `${T.CAMPOS.installedOn}: ${E.fecha(q.installedOn)}` : '',
        E.garantia(q.warrantyUntil),
      ].filter(Boolean).join(' · ');
      if (datos) li.appendChild(linea('sitios-cliente__contacto', datos));
      const acciones = document.createElement('div');
      acciones.className = 'sitios-cliente__acciones';
      acciones.appendChild(boton('editar', T.editar, () => abrirFormulario(q)));
      // Borrar: solo admin (P4 de c.22811), y no es la acción principal: botón fantasma, al final, y pregunta.
      if (puedeBorrarEquipo) acciones.appendChild(boton('eliminar', T.eliminar, (b) => borrar(q, nombre, b)));
      li.appendChild(acciones);
      lista.appendChild(li);
    });
  }

  function cargar() {
    avisar('');
    return apiRequest(`/admin/customers/${customerId}/equipos`).then((r) => {
      if (!viva()) return;
      pintarLista(r && Array.isArray(r.equipos) ? r.equipos : []);
    }, (err) => {
      if (!viva()) return;
      // `handled` = la prueba vencida: `_pedir` ya ha llevado al profesional a Planes.
      if (err && err.handled) return;
      avisar(T.errorCarga);
    });
  }

  function borrar(q, nombre, b) {
    if (!window.confirm(E.rellenar(T.confirmarBorrar, { nombre }))) return;
    b.disabled = true;
    avisar('');
    apiRequest(`/admin/customers/${customerId}/equipos/${q.id}`, { method: 'DELETE' }).then(() => {
      if (viva()) cargar();
    }, (err) => {
      if (!viva()) return;
      b.disabled = false;
      if (err && err.handled) return;
      avisar(window.mensajeParaPersona(err, T.generico));
    });
  }

  /** Alta (`equipo` nulo) o edición: UN formulario a la vez, encima de la lista. */
  function abrirFormulario(equipo) {
    avisar('');
    const form = document.createElement('form');
    form.className = 'sitios-cliente__form';
    const campos = {};
    E.ORDEN.forEach((k) => {
      const caja = document.createElement('div');
      caja.className = 'field';
      const label = document.createElement('label');
      label.htmlFor = 'c360-equipo-' + k;
      label.textContent = T.CAMPOS[k];
      caja.appendChild(label);
      const input = document.createElement('input');
      input.type = E.FECHAS.includes(k) ? 'date' : 'text';
      if (!E.FECHAS.includes(k)) input.maxLength = 200;
      if (k === 'type') { input.required = true; input.placeholder = T.ejemploTipo; }
      if (k === 'name') { input.required = true; input.placeholder = T.ejemploNombre; }
      input.id = 'c360-equipo-' + k;
      input.name = k;
      input.className = 'input';
      input.value = equipo && equipo[k] != null ? String(equipo[k]) : '';
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
      E.ORDEN.forEach((k) => { valores[k] = campos[k].value; });
      const cuerpo = E.cuerpo(valores);
      // Sólo espacios: el `required` del navegador lo deja pasar y el servidor contestaría 400.
      if (!cuerpo.type || !cuerpo.name) {
        errorForm.textContent = T.obligatorios;
        errorForm.hidden = false;
        return;
      }
      guardar.disabled = true;
      errorForm.hidden = true;
      const peticion = equipo
        ? apiRequest(`/admin/customers/${customerId}/equipos/${equipo.id}`, { method: 'PUT', body: JSON.stringify(cuerpo) })
        : apiRequest(`/admin/customers/${customerId}/equipos`, { method: 'POST', body: JSON.stringify(cuerpo) });
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
    campos.type.focus();
  }

  nuevo.addEventListener('click', () => abrirFormulario(null));
  cargar();
}
// SCRUM-1833c · FIN

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

// ── SCRUM-1868b · ELIMINAR ESTE CLIENTE: tarjeta al final de la ficha + modal ────────────────────
/**
 * Los textos llevan su firma en SU línea (registro en
 * `docs/microcopy/2026-11-26-SCRUM-1868-eliminar-cliente.md`): la descripción de SCRUM-1868 («2-Los
 * textos valen»), c.22850 (el toast, «1-✅») y c.22867 (la fila de las solicitudes, detrás de
 * «Historial de actividad»). `generico` se REUSA byte a byte de FUSION_CLIENTE. `{nombre}`, `{n}` y
 * `{m}` son los huecos del lienzo. El servidor (SCRUM-1868a) contesta CÓDIGOS: cada motivo se traduce
 * por `MOTIVOS`, y uno fuera de la tabla cae en el genérico (regla 39, como la fusión).
 * Sin firma de grupo en la cabecera (el patrón de EQUIPOS_CLIENTE): `CUENTA_DEL_MOTIVO` y `estado`
 * son códigos, no textos, y los trozos que deriva `alertaBloqueo` llevan la suya en su línea.
 */
const BORRAR_CLIENTE = {
  TEXTOS: {
    tarjetaTitulo: 'Eliminar este cliente', // APROBADO por el fundador el 26-nov-2026 (SCRUM-1868 descripción, «2-Los textos valen»)
    tarjetaTexto: 'Se borra su ficha con sus documentos, sus sitios y sus equipos. No se puede deshacer. Si tiene presupuestos o facturas, no se puede eliminar.', // APROBADO por el fundador el 26-nov-2026 (SCRUM-1868 descripción, «2-Los textos valen»)
    tarjetaSoloAdmin: 'Solo lo ve el administrador.', // APROBADO por el fundador el 26-nov-2026 (SCRUM-1868 descripción, «2-Los textos valen»)
    boton: 'Eliminar cliente', // APROBADO por el fundador el 26-nov-2026 (SCRUM-1868 descripción, «2-Los textos valen»)
    titulo: 'Eliminar cliente', // APROBADO por el fundador el 26-nov-2026 (SCRUM-1868 descripción, «2-Los textos valen»)
    subtitulo: 'Revisa lo que se borra antes de confirmar', // APROBADO por el fundador el 26-nov-2026 (SCRUM-1868 descripción, «2-Los textos valen»)
    seBorra: 'Se borra', // APROBADO por el fundador el 26-nov-2026 (SCRUM-1868 descripción, «2-Los textos valen»)
    filaFicha: 'La ficha de {nombre}', // APROBADO por el fundador el 26-nov-2026 (SCRUM-1868 descripción, «2-Los textos valen»)
    FILAS: {
      documentos: 'Documentos adjuntos', // APROBADO por el fundador el 26-nov-2026 (SCRUM-1868 descripción, «2-Los textos valen»)
      sitios: 'Sitios', // APROBADO por el fundador el 26-nov-2026 (SCRUM-1868 descripción, «2-Los textos valen»)
      equipos: 'Equipos', // APROBADO por el fundador el 26-nov-2026 (SCRUM-1868 descripción, «2-Los textos valen»)
      historial: 'Historial de actividad', // APROBADO por el fundador el 26-nov-2026 (SCRUM-1868 descripción, «2-Los textos valen»)
      solicitudes: 'Solicitudes de presupuesto', // APROBADO por el fundador el 26-nov-2026 (SCRUM-1868 comentario 22867)
    },
    nota: 'Este cliente no tiene presupuestos ni facturas: por eso se puede eliminar.', // APROBADO por el fundador el 26-nov-2026 (SCRUM-1868 descripción, «2-Los textos valen»)
    irreversible: 'Esto no se puede deshacer.', // APROBADO por el fundador el 26-nov-2026 (SCRUM-1868 descripción, «2-Los textos valen»)
    cancelar: 'Cancelar', // APROBADO por el fundador el 26-nov-2026 (SCRUM-1868 descripción, «2-Los textos valen»)
    confirmar: 'Eliminar', // APROBADO por el fundador el 26-nov-2026 (SCRUM-1868 descripción, «2-Los textos valen»)
    bloqueo: 'No se puede eliminar a {nombre}. Tiene {n} facturas emitidas y {m} presupuestos, y una factura emitida no se borra.', // APROBADO por el fundador el 26-nov-2026 (SCRUM-1868 descripción, «2-Los textos valen»)
    loImpide: 'Lo que lo impide', // APROBADO por el fundador el 26-nov-2026 (SCRUM-1868 descripción, «2-Los textos valen»)
    MOTIVOS: {
      tiene_facturas: 'Facturas emitidas', // APROBADO por el fundador el 26-nov-2026 (SCRUM-1868 descripción, «2-Los textos valen»)
      tiene_presupuestos: 'Presupuestos', // APROBADO por el fundador el 26-nov-2026 (SCRUM-1868 descripción, «2-Los textos valen»)
    },
    salida: 'Puedes fusionarlo con otro cliente o dejarlo como está.', // APROBADO por el fundador el 26-nov-2026 (SCRUM-1868 descripción, «2-Los textos valen»)
    enlaceFusion: 'fusionarlo con otro cliente', // APROBADO por el fundador el 26-nov-2026 (SCRUM-1868 descripción, «2-Los textos valen»)
    cerrar: 'Cerrar', // APROBADO por el fundador el 26-nov-2026 (SCRUM-1868 descripción, «2-Los textos valen»)
    exito: 'Cliente eliminado', // APROBADO por el fundador el 26-nov-2026 (SCRUM-1868 comentario 22850)
    generico: 'No se ha podido completar la acción. Vuelve a intentarlo.', // APROBADO por el orquestador por delegación del fundador el 25-sep-2026 (SCRUM-1124 comentario 17002; se reusa byte a byte, como en FUSION_CLIENTE)
  },
  /** De qué cantidad de `cuenta` sale el número de cada motivo. */
  CUENTA_DEL_MOTIVO: { tiene_facturas: 'facturas', tiene_presupuestos: 'presupuestos' },
  rellenar(texto, valores) { return DOCUMENTOS_CLIENTE.rellenar(texto, valores); },
  numero(v) { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0; },
  /** El rótulo firmado de un motivo; `null` si el código no es uno de los dos. */
  motivo(codigo) {
    return Object.prototype.hasOwnProperty.call(BORRAR_CLIENTE.TEXTOS.MOTIVOS, codigo) ? BORRAR_CLIENTE.TEXTOS.MOTIVOS[codigo] : null;
  },
  /**
   * La alerta del bloqueo, DERIVADA del literal firmado sin palabras nuevas (la cláusula de la
   * descripción de SCRUM-1868, «se derivan sin cambiar las palabras»; confirmado por el orquestador J
   * sobre c.22850, que cierra los textos): el singular de cada cantidad y, si bloquea solo una de las dos, el trozo de la otra
   * fuera; sin facturas se va también la coletilla de la factura. `null` con cero de las dos.
   */
  alertaBloqueo(nombre, facturas, presupuestos) {
    const n = BORRAR_CLIENTE.numero(facturas);
    const m = BORRAR_CLIENTE.numero(presupuestos);
    if (!n && !m) return null;
    let t = BORRAR_CLIENTE.TEXTOS.bloqueo;
    if (n === 1) t = t.replace('{n} facturas emitidas', '1 factura emitida'); // APROBADO por el fundador el 26-nov-2026 (SCRUM-1868 descripción, «se derivan sin cambiar las palabras»)
    if (m === 1) t = t.replace('{m} presupuestos', '1 presupuesto'); // APROBADO por el fundador el 26-nov-2026 (SCRUM-1868 descripción, «se derivan sin cambiar las palabras»)
    if (!m) t = t.replace(' y {m} presupuestos', ''); // APROBADO por el fundador el 26-nov-2026 (SCRUM-1868 descripción, «se derivan sin cambiar las palabras»)
    if (!n) t = t.replace('{n} facturas emitidas y ', '').replace(', y una factura emitida no se borra.', '.'); // APROBADO por el fundador el 26-nov-2026 (SCRUM-1868 descripción, «se derivan sin cambiar las palabras»)
    return BORRAR_CLIENTE.rellenar(t, { nombre, n, m });
  },
  /**
   * Qué enseña el modal con un cuerpo: la previa (GET) o el de un 409 del DELETE, que no trae
   * `bloqueado` pero sí `motivos`. `revisar` (se puede eliminar), `bloqueado` (con sus motivos) o
   * `generico` (un motivo fuera de la tabla, o un cuerpo que no se entiende: no hay «Eliminar»).
   */
  estado(r) {
    if (!r || typeof r !== 'object' || !r.cuenta || typeof r.cuenta !== 'object') return { tipo: 'generico' };
    const motivos = Array.isArray(r.motivos) ? r.motivos : [];
    if (r.bloqueado === true || motivos.length) {
      if (!motivos.length || motivos.some((c) => BORRAR_CLIENTE.motivo(c) === null)) return { tipo: 'generico' };
      return { tipo: 'bloqueado', motivos };
    }
    return r.bloqueado === false ? { tipo: 'revisar' } : { tipo: 'generico' };
  },
};
if (typeof window !== 'undefined') window.borrarCliente = BORRAR_CLIENTE;

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
    container.innerHTML = '<p class="c360-vacio">Sin cliente seleccionado.</p>';
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
  let documentos = null;
  try {
    [data, historial, whatsapp, documentos] = await Promise.all([
      apiRequest(`/admin/customers/${id}/detail`),
      apiRequest(`/admin/customers/${id}/historial`).catch(() => null),
      pideWhatsapp ? apiRequest(`/admin/customers/${id}/whatsapp`).catch(() => null) : null,
      // SCRUM-1005d · la lista de documentos, para el número de la pestaña; aparte, como las dos de arriba.
      apiRequest(`/admin/customers/${id}/documentos`).catch(() => null),
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
    <div class="c360-identidad">
      <div class="c360-avatar">${initials}</div>
      <div>
        <h2 class="c360-nombre">${escC(customer.name)}</h2>
        <div class="c360-datos">
          ${telefonoHtml}
          ${movilHtml}
          ${whatsappHtml}
          ${correoHtml}
          <span class="c360-desde">Cliente desde ${new Date(customer.createdAt).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</span>
        </div>
        ${customer.notes ? `<div class="c360-notas">${escC(customer.notes)}</div>` : ''}
        ${proximaVisita ? `<div class="historial-proxima">${escC(HISTORIAL_CLIENTE.TEXTOS.proxima + proximaVisita)}</div>` : ''}
      </div>
    </div>
    <div class="c360-cabecera-acciones">
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
      tono: debt > 0 ? 'c360-rojo' : 'c360-verde' },
    { label: `${L.quotePlural || 'Presupuestos'}`, value: stats.totalQuotes, sub: `${stats.acceptedQuotes} aceptados` },
    { label: 'Facturas',  value: invoices.length, sub: `${invoices.filter(i=>i.status==='paid').length} pagadas` },
    { cifra: 'totalBilled', label: 'Facturado', value: fmt(stats.totalBilled), sub: '' },
    { cifra: 'totalPaid', label: 'Cobrado',   value: fmt(stats.totalPaid), sub: '', tono: 'c360-verde' },
    { cifra: 'profit', label: 'Beneficio', value: fmt(stats.profit), sub: '', tono: stats.profit >= 0 ? 'c360-verde' : 'c360-rojo' },
  ].filter((k) => !k.cifra || stats[k.cifra] !== undefined);

  kpis.forEach(({ label, value, sub, tono }) => {
    const k = document.createElement('div');
    k.className = 'kpi-card';
    k.innerHTML = `
      <div class="kpi-label">${label}</div>
      <div class="kpi-value c360-kpi-valor${tono ? ' ' + tono : ''}">${value}</div>
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
    actCard.innerHTML = '<h3 class="c360-actividad-titulo">Actividad reciente</h3>';

    const EV_ICON = {
      quote_sent: '📤', quote_accepted: '✅', quote_rejected: '✖',
      invoice_issued: '🧾', payment_received: '💰', quote_requested: '✏️',
      reminder_sent: '🔔', review_requested: '⭐',
    };
    const EV_COLOR = {
      quote_accepted: 'c360-verde', payment_received: 'c360-verde',
      quote_rejected: 'c360-rojo',
    };

    const list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:0';
    events.forEach((ev, i) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:12px;align-items:flex-start;padding:10px 0' +
        (i < events.length - 1 ? ';border-bottom:1px solid var(--neutral-100)' : '');
      const when = new Date(ev.createdAt).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      row.innerHTML = `
        <div class="c360-evento-icono">${EV_ICON[ev.type] || '•'}</div>
        <div class="c360-evento-cuerpo">
          <div class="c360-evento-titulo ${EV_COLOR[ev.type] || 'c360-tinta'}">${escC(ev.title)}</div>
          ${ev.detail ? `<div class="c360-evento-detalle">${escC(ev.detail)}</div>` : ''}
        </div>
        <div class="c360-evento-hora">${escC(when)}</div>
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
  // SCRUM-1833c · justo detrás de «Sitios», igual que ella: sin número, y su lista se pide al abrirla.
  tabsWrap.appendChild(makeTab(EQUIPOS_CLIENTE.TEXTOS.pestana, 'equipos'));
  // SCRUM-1132c · la sexta, igual que «Sitios»: sin número, y sus notas se piden al abrirla.
  // Rutas `requireRole('admin')`: al técnico ni se le pinta la pestaña ni se le piden.
  if (window.appUserRole === 'admin') tabsWrap.appendChild(makeTab(NOTAS_CLIENTE.TEXTOS.titulo, 'notas'));
  // SCRUM-1005d · «Documentos (n)», con el mismo mecanismo que «Trabajos»: solo si la lista llegó.
  // Al abrirla se vuelve a pedir (y su número se repinta al subir o borrar).
  const tabDocumentos = documentos && Array.isArray(documentos.documentos)
    ? makeTab(DOCUMENTOS_CLIENTE.tituloPestana(documentos.documentos.length), 'documentos')
    : null;
  if (tabDocumentos) tabsWrap.appendChild(tabDocumentos);
  let peticionDocumentos = 0;
  let peticionEquipos = 0;
  wrap.appendChild(tabsWrap);
  wrap.appendChild(tabContent);

  // SCRUM-1868b · «Eliminar este cliente», al final y DESPUÉS de las pestañas (opción B de SCRUM-1868).
  // Las rutas son `requireRole('admin')`: con la condición de «Fusionar», a quien no lo es ni se le pinta.
  if (window.appUserRole === 'admin') {
    const TB = BORRAR_CLIENTE.TEXTOS;
    const parte = (tag, clase, texto) => { const n = document.createElement(tag); n.className = clase; n.textContent = texto; return n; };
    const tarjeta = document.createElement('div');
    tarjeta.className = 'customers-card';
    tarjeta.dataset.rol = 'borrar-cliente';
    tarjeta.appendChild(parte('h3', 'section-title', TB.tarjetaTitulo));
    tarjeta.appendChild(parte('p', 'fusion-linea', TB.tarjetaTexto));
    tarjeta.appendChild(parte('p', 'c360-ayuda', TB.tarjetaSoloAdmin));
    // Secundario con el texto en Peligro-tinta: `gasto-opcion-eliminar` es la clase que ya existe con
    // `--danger-ink` (la del «Eliminar» de gastos). Sin `btn-sm`: 44 px en todas las anchuras
    // (SCRUM-1845 c.22728), con la regla del bloque SCRUM-1868b de `styles.css`.
    const botonBorrar = parte('button', 'btn btn-secondary gasto-opcion-eliminar', TB.boton);
    botonBorrar.type = 'button';
    botonBorrar.dataset.accion = 'abrir-borrado';
    botonBorrar.addEventListener('click', () => abrirBorradoDeCliente(customer, id, container));
    tarjeta.appendChild(botonBorrar);
    wrap.appendChild(tarjeta);
  }

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
    if (key === 'equipos') {
      const esta = ++peticionEquipos;
      montarEquiposDelCliente(card, id, () => esta === peticionEquipos);
      return;
    }
    if (key === 'documentos') {
      const esta = ++peticionDocumentos;
      montarDocumentosDelCliente(card, id, () => esta === peticionDocumentos,
        (n) => { tabDocumentos.textContent = DOCUMENTOS_CLIENTE.tituloPestana(n); });
      return;
    }
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
        tbody.innerHTML = `<tr><td colspan="5" class="c360-tabla-vacia">Sin ${L.quotePlural||'presupuestos'}</td></tr>`;
      }
      quotes.forEach(q => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="c360-celda-numero">#${q.quoteNumber ?? q.id}</td>
          <td class="c360-celda-fecha">${new Date(q.createdAt).toLocaleDateString('es-ES')}</td>
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
        tbody.innerHTML = `<tr><td colspan="5" class="c360-tabla-vacia">Sin facturas</td></tr>`;
      }
      invoices.forEach(inv => {
        const tr = document.createElement('tr');
        const pdfCell = inv.pdfUrl && inv.pdfUrl !== 'PENDING_PDF'
          ? `<a href="${inv.pdfUrl}" target="_blank" class="btn-ghost btn-sm c360-sin-subrayado">PDF</a>`
          : '';
        tr.innerHTML = `
          <td class="c360-celda-numero">${escC(inv.number)}</td>
          <td class="c360-celda-fecha">${new Date(inv.createdAt).toLocaleDateString('es-ES')}</td>
          <td class="amount">${fmt(Number(inv.total), inv.currency)}</td>
          <td><span class="status-pill ${STATUS_CLASS[inv.status]||'status-pill-draft'}">${STATUS_LABELS[inv.status]||inv.status}</span></td>
          <td>
            <div class="c360-celda-acciones">
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

// ── SCRUM-1868b · Eliminar cliente ─────────────────────────────────────────────
// Abrir → previa (GET, no escribe nada) → «Eliminar» → DELETE. El DELETE solo sale de ese botón, y
// el botón solo se habilita con una previa NO bloqueada en pantalla (`listo`). Un 409 al pulsar
// (entre mirar y pulsar alguien pudo emitir una factura) repinta el bloqueo con SU cuerpo.
function abrirBorradoDeCliente(customer, customerId, container) {
  const B = BORRAR_CLIENTE;
  const T = B.TEXTOS;
  const nombre = customer && customer.name ? customer.name : '';
  const el = (tag, clase, texto) => {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto !== undefined) n.textContent = texto;
    return n;
  };

  const overlay = el('div', 'modal-overlay');
  overlay.dataset.rol = 'modal-borrar-cliente';
  const modal = el('div', 'modal');
  const cerrar = () => overlay.remove();
  modal.appendChild(cabeceraModal({ titulo: T.titulo, sinCierre: true }));
  const cuerpo = el('div', 'modal-body');
  const previa = el('div', 'fusion-previa');
  const aviso = el('div', 'alert error');
  aviso.dataset.rol = 'aviso-borrar';
  cuerpo.appendChild(previa);
  cuerpo.appendChild(aviso);
  modal.appendChild(cuerpo);

  const pie = el('div', 'modal-footer');
  const boton = (clase, texto, accion) => { const b = el('button', clase, texto); b.type = 'button'; b.dataset.accion = accion; return b; };
  const cancelar = boton('btn btn-secondary', T.cancelar, 'cancelar-borrado');
  const confirmar = boton('btn btn-danger', T.confirmar, 'confirmar-borrado');
  confirmar.disabled = true;
  const cerrarBtn = boton('btn btn-secondary', T.cerrar, 'cerrar-borrado');
  cerrarBtn.hidden = true;
  pie.appendChild(cancelar);
  pie.appendChild(confirmar);
  pie.appendChild(cerrarBtn);
  modal.appendChild(pie);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
  cancelar.addEventListener('click', cerrar);
  cerrarBtn.addEventListener('click', cerrar);

  // `true` solo con una previa NO bloqueada en pantalla: el botón desactivado Y el clic que no llama.
  let listo = false;
  const mostrarError = (texto) => { aviso.textContent = texto || ''; };
  const tabla = (filas) => {
    const t = el('table', 'table');
    const tb = el('tbody');
    filas.forEach(([rotulo, n]) => {
      const tr = el('tr');
      tr.appendChild(el('td', '', rotulo));
      tr.appendChild(el('td', 'c360-celda-numero', String(n)));
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    return t;
  };

  const pintarRevision = (c) => {
    previa.innerHTML = '';
    previa.appendChild(el('p', 'fusion-linea fusion-contados', T.subtitulo));
    previa.appendChild(el('h4', 'fusion-previa-titulo', T.seBorra));
    const filas = [[B.rellenar(T.filaFicha, { nombre }), 1]];
    Object.keys(T.FILAS).forEach((k) => filas.push([T.FILAS[k], B.numero(c[k])]));
    previa.appendChild(tabla(filas));
    previa.appendChild(el('p', 'fusion-linea', T.nota));
    previa.appendChild(el('p', 'fusion-irreversible', T.irreversible));
    listo = true;
    confirmar.disabled = false;
  };

  const pintarBloqueo = (motivos, c) => {
    previa.innerHTML = '';
    listo = false;
    confirmar.disabled = true;
    confirmar.hidden = true;
    cancelar.hidden = true;
    cerrarBtn.hidden = false;
    const cuanto = (k) => (motivos.includes(k) ? B.numero(c[B.CUENTA_DEL_MOTIVO[k]]) : 0);
    const alerta = B.alertaBloqueo(nombre, cuanto('tiene_facturas'), cuanto('tiene_presupuestos'));
    if (!alerta) { mostrarError(T.generico); return; }
    previa.appendChild(el('div', 'alert error', alerta));
    previa.appendChild(el('h4', 'fusion-previa-titulo', T.loImpide));
    previa.appendChild(tabla(motivos.map((k) => [T.MOTIVOS[k], cuanto(k)])));
    // La frase firmada entera, con su trozo «fusionarlo con otro cliente» como enlace al modal de fusión.
    const salida = el('p', 'fusion-linea');
    const i = T.salida.indexOf(T.enlaceFusion);
    salida.appendChild(el('span', '', T.salida.slice(0, i)));
    const enlace = el('a', 'contacto-link', T.enlaceFusion);
    enlace.href = '#';
    enlace.dataset.accion = 'fusionar-en-vez';
    enlace.addEventListener('click', (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      cerrar();
      abrirFusionDeClientes(customer, customerId, container);
    });
    salida.appendChild(enlace);
    salida.appendChild(el('span', '', T.salida.slice(i + T.enlaceFusion.length)));
    previa.appendChild(salida);
  };

  const pintar = (r) => {
    const e = B.estado(r);
    mostrarError('');
    if (e.tipo === 'revisar') pintarRevision(r.cuenta);
    else if (e.tipo === 'bloqueado') pintarBloqueo(e.motivos, r.cuenta);
    else { listo = false; confirmar.disabled = true; mostrarError(T.generico); }
  };

  confirmar.addEventListener('click', async () => {
    if (!listo) return;
    listo = false;
    confirmar.disabled = true;
    cancelar.disabled = true;
    mostrarError('');
    try {
      await apiRequest(`/admin/customers/${customerId}`, { method: 'DELETE' });
    } catch (err) {
      cancelar.disabled = false;
      if (err && err.status === 409 && B.estado(err.data).tipo === 'bloqueado') { pintar(err.data); return; }
      mostrarError(window.mensajeParaPersona(err, T.generico));
      // Un 409 sin motivo de la tabla o un 404 no cambian reintentando: no se vuelve a ofrecer.
      if (!(err && (err.status === 409 || err.status === 404))) { listo = true; confirmar.disabled = false; }
      return;
    }
    cerrar();
    if (typeof window.showToast === 'function') window.showToast(T.exito);
    // La misma vuelta que «← Volver a Clientes».
    if (typeof window.renderAppView === 'function') window.renderAppView('customers');
  });

  apiRequest(`/admin/customers/${customerId}/borrado-previa`)
    .then(pintar)
    .catch((err) => mostrarError(window.mensajeParaPersona(err, T.generico)));
}

// ── SCRUM-1781d · el prefijo aparte en «Editar cliente», como en «Nuevo cliente» ──────────
//
// Decisión del fundador: SCRUM-1781 c.22392 (revisa la de SCRUM-590 que dejaba esta pantalla sin
// selector). Lo GUARDADO no cambia de formato: dígitos con el prefijo delante, sin «+».
//
// 🔴 LA REGLA ES UNA COPIA LITERAL de `numeroCompleto` y `repartirNumero` (`customersView.js`), y
// no un import, a propósito: allí viven DENTRO de la vista (no se exportan), y los guards de
// SCRUM-578 leen EXACTAMENTE esa región de aquel fichero; sacarla a un módulo los dejaría vigilando
// un delegador vacío. Que las dos copias digan lo mismo NO se confía a este comentario: lo mide
// `tests/scrum1781d-editar-cliente-con-prefijo.test.mjs`, que guarda en las dos pantallas con el
// mismo prefijo y lo mismo tecleado y compara el cuerpo. Es lo mismo que hizo J3 en
// `onboardingView.js` (SCRUM-1781b).

/** Mete el campo en una fila `.campo-telefono` con su propio selector de prefijo (+34). */
function filaConPrefijo(input, nombre) {
  const sel = window.prefijosPais.selectorDePrefijo({});
  sel.name = nombre;
  const fila = document.createElement('div');
  fila.className = 'campo-telefono';
  const campo = input.parentNode;
  // Se MUEVE el campo, no se quita: conserva su id y sus oyentes.
  fila.appendChild(sel);
  fila.appendChild(input);
  campo.appendChild(fila);
  return sel;
}

/** Junta prefijo + número, sin duplicar el prefijo si ya va escrito (copia de `numeroCompleto`). */
function numeroConPrefijo(input, sel) {
  const numero = input.value.trim().replace(/\s/g, '');
  if (!numero) return '';
  const prefijo = (sel && sel.value) || window.prefijosPais.ESPANA.prefijo;
  const yaLoLleva = numero.startsWith(prefijo) || numero.startsWith('+' + prefijo) || numero.startsWith('00' + prefijo);
  return yaLoLleva ? numero : prefijo + numero;
}

/**
 * Reparte lo guardado entre el selector y el campo (copia de `repartirNumero`). Si no empieza por
 * ningún prefijo conocido, el número se deja ENTERO y el selector en España: nunca se trocea a
 * ciegas.
 */
function repartirConPrefijo(guardado, input, sel) {
  const limpio = String(guardado || '').replace(/[\s\-()]/g, '').replace(/^\+/, '');
  const prefijos = window.prefijosPais.listaDePrefijos().map((p) => p.prefijo)
    .sort((a, b) => b.length - a.length); // el más largo primero: `1` no puede ganarle a `1809`
  for (const p of prefijos) {
    if (limpio.length > p.length && limpio.startsWith(p)) {
      sel.value = p;
      input.value = limpio.slice(p.length);
      return;
    }
  }
  sel.value = window.prefijosPais.ESPANA.prefijo;
  input.value = limpio;
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
    <div class="modal-body c360-editar-cuerpo">
      <!-- SCRUM-574 (CONT-01): hueco para el switch Empresa/Persona. Va PRIMERO porque decide qué
           campos tienen sentido debajo. El nodo se inserta después: el switch es un componente con
           comportamiento (switchFormaJuridica.js) y una plantilla de texto no puede tenerlo.
           SIN COMILLAS INVERSAS AQUÍ DENTRO: esto vive en un template literal y una comilla
           inversa lo CIERRA — el navegador descarta el fichero entero. Es el defecto histórico de
           exportView que la suite vigila en «② ROJO: backtick dentro del template». -->
      <div id="e360-forma"></div>
      <div class="field"><label>Nombre</label><input type="text" id="e360-name"/></div>
      <div class="field"><label>Teléfono</label><input type="text" id="e360-phone"/></div>
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
        <div class="c360-ayuda">Solo sirve para avisarte de que toca facturarle. YaQu nunca factura ni envía nada solo — y el plazo legal manda por encima de lo que pactes.</div>
      </div>
      <div class="field"><label>¿Factura como empresa o autónomo (IVA)?</label>
        <select id="e360-tipodestinatario" class="input">
          <option value="">Sin clasificar</option>
          <option value="PARTICULAR">Particular</option>
          <option value="EMPRESARIO">Empresa / profesional</option>
        </select>
      </div>
      <div class="field"><label>Notas</label><textarea id="e360-notes" rows="3" class="c360-redimensionable"></textarea></div>
      <label class="inline-checkbox c360-casilla">
        <input type="checkbox" id="e360-waoptout"/> Baja de WhatsApp: no enviarle más mensajes (el cliente lo pidió)
      </label>
      <div class="alert error c360-oculto" id="e360-alert"></div>
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
  // SCRUM-1781d · el prefijo en su propio desplegable, +34 por defecto, como «Nuevo cliente». Cada
  // número lleva SU selector (la razón está en `customersView.js`, SCRUM-590: compartirlo haría
  // que el móvil se recompusiera con el prefijo del fijo).
  const selPrefijoTelefono = filaConPrefijo($('#e360-phone'), 'prefijoPais');
  const selPrefijoMovil = filaConPrefijo($('#e360-mobile'), 'prefijoPaisMovil');
  repartirConPrefijo(customer.phone || '', $('#e360-phone'), selPrefijoTelefono);
  // SCRUM-590 (CONT-19): sin esta línea, editar un cliente que TIENE móvil lo enseñaría vacío.
  // Y como el vacío no viaja (ver el guardado), el profesional creería haberlo borrado sin
  // haberlo borrado — que es peor que perderlo: es mentir sobre él.
  repartirConPrefijo(customer.mobile || '', $('#e360-mobile'), selPrefijoMovil);
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
  // ═══ SCRUM-590 (CONT-19) → SCRUM-1781d · EL PREFIJO DE ESTA PANTALLA
  //
  // SCRUM-590 dejó esta pantalla SIN selector de prefijo: la regla vivía sólo en
  // `customersView.js` y copiarla abría dos sitios donde divergir. El fundador lo revisó
  // (SCRUM-1781 c.22392): ahora el fijo y el móvil llevan cada uno su selector, y la copia de la
  // regla (arriba, `numeroConPrefijo`/`repartirConPrefijo`) la vigila un test que compara las dos
  // pantallas por efecto, que es lo que faltaba entonces. Con eso deja de poder guardarse aquí un
  // «600111222» sin prefijo cuando el selector está en España.
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
    const phone = numeroConPrefijo($('#e360-phone'), selPrefijoTelefono);
    const mobile = numeroConPrefijo($('#e360-mobile'), selPrefijoMovil); // SCRUM-590 (CONT-19)
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
