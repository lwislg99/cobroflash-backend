// src/core/http/adminRouteDeclarations.ts — SCRUM-55 (red fail-closed, S1)
//
// La tabla S1 dice: "ruta nueva = declara rol mínimo; default Admin-only".
// Aquí vive la mitad que NO se declara con requireRole: las rutas que un Técnico
// (Operario) SÍ puede usar. Toda ruta /admin debe estar en EXACTAMENTE uno de estos
// dos sitios, o el test tests/scrum55-admin-fail-closed.test.mjs falla nombrándola:
//
//   1. declara requireRole(...) en su montaje, en un router.use o en la propia ruta
//   2. está listada aquí abajo, con motivo
//
// Eso invierte el default: una ruta nueva sin declaración NO nace abierta, nace roja.
//
// ⚠️ Añadir una entrada a TECNICO_ALLOWED es una DECISIÓN DE PERMISOS, no un trámite
// para poner el test en verde. El motivo de cada línea es lo que revisa el humano.

export interface RouteDeclaration {
  method: string;
  /** Path tal y como lo monta Express, con sus params (:id). */
  path: string;
  /** Por qué el Técnico puede con esto. Una línea. Obligatorio. */
  why: string;
}

/**
 * Rutas /admin visibles para el rol Técnico ("Operario").
 * Criterio S1: "Quotes/clientes/productos crear-ver · enviar WA · ver landing" ✅,
 * "facturas: ver sí". Todo lo demás es Admin por defecto.
 */
export const TECNICO_ALLOWED: ReadonlyArray<RouteDeclaration> = [
  // Sesión y negocio (perfil REDUCIDO para técnico — el filtrado vive en app.ts)
  { method: 'GET', path: '/admin/me', why: 'Perfil de la propia sesión; no expone datos de otros' },
  { method: 'GET', path: '/admin/merchant', why: 'Perfil del negocio REDUCIDO para técnico (sin NIF/IBAN/serie); el recorte vive en app.ts' },

  // Clientes — S1: "clientes crear-ver" ✅ (el BORRADO es admin, ver customersAdmin.routes.ts)
  { method: 'GET',  path: '/admin/customers', why: 'Ver la cartera de clientes es trabajo de campo' },
  { method: 'POST', path: '/admin/customers', why: 'S1: clientes crear-ver ✅' },
  { method: 'GET',  path: '/admin/customers/:id', why: 'S1: clientes crear-ver ✅' },
  { method: 'PUT',  path: '/admin/customers/:id', why: 'Corregir teléfono/dirección desde la obra' },
  { method: 'GET',  path: '/admin/customers/:id/detail', why: 'Ficha e historial del cliente que va a visitar' },
  { method: 'GET',  path: '/admin/customers/:id/portal-url', why: 'Link del portal para dárselo al cliente en mano' },

  // Presupuestos — S1: "quotes crear-ver · enviar WA" ✅. EMITIR FACTURA no (ver /invoice).
  { method: 'GET',  path: '/admin/quotes', why: 'S1: quotes crear-ver ✅' },
  { method: 'GET',  path: '/admin/quotes/:id', why: 'S1: quotes crear-ver ✅' },
  { method: 'GET',  path: '/admin/quotes/:id/pdf', why: 'Enseñar el presupuesto al cliente en la obra' },
  { method: 'PUT',  path: '/admin/quotes/:id/notes', why: 'Notas internas del trabajo' },
  { method: 'POST', path: '/admin/quotes/:id/accept', why: 'Registrar la aceptación del cliente delante del cliente' },
  { method: 'POST', path: '/admin/quotes/:id/reject', why: 'Registrar el rechazo; simétrico de accept' },
  { method: 'POST', path: '/admin/quotes/:id/send-whatsapp', why: 'S1: "enviar WA" ✅ explícito' },
  { method: 'POST', path: '/admin/quotes/:id/send-email', why: 'Mismo envío que WA por otro canal' },

  // Facturas — S1: "Facturas: emitir/anular/R1 ❌ (VER SÍ)". Solo lectura.
  { method: 'GET', path: '/admin/invoices', why: 'S1: ver facturas ✅' },
  { method: 'GET', path: '/admin/invoices/:id', why: 'S1: ver facturas ✅' },
  { method: 'GET', path: '/admin/invoices/:id/pdf', why: 'S1: ver facturas ✅ (solo lectura, no regenera)' },

  // Trabajos — A13/JOB-1. Además hay filtro ROW-LEVEL por operarioId (SCRUM-23):
  // el técnico solo ve los suyos. Esa segunda capa la cubre tenancy-permisos.test.mjs.
  { method: 'GET',   path: '/admin/jobs', why: 'Su agenda; filtrada por operarioId (SCRUM-23)' },
  { method: 'GET',   path: '/admin/jobs/:id', why: 'Detalle de SU trabajo; 404 en el ajeno (SCRUM-23)' },
  { method: 'PATCH', path: '/admin/jobs/:id', why: 'Mover el estado del trabajo es su trabajo (FSM JOB-1)' },
  { method: 'GET',   path: '/admin/jobs/:id/ics', why: 'Su cita en el calendario del móvil' },
  { method: 'POST',  path: '/admin/jobs/:id/albaranes', why: 'Crear el parte de trabajo en la obra (albarán NO fiscal)' },

  // Albaranes — SCRUM-14/47/49: partes de trabajo NO fiscales, el caso de uso del
  // Operario por definición. Firmar/enviar es explícito en SCRUM-47.
  { method: 'PATCH', path: '/admin/albaranes/:id', why: 'Rellenar el parte en la obra (SCRUM-14)' },
  // SCRUM-302 (C2): la FICHA del albarán. Va al operario porque negarle LEER el parte mientras
  // puede rellenarlo, emitirlo y firmarlo (las líneas de al lado) sería incoherente: es la misma
  // pantalla de su trabajo de campo, solo que ahora tiene página propia en vez de ser una fila.
  // Solo lectura y filtrada por merchant, como el resto.
  { method: 'GET',   path: '/admin/albaranes/:id', why: 'Ver la ficha del parte que él mismo rellena y firma (SCRUM-302)' },
  { method: 'POST',  path: '/admin/albaranes/:id/emitir', why: 'Emitir ALBARÁN (no factura): documento NO fiscal' },
  { method: 'POST',  path: '/admin/albaranes/:id/firmar', why: 'Firma del cliente en el móvil del operario (SCRUM-49)' },
  { method: 'GET',   path: '/admin/albaranes/:id/pdf', why: 'Enseñar/enviar el parte firmado' },
  { method: 'POST',  path: '/admin/albaranes/:id/fotos', why: 'Fotos del trabajo hecho (MEDIA-1)' },
  { method: 'GET',   path: '/admin/albaranes/:id/fotos', why: 'Ver las fotos que él mismo subió' },
  { method: 'POST',  path: '/admin/albaranes/:id/enviar-whatsapp', why: 'S1 "enviar WA" ✅; requireActivePlan, sin rol (SCRUM-47)' },
  { method: 'POST',  path: '/admin/albaranes/:id/enviar-para-firmar', why: 'Firma remota del albarán (SCRUM-47/49)' },
  { method: 'GET',   path: '/admin/albaranes/pendientes-facturar', why: 'SCRUM-69: bandeja de facturación, mismo criterio S1 que GET /admin/invoices ("facturas: ver sí")' },
  { method: 'GET',   path: '/admin/albaranes/consolidables', why: 'SCRUM-70: vista previa de la recapitulativa (cliente+mes). MISMO criterio que la bandeja de SCRUM-69 — es la misma información, agrupada: solo lectura y ningún dato que el técnico no vea ya ahí. NO emite.' },

  // Productos — S1: "productos crear-ver" ✅. El tarifario en bloque (export/import/
  // load-catalog) NO está clasificado: ver PENDIENTE_CLASIFICAR.
  { method: 'GET',    path: '/admin/products', why: 'S1: productos crear-ver ✅' },
  { method: 'GET',    path: '/admin/products/:id', why: 'S1: productos crear-ver ✅' },
  { method: 'POST',   path: '/admin/products', why: 'S1: productos crear-ver ✅' },
  { method: 'PUT',    path: '/admin/products/:id', why: 'Corregir un precio suelto al presupuestar' },
  { method: 'DELETE', path: '/admin/products/:id', why: 'Simétrico del alta; una línea de catálogo, no el tarifario' },
  { method: 'GET',    path: '/admin/products/autocomplete', why: 'Autocompletar al montar el presupuesto' },
  // SCRUM-162: misma familia que el autocompletado —alimenta el mismo campo del editor— y no
  // enseña nada que el técnico no vea ya: son conceptos de los presupuestos de SU merchant,
  // acotados por `req.merchantId`. Sin importes, sin clientes, sin datos de terceros.
  { method: 'GET',    path: '/admin/products/frequent-concepts', why: 'Sus conceptos más usados al montar el presupuesto' },
  { method: 'GET',    path: '/admin/products/ping', why: 'Healthcheck del módulo, sin datos' },
  { method: 'GET',    path: '/admin/providers/ping', why: 'Healthcheck del módulo, sin datos' },

  // Solicitudes entrantes, adjuntos, búsqueda y bot
  { method: 'GET',   path: '/admin/quote-requests', why: 'Solicitudes entrantes que va a presupuestar' },
  { method: 'PATCH', path: '/admin/quote-requests/:id', why: 'Marcar la solicitud como atendida' },
  { method: 'GET',   path: '/admin/attachments/:id', why: 'Fotos que mandó el cliente con la solicitud' },
  { method: 'GET',   path: '/admin/search', why: 'Busca clientes/quotes/facturas: todo ello ya es visible para él' },
  { method: 'GET',   path: '/admin/bot/handoffs', why: 'Conversaciones del bot que piden persona (A8.3)' },

  // IA — ayuda a redactar/montar el presupuesto, que es su trabajo. Consume API de
  // pago: si algún día hay que limitarlo, es una cuota, no un permiso de rol.
  { method: 'POST', path: '/admin/ai/suggest-quote', why: 'Ayuda a montar el presupuesto (su trabajo)' },
  { method: 'POST', path: '/admin/ai/quote-message', why: 'Ayuda a redactar el mensaje del presupuesto' },
  // SCRUM-71 (VOZ-ALB): el operario es JUSTO quien dicta esto, en obra y con una mano. No
  // escribe nada que no pudiera escribir a mano en el mismo albarán: devuelve líneas
  // propuestas, no las guarda. Y la ruta ya está cerrada por dos sitios más — el flag
  // VOICE_ALBARAN_ENABLED y que el albarán tiene que ser suyo y estar en borrador.
  { method: 'POST', path: '/admin/ai/suggest-albaran-lines', why: 'Dicta el parte en obra: es su trabajo' },

  // Gastos — SCRUM-107. El fundador partió el router POR VERBO: CREAR es campo, LEER el
  // conjunto no. Solo estas dos quedan abiertas; las otras cinco llevan requireRole.
  { method: 'POST', path: '/admin/expenses', why: 'SCRUM-107: compra material en el almacén y lo registra desde la furgoneta' },
  { method: 'GET',  path: '/admin/expenses/categories', why: 'SCRUM-107: lista estática que necesita el formulario de alta; sin datos del negocio' },
];

// ─────────────────────────────────────────────────────────────────────────────
// ⚠️⚠️  LISTA TEMPORAL — TIENE QUE MENGUAR HASTA CERO  ⚠️⚠️
//
// Creada el 2026-07-22 (SCRUM-55) con 25 entradas. El fundador ordenó cerrar primero
// el Nivel 1 (dinero/fiscal) y el resto "por tandas" (D4). Estas son ese resto: NO
// están clasificadas, solo aparcadas, y hoy siguen ABIERTAS al Operario.
//
// Una lista de pendientes que nunca mengua es tener el test en verde sin hacer nada
// — exactamente el patrón que SCRUM-55 combate. Por eso el test impone DOS frenos:
//   · RATCHET: nunca puede crecer por encima de PENDIENTE_MAX. Ruta nueva → se
//     declara, no se aparca aquí.
//   · CADUCIDAD: pasada REVISAR_ANTES_DE el test FALLA. Mover la fecha es una
//     decisión consciente del fundador, no un despiste.
// ─────────────────────────────────────────────────────────────────────────────

export interface PendingDeclaration {
  method: string;
  path: string;
  /** Tanda en la que se clasifica. */
  tanda: 2 | 3;
  /** Qué hay que decidir. */
  duda: string;
}

export const PENDIENTE_CLASIFICAR: ReadonlyArray<PendingDeclaration> = [
  // TANDA 2 — economía del negocio.
  // /admin/expenses SALIÓ de aquí en SCRUM-107: era la única duda de producto real y la
  // resolvió el fundador partiendo el router POR VERBO (crear ✅ / leer 🔒), no en bloque.
  // Las 7 rutas están ahora declaradas: 2 abajo en TECNICO_ALLOWED, 5 con requireRole.

  { method: 'GET', path: '/admin/metrics/home', tanda: 2, duda: 'KPIs de ingresos del negocio → probable admin' },
  { method: 'GET', path: '/admin/metrics/funnel', tanda: 2, duda: 'Embudo comercial → probable admin' },
  { method: 'GET', path: '/admin/metrics/services', tanda: 2, duda: 'Servicios más vendidos → probable admin' },
  { method: 'GET', path: '/admin/metrics/whatsapp', tanda: 2, duda: 'Coste y entrega de WA del merchant → probable admin' },
  { method: 'GET', path: '/admin/metrics/platform-funnel', tanda: 2, duda: 'Ya tiene gate propio por isVerifiedPlatformOwner (SCRUM-102, más estricto que admin) pero INLINE: hacerlo visible' },

  // TANDA 3 — configuración y datos en bloque. Ninguna es flujo de campo evidente;
  // se aparcan por volumen y porque tocarlas mueve el nav del dashboard.
  // SCRUM-365: SALEN `/admin/products/import` y `/admin/products/load-catalog`, declaradas con
  // `requireRole('admin')`. No hacía falta decidir nada nuevo: su duda ya proponía admin y el
  // criterio estaba escrito arriba, en el motivo de `DELETE /admin/products/:id` («una línea de
  // catálogo, no el tarifario»). Lo que las mantenía aquí no era una duda, era la tarea sin hacer
  // — igual que le pasó a `/admin/products/export` en SCRUM-103.
  // SCRUM-312: y con ella sale `/admin/customers/import`, por el mismo criterio: un alta
  // MASIVA de clientes es catalogo entero, no una linea suelta.
  { method: 'GET',    path: '/admin/providers', tanda: 3, duda: 'Proveedores: ligado a compras/gastos → probable admin' },
  { method: 'POST',   path: '/admin/providers', tanda: 3, duda: 'Ídem' },
  { method: 'PUT',    path: '/admin/providers/:id', tanda: 3, duda: 'Ídem' },
  { method: 'DELETE', path: '/admin/providers/:id', tanda: 3, duda: 'Ídem' },
  { method: 'GET',    path: '/admin/templates', tanda: 3, duda: 'Plantillas de mensaje: leerlas puede ser ✅, escribirlas es configuración' },
  { method: 'POST',   path: '/admin/templates', tanda: 3, duda: 'Escribir plantillas = configuración → probable admin' },
  { method: 'PUT',    path: '/admin/templates/:id', tanda: 3, duda: 'Ídem' },
  { method: 'DELETE', path: '/admin/templates/:id', tanda: 3, duda: 'Ídem' },
];

/**
 * Tope del ratchet: la lista puede menguar, JAMÁS crecer. Bajarlo al vaciar cada tanda.
 *
 * 25 → 24 (SCRUM-55): sale /admin/metrics/team, cerrada con requireRole tras verla en 200
 * contra PRODUCCIÓN con sesión de Operario.
 *
 * 24 → 17 (SCRUM-107): salen las 7 de /admin/expenses, clasificadas por verbo.
 * 17 → 16 (SCRUM-103): sale /admin/products/export. No la sacó una revisión humana:
 * la cazó el assert nuevo, porque su propia "duda" decía que S1 ya lo había decidido.
 * 16 → 14 (SCRUM-365): salen /admin/products/import y /admin/products/load-catalog, las dos con
 * requireRole('admin'). Lo que las delató fue la ASIMETRÍA, no una revisión: `export` (leer el
 * tarifario) exigía admin desde SCRUM-103 y estas dos (reescribirlo) seguían abiertas — lo
 * protegido era leer y lo abierto, escribir. Y el criterio ya estaba escrito arriba, en el motivo
 * de DELETE /admin/products/:id: «una línea de catálogo, no el tarifario».
 *
 * BAJAR EL TOPE VA EN EL MISMO COMMIT QUE SACA LAS ENTRADAS, siempre. La lista va
 * SIEMPRE al límite exacto, sin holgura — es eso lo que hace que el ratchet muerda.
 * Dejarlo en 24 con 17 entradas NO pone el test en rojo: lo deja en verde con SIETE
 * huecos libres para aparcar sin que nadie se entere. El ratchet no protege por existir,
 * protege por ir apretado; un tope con holgura es el descuadre silencioso que este
 * fichero existe para evitar (ver SCRUM-103 sobre qué más no valida).
 */
// LAS TRES SALEN, y el numero es la suma de las dos bajadas, no la de una:
//   16 - 2 (SCRUM-365: /products/import y /products/load-catalog)
//      - 1 (SCRUM-312: /customers/import)  =  13
//
// Se resolvio asi porque quedarse en 14 o en 15 dejaria HOLGURA, y este mismo fichero dice
// por que eso es un defecto: «un tope con holgura deja huecos libres para aparcar sin que
// nadie se entere». Dos ramas bajaron el trinquete desde el mismo punto de partida y
// ninguna estaba mal; lo que estaria mal es resolver eligiendo una.
export const PENDIENTE_MAX = 13;

/**
 * Fecha límite. Pasada esta fecha el test FALLA mientras queden pendientes.
 * Dos tandas desde el 2026-07-22. Si llega la fecha y la lista sigue llena, eso ES
 * la señal: el "por tandas" se convirtió en "nunca". Mover esta fecha requiere OK
 * del fundador y queda en el diff.
 */
export const REVISAR_ANTES_DE = '2026-09-30';

/**
 * SCRUM-164 · GATES DE ROL POR CAMPO — enumerados a mano PORQUE la derivación no los ve.
 *
 * `scrum55-admin-fail-closed` deriva el árbol `/admin` reflejando los montajes y el marcador
 * `__requiredRole` que deja `requireRole`. Un gate que vive DENTRO del handler (porque depende
 * del cuerpo de la petición, no de la ruta) no deja marcador y es invisible para esa derivación
 * — y también para `ADMIN_ONLY_ROUTES`. Punto ciego compartido por los dos mecanismos.
 *
 * Esta lista existe para que dejen de ser invisibles: cualquier gate de rol escrito a mano en un
 * handler tiene que estar aquí, y hay un guard que lo comprueba contra el código
 * (`scrum164-gate-por-campo.test.mjs`). No es documentación: es lo que se compara.
 */
export const FIELD_LEVEL_ROLE_GATES: ReadonlyArray<{ method: string; path: string; campos: readonly string[]; why: string }> = [
  {
    method: 'PATCH',
    path: '/admin/jobs/:id',
    campos: ['tipoOperacion', 'assignedUserId', "status:'cerrado'"],
    why: 'SCRUM-120: la ruta NO es admin-only (status/scheduledAt/notes son del operario); lo reservado al admin son los campos que tocan facturación o dinero. Regla en roleCapabilities.adminOnlyJobField.',
  },
];
