// public/dashboard/js/almacenLocal.js — SCRUM-455 (H1 · fase 1)
//
// EL ALMACÉN LOCAL DEL BLOQUE H, Y SU PURGADO.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// LA VÍCTIMA
//
// Un fontanero firma un albarán en un sótano, el producto le dice que está guardado, y no lo está
// —porque la escritura local falló y nadie lo comprobó—. Se va de la obra tranquilo y se entera
// tres semanas después, discutiendo con el cliente.
//
// Por eso la regla de este fichero es una sola: **una escritura se da por buena cuando la
// TRANSACCIÓN CONFIRMA, no cuando se lanza.** Todo lo demás es consecuencia.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// DOS ALMACENES CONCRETOS, NO UNA CAPA GENÉRICA
//
//   `albaranesPrecargados` — LECTURA: lo que baja para poder abrirse sin red (SCRUM-357 fase 2
//                            decide qué y cuándo; aquí solo se construye dónde cabe).
//   `firmasPendientes`     — ESCRITURA: la cola. El drenado, el orden y los reintentos son de
//                            H3 (SCRUM-358); aquí solo vive.
//
// No hay `Store<T>` ni capa de almacenamiento reutilizable, y es deliberado: una abstracción que
// nadie ha pedido es el defecto de forma que ya costó `exportView.js`.
//
// ⚠️ ESTA FASE NO PINTA NADA. Ni un texto que pueda ver un profesional: los tres estados y su
// microcopy son de H2 (SCRUM-356) y se consumen allí. Aquí solo se devuelven resultados.

// ── La base y sus dos almacenes ────────────────────────────────────────────────────────────
const NOMBRE_BD = 'yaqu';
const VERSION_BD = 1;
const ALBARANES_PRECARGADOS = 'albaranesPrecargados';
const FIRMAS_PENDIENTES = 'firmasPendientes';

/**
 * Las cachés que son NUESTRAS, por prefijo.
 *
 * `sw.js` usa hoy `yaqu-v4` y ese número se sube a mano de vez en cuando. Por prefijo, un bump
 * futuro queda purgado sin tener que acordarse de volver aquí — y lo que no sea nuestro no se
 * toca. Purgar con `caches.keys()` entero sería borrar por si acaso, que es justo lo que el
 * control negativo de este ticket prohíbe.
 */
const PREFIJO_CACHES = 'yaqu-';

// ═══════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-457 · LAS CLAVES DEL PANEL EN `localStorage` Y `sessionStorage`, Y CUÁLES SOBREVIVEN
//
// LA VÍCTIMA: un profesional cierra sesión en el móvil de la furgoneta que comparte con dos
// compañeros. Dentro se quedan el borrador de presupuesto —con el cliente y los importes— y su
// catálogo de productos recientes CON SUS PRECIOS. Ha hecho lo único que el producto le ofrece
// para protegerse, y no ha servido.
//
// 🔴 Y ESO ES PEOR QUE NO BORRAR: un borrado parcial que se presenta como borrado hace que el
// profesional deje de preocuparse. SCRUM-455 purgó IndexedDB y las cachés; sin esto, el logout
// PARECE que limpia.
//
// `pf_recent_products_*` además no es dato de cliente: son **los precios del profesional**, en un
// aparato que puede acabar en manos de un competidor. Eso no es RGPD, es su negocio.
//
// ⚠️ El desalojo automático del navegador NO es un mecanismo de borrado alegable: no está bajo
// nuestro control, no tiene plazo y no deja constancia.
//
// ───────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTO ES UN REGISTRO Y NO UN `localStorage.clear()`
//
// Misma regla que 455 aplicó a las cachés, y por dos motivos distintos:
//   1. `clear()` se lleva lo que otro haya dejado en el mismo origen. Borrar por si acaso es
//      justo lo que el control negativo de este ticket prohíbe.
//   2. Y OCULTA EL ERROR DE MAÑANA: con `clear()`, la clave que alguien añada el mes que viene se
//      borra sin que nadie se entere de que existía — y nadie decide nunca si debía sobrevivir.
//
// 🔴 LO QUE IMPIDE QUE ESTO SE QUEDE VIEJO NO ES ESTA LISTA: es el guard de
// `tests/scrum457-logout-purga-claves.test.mjs`, que recorre por AST **todas** las escrituras del
// panel y pone en rojo, CON SU FICHERO Y SU LÍNEA, cualquiera que no esté aquí. Escribir cuatro
// nombres a mano y confiar en acordarse es el defecto de forma de SCRUM-265: lo que hay que
// acordarse de poner, un día no se pone.
// ═══════════════════════════════════════════════════════════════════════════════════════════

/**
 * Cada clave del panel, con su almacén y su decisión. `purga: false` es una EXCEPCIÓN y por eso
 * lleva motivo escrito: una excepción sin motivo es una excepción que nadie puede revisar.
 */
const CLAVES_LOCALES = [
  {
    patron: /^pf_quote_draft_/, almacen: 'localStorage', purga: true,
    motivo: 'El borrador de presupuesto: cliente, conceptos e importes. Datos de un tercero que '
      + 'no ha consentido quedarse en el móvil de nadie.',
  },
  {
    patron: /^pf_recent_products_/, almacen: 'localStorage', purga: true,
    motivo: 'El catálogo reciente CON PRECIOS. No es dato del cliente: es el negocio del '
      + 'profesional, y quien coja el móvil después puede ser su competencia.',
  },
  {
    // SCRUM-360 fase 3 · la marca de «este navegador llegó a tener firmas en cola».
    patron: /^yaqu_hubo_cola$/, almacen: 'localStorage', purga: true,
    motivo: 'SE PURGA, y el motivo no es de privacidad: es que el logout YA vacía '
      + '`firmasPendientes` a propósito. Si la marca sobreviviera, al volver a entrar veríamos '
      + '«hubo cola» + «almacén vacío» y le diríamos al profesional que ha PERDIDO algo que '
      + 'borramos nosotros. Un aviso que grita en falso se ignora, y entonces no avisa del bueno.',
  },
  {
    patron: /^yaqu_tips_shown$/, almacen: 'localStorage', purga: false,
    motivo: 'SOBREVIVE. Es el «no me lo vuelvas a enseñar» de los consejos: no hay dato personal '
      + 'ni de negocio, no lleva merchant, y es una preferencia DEL APARATO. Purgarlo devolvería '
      + 'el tour entero a cada cierre de sesión sin proteger absolutamente nada.',
  },
  {
    patron: /^voiceUnsupported$/, almacen: 'sessionStorage', purga: false,
    motivo: 'SOBREVIVE. Es el resultado de probar si el micrófono de ESTE aparato funciona '
      + '(iOS en PWA lo declara y está roto). No hay dato de nadie; borrarlo solo haría repetir '
      + 'una prueba que ya se sabe que falla. Y sí hace falta decidirlo: `sessionStorage` NO se '
      + 'vacía al cerrar sesión, porque la pestaña es la misma.',
  },
];

// ── Los tres resultados ────────────────────────────────────────────────────────────────────
//
// 🔴 «Está guardado» y «no supe guardarlo» NO pueden ser el mismo valor, y «no supe» tiene dos
// causas que no son la misma cosa:
//
//   GUARDADO      la transacción CONFIRMÓ. Es el único que autoriza a decirle a nadie que está.
//   NO_DISPONIBLE este navegador no da almacén: navegación privada de Safari, permiso denegado,
//                 IndexedDB ausente. No es culpa de este intento y reintentar no arregla nada.
//   FALLO         el almacén está, pero ESTA escritura no confirmó: cuota agotada, transacción
//                 abortada. Reintentar puede tener sentido.
//
// Separar los dos últimos es la lección de SCRUM-360: un booleano los colapsa y produce un
// recuento tranquilo y falso. Quién los pinta y con qué palabras es de H2, no de aquí.
const GUARDADO = 'GUARDADO';
const NO_DISPONIBLE = 'NO_DISPONIBLE';
const FALLO = 'FALLO';

/**
 * 🔴 LOS TRAMOS DE MIGRACIÓN, DECIDIDOS HOY CON EL ALMACÉN VACÍO — que es cuando es gratis.
 *
 * IndexedDB tiene versión y `onupgradeneeded`. Un almacén cuyo número de versión sube sin camino
 * de migración escrito **pierde datos en silencio**, y lo que se perdería aquí son FIRMAS de un
 * cliente que ya no está delante para volver a firmar.
 *
 * LA DECISIÓN: subir `VERSION_BD` sin escribir el tramo correspondiente **hace fallar la apertura
 * ruidosamente**, en vez de dejar pasar el upgrade y perder la cola.
 *
 * Es incómodo a propósito. La alternativa cómoda —recrear los almacenes al subir de versión— es
 * una línea más corta y borra la cola de firmas sin decir nada; quedarse sin almacén se nota el
 * mismo día y no destruye nada, porque `firmasPendientes` sigue en disco esperando a que alguien
 * escriba su tramo.
 *
 * ⚠️ REGLA QUE NO SE RELAJA: ningún tramo futuro puede borrar ni recrear `firmasPendientes`. Los
 * datos que hay dentro son de un cliente que firmó.
 *
 * La clave es la versión **de la que se parte**. `0` es la instalación desde cero.
 */
const TRAMOS = {
  0: (bd) => {
    // `albaranesPrecargados` va por el `id` del albarán, que es el identificador de la API y no
    // se traduce.
    bd.createObjectStore(ALBARANES_PRECARGADOS, { keyPath: 'id' });

    // 🔴 `firmasPendientes` va por `claveIdempotencia`, la que SCRUM-358 decidió y que el alta
    // del servidor ya acepta. No es una elección de estilo: al ir en el `keyPath`, una firma SIN
    // clave **no entra** —IndexedDB la rechaza—, y una firma sin clave de idempotencia es un
    // duplicado esperando a ocurrir en cuanto la cola reintente.
    //
    // El RESTO del contenido no se valida aquí a propósito: qué campos lleva una firma en cola lo
    // decide H3, y adelantarlo sería inventar.
    bd.createObjectStore(FIRMAS_PENDIENTES, { keyPath: 'claveIdempotencia' });
  },
};

/**
 * Las versiones del salto `desde → hasta` que NO tienen tramo escrito.
 *
 * PURA sobre sus argumentos, y publicada, por el mismo motivo que `rutasMuertas` en SCRUM-450:
 * hoy `VERSION_BD` es 1 y **no existe ningún salto posible**, así que un guard que solo mirase el
 * salto real sería cierto sobre un conjunto vacío y verde para siempre. Con esto, el mecanismo se
 * ejercita contra un corpus sintético aunque el producto todavía no tenga versiones que saltar.
 */
function tramosQueFaltan(desde, hasta, tramos = TRAMOS) {
  const faltan = [];
  for (let v = desde; v < hasta; v += 1) {
    if (typeof tramos[v] !== 'function') faltan.push(v);
  }
  return faltan;
}

/** ¿Hay IndexedDB en este navegador? Safari en navegación privada es el caso real. */
function hayIndexedDB() {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch (_e) {
    // Acceder a la propiedad puede LANZAR con ciertas políticas de privacidad.
    return false;
  }
}

/** Abre la base aplicando los tramos. Rechaza si no hay almacén o si falta un tramo. */
function abrirAlmacen() {
  return new Promise((resolve, reject) => {
    if (!hayIndexedDB()) {
      reject(new Error('NO_DISPONIBLE: este navegador no ofrece IndexedDB'));
      return;
    }
    let peticion;
    try {
      peticion = indexedDB.open(NOMBRE_BD, VERSION_BD);
    } catch (e) {
      reject(e);
      return;
    }

    peticion.onupgradeneeded = (ev) => {
      const bd = peticion.result;
      const desde = ev.oldVersion;

      const faltan = tramosQueFaltan(desde, VERSION_BD);
      if (faltan.length) {
        // Lanzar aquí ABORTA el upgrade: la apertura falla y NO se pierde nada de lo que ya
        // estuviera guardado. Es el fallo ruidoso, elegido a conciencia.
        throw new Error(
          `Falta el tramo de migración para la versión ${faltan.join(', ')} de «${NOMBRE_BD}». ` +
          'Subir VERSION_BD sin escribirlo perdería la cola de firmas en silencio.',
        );
      }
      for (let v = desde; v < VERSION_BD; v += 1) TRAMOS[v](bd);
    };

    peticion.onsuccess = () => resolve(peticion.result);
    peticion.onerror = () => reject(peticion.error || new Error('no se pudo abrir el almacén'));
    peticion.onblocked = () => reject(new Error('la apertura quedó bloqueada por otra pestaña'));
  });
}

/**
 * 🔴 EL CORAZÓN DE ESTE FICHERO: escribe y **espera a que la transacción confirme**.
 *
 * `peticion.onsuccess` dispara cuando la operación se ejecutó, pero la transacción todavía puede
 * abortar después —cuota agotada, error en otra operación de la misma `tx`— y entonces el dato NO
 * está en disco. Resolver ahí es exactamente cómo el producto acaba diciendo «guardado» sobre algo
 * que no lo está. Sólo `tx.oncomplete` significa que está.
 */
function escribirConfirmando(bd, almacen, valor) {
  return new Promise((resolve) => {
    let tx;
    try {
      tx = bd.transaction(almacen, 'readwrite');
    } catch (e) {
      resolve({ estado: FALLO, motivo: String((e && e.message) || e) });
      return;
    }
    let motivoDelFallo = null;
    try {
      // La petición se nombra a propósito: es la que NO hay que escuchar para dar por buena la
      // escritura. Su `onsuccess` dice «la operación se ejecutó», no «el dato está en disco».
      const peticion = tx.objectStore(almacen).put(valor);
      void peticion;
    } catch (e) {
      // `put` lanza en el acto si el valor no encaja con el `keyPath` — una firma sin
      // `claveIdempotencia`, por ejemplo.
      motivoDelFallo = String((e && e.message) || e);
    }

    tx.oncomplete = () => resolve({ estado: GUARDADO });
    tx.onabort = () => resolve({
      estado: FALLO,
      motivo: motivoDelFallo || String((tx.error && tx.error.message) || 'transacción abortada'),
    });
    tx.onerror = () => resolve({
      estado: FALLO,
      motivo: motivoDelFallo || String((tx.error && tx.error.message) || 'error en la transacción'),
    });
    if (motivoDelFallo) { try { tx.abort(); } catch (_e) { /* ya abortada */ } }
  });
}

/** Lee todo lo de un almacén. */
function leerTodo(bd, almacen) {
  return new Promise((resolve) => {
    let tx;
    try {
      tx = bd.transaction(almacen, 'readonly');
    } catch (e) {
      resolve({ estado: FALLO, motivo: String((e && e.message) || e), datos: [] });
      return;
    }
    const peticion = tx.objectStore(almacen).getAll();
    peticion.onsuccess = () => resolve({ estado: GUARDADO, datos: peticion.result || [] });
    tx.onabort = () => resolve({ estado: FALLO, motivo: 'transacción abortada', datos: [] });
    tx.onerror = () => resolve({ estado: FALLO, motivo: 'error en la transacción', datos: [] });
  });
}

/** Envoltorio común: abrir, hacer, y traducir «no se pudo abrir» a NO_DISPONIBLE. */
async function conElAlmacen(hacer) {
  let bd;
  try {
    bd = await abrirAlmacen();
  } catch (e) {
    return { estado: NO_DISPONIBLE, motivo: String((e && e.message) || e) };
  }
  try {
    return await hacer(bd);
  } finally {
    try { bd.close(); } catch (_e) { /* ya cerrada */ }
  }
}

// ── La superficie que consumirán H2 y H3 ───────────────────────────────────────────────────

/** Encola una firma. Devuelve GUARDADO sólo si la transacción confirmó. */
function guardarFirmaPendiente(firma) {
  return conElAlmacen((bd) => escribirConfirmando(bd, FIRMAS_PENDIENTES, firma));
}

/**
 * Saca UNA firma de la cola, por su clave. SCRUM-358 (H3 · fase 2).
 *
 * 🔴 CONFIRMA IGUAL QUE AL ESCRIBIR, y aquí el motivo es el simétrico: dar por desencolado algo
 * que sigue dentro deja un fantasma que se reintentará; pero decir «no se pudo quitar» cuando sí
 * se quitó hace que el producto insista sobre una firma que ya no existe. Sólo `tx.oncomplete`
 * distingue las dos.
 *
 * Quitar algo que no está NO es un fallo: `delete` sobre una clave ausente es válido en IndexedDB,
 * y desencolar dos veces es un caso corriente en cuanto haya reintentos.
 */
function quitarFirmaPendiente(clave) {
  return conElAlmacen((bd) => new Promise((resolve) => {
    let tx;
    try {
      tx = bd.transaction(FIRMAS_PENDIENTES, 'readwrite');
    } catch (e) {
      resolve({ estado: FALLO, motivo: String((e && e.message) || e) });
      return;
    }
    let motivoDelFallo = null;
    try {
      tx.objectStore(FIRMAS_PENDIENTES).delete(clave);
    } catch (e) {
      motivoDelFallo = String((e && e.message) || e);
    }
    tx.oncomplete = () => resolve({ estado: GUARDADO });
    tx.onabort = () => resolve({ estado: FALLO, motivo: motivoDelFallo || 'transacción abortada' });
    tx.onerror = () => resolve({ estado: FALLO, motivo: motivoDelFallo || 'error en la transacción' });
    if (motivoDelFallo) { try { tx.abort(); } catch (_e) { /* ya abortada */ } }
  }));
}

/** Las firmas que siguen en la cola. El orden y el drenado son de H3. */
function leerFirmasPendientes() {
  return conElAlmacen(async (bd) => {
    const r = await leerTodo(bd, FIRMAS_PENDIENTES);
    return { estado: r.estado, motivo: r.motivo, firmas: r.datos || [] };
  });
}

/** Guarda un albarán precargado. QUÉ se precarga y cuándo es de SCRUM-357 fase 2. */
function guardarAlbaranPrecargado(albaran) {
  return conElAlmacen((bd) => escribirConfirmando(bd, ALBARANES_PRECARGADOS, albaran));
}

/** Los albaranes precargados que hay hoy en el móvil. */
function leerAlbaranesPrecargados() {
  return conElAlmacen(async (bd) => {
    const r = await leerTodo(bd, ALBARANES_PRECARGADOS);
    return { estado: r.estado, motivo: r.motivo, albaranes: r.datos || [] };
  });
}

/**
 * 🔴 EL PURGADO DEL LOGOUT — art. 32 RGPD, y va desde el primer día.
 *
 * No se añade almacenamiento hoy y se purga en otro ticket: entre las dos cosas hay una ventana en
 * la que nombres, teléfonos, direcciones e importes de los clientes de un profesional se quedan en
 * un móvil que se pierde, se vende o se comparte en la furgoneta DESPUÉS de cerrar sesión.
 *
 * ⚠️ El desalojo automático del navegador NO es un mecanismo de borrado alegable: no está bajo
 * nuestro control, no tiene plazo y no deja constancia.
 *
 * SE BORRA LO NUESTRO POR SU NOMBRE, no «todo»:
 *   · las claves de `localStorage`/`sessionStorage` del registro `CLAVES_LOCALES` (SCRUM-457), no
 *     `localStorage.clear()`;
 *   · los dos almacenes con `clear()`, uno a uno — no `deleteDatabase`, que se lleva por delante
 *     cualquier almacén que otro ticket añada a esta misma base sin enterarse;
 *   · las cachés con el prefijo `yaqu-`, no `caches.keys()` entero.
 *
 * Purgar dos veces seguidas no revienta: `clear()` sobre un almacén vacío es válido, y una caché
 * que ya no está simplemente no se borra.
 */
/**
 * SCRUM-457 · Vacía UN almacén de teclas del navegador, por nombre y solo lo nuestro.
 *
 * Se recorre lo que HAY guardado y se borra lo que casa con un patrón de purga. Al revés —recorrer
 * los patrones y borrar— no valdría: `pf_quote_draft_<merchantId>` no es una clave, es una familia,
 * y el móvil de la furgoneta tiene una por cada compañero que haya entrado.
 *
 * Las claves que NO son nuestras se quedan. No sabemos de quién son y borrar por si acaso es lo que
 * este ticket prohíbe; la que sea nuestra y no esté en el registro la caza el guard, en rojo, con
 * su fichero y su línea — no en silencio aquí.
 *
 * @returns {{borradas: string[], motivo?: string}}
 */
function purgarClavesDe(nombreAlmacen, almacen) {
  const borradas = [];
  if (!almacen) return { borradas };
  try {
    const patrones = CLAVES_LOCALES.filter((c) => c.almacen === nombreAlmacen && c.purga);
    // Se listan las claves ANTES de borrar: en el navegador, `key(i)` se reindexa al eliminar y un
    // bucle que borre mientras recorre se salta la mitad. Es el defecto clásico de este API.
    const claves = [];
    for (let i = 0; i < (almacen.length || 0); i++) {
      const k = almacen.key(i);
      if (typeof k === 'string') claves.push(k);
    }
    for (const k of claves) {
      if (patrones.some((p) => p.patron.test(k))) { almacen.removeItem(k); borradas.push(k); }
    }
  } catch (e) {
    return { borradas, motivo: String((e && e.message) || e) };
  }
  return { borradas };
}

async function purgarDatosLocales() {
  const resultado = { estado: GUARDADO, almacenes: [], caches: [], claves: [], motivo: undefined };

  // SCRUM-457 · Las teclas del navegador van PRIMERO, y son síncronas: no pueden quedarse a medias
  // porque IndexedDB no esté disponible. Que Safari en privado no dé almacén no puede ser el motivo
  // por el que el borrador de un cliente se quede en el móvil.
  for (const [nombre, almacen] of [
    ['localStorage', typeof localStorage !== 'undefined' ? localStorage : null],
    ['sessionStorage', typeof sessionStorage !== 'undefined' ? sessionStorage : null],
  ]) {
    const r = purgarClavesDe(nombre, almacen);
    resultado.claves.push(...r.borradas);
    if (r.motivo) { resultado.estado = FALLO; resultado.motivo = resultado.motivo || r.motivo; }
  }

  const enAlmacen = await conElAlmacen((bd) => new Promise((resolve) => {
    const nombres = [ALBARANES_PRECARGADOS, FIRMAS_PENDIENTES].filter(
      (n) => bd.objectStoreNames.contains(n),
    );
    if (!nombres.length) { resolve({ estado: GUARDADO, vaciados: [] }); return; }
    let tx;
    try {
      tx = bd.transaction(nombres, 'readwrite');
    } catch (e) {
      resolve({ estado: FALLO, motivo: String((e && e.message) || e), vaciados: [] });
      return;
    }
    for (const n of nombres) tx.objectStore(n).clear();
    // Igual que al escribir: vaciado CONFIRMADO, no vaciado lanzado. Decir que se purgó sin que
    // la transacción confirme es el mismo defecto con las consecuencias del RGPD.
    tx.oncomplete = () => resolve({ estado: GUARDADO, vaciados: nombres });
    tx.onabort = () => resolve({ estado: FALLO, motivo: 'transacción abortada', vaciados: [] });
    tx.onerror = () => resolve({ estado: FALLO, motivo: 'error en la transacción', vaciados: [] });
  }));

  resultado.almacenes = enAlmacen.vaciados || [];
  // SCRUM-457 · un FALLO ya anotado NO se pisa con un NO_DISPONIBLE. Son cosas distintas y la peor
  // manda: «este navegador no da IndexedDB» es una limitación conocida; «había un almacén y algo
  // que debía borrarse no se borró» es un dato que sigue en el móvil. Colapsarlos daría un recuento
  // tranquilo y falso, que es justo lo que separó los tres estados en SCRUM-455.
  if (enAlmacen.estado !== GUARDADO && resultado.estado === GUARDADO) {
    resultado.estado = enAlmacen.estado;
    resultado.motivo = enAlmacen.motivo;
  }

  // La Cache API va aparte: puede estar disponible aunque IndexedDB no lo esté, así que su
  // purgado NO puede depender de que el almacén se haya abierto.
  try {
    if (typeof caches !== 'undefined' && caches && typeof caches.keys === 'function') {
      const nombres = await caches.keys();
      const nuestras = nombres.filter((n) => String(n).startsWith(PREFIJO_CACHES));
      for (const n of nuestras) await caches.delete(n);
      resultado.caches = nuestras;
    }
  } catch (e) {
    resultado.estado = FALLO;
    resultado.motivo = resultado.motivo || String((e && e.message) || e);
  }

  return resultado;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-460 (H1 · fase 3) · BAJAR EL PAQUETE Y GUARDARLO
//
// 🔴 LOS NÚMEROS DE PRODUCCIÓN, MEDIDOS POR EL FUNDADOR EL 10-AGO-2026, CAMBIAN QUÉ ES EL CASO
// NORMAL: 42 trabajos · 35 no cerrados · **0 agendados hoy o mañana** · 26 sin agendar en absoluto
// (62 %) · **1 tocado en los últimos 7 días**. Con esos datos la precarga bajaría **como mucho un
// albarán en toda la producción**.
//
// **La unión vacía deja de ser el caso raro: es el que va a ocurrir casi siempre.** Por eso esto
// distingue TRES cosas y no dos, y por eso el suelo no es una formalidad de cierre:
//
//   · `NADA_QUE_PRECARGAR` — no había nada. Es cierto, y hay que decirlo.
//   · `NO_SE_PUDO`        — no supe mirar. Es un fallo, y hay que decirlo DISTINTO.
//   · `PRECARGADO`        — precargué N, y **N se puede ver**.
//
// Un profesional que abre la app, ve que «está preparado» y baja al sótano con cero albaranes
// precargados es exactamente la víctima de H1. Los tres primeros valores no se colapsan nunca.
// ═══════════════════════════════════════════════════════════════════════════════════════════

const PRECARGADO = 'PRECARGADO';
const NADA_QUE_PRECARGAR = 'NADA_QUE_PRECARGAR';
const NO_SE_PUDO = 'NO_SE_PUDO';

/**
 * Baja el paquete y lo guarda. **Nunca lanza**: quien la llama no puede quedarse a medias.
 *
 * ⚠️ RESPETA LOS TRES RESULTADOS DEL ALMACÉN (SCRUM-455): un albarán solo cuenta como guardado si
 * su transacción CONFIRMÓ. `NO_DISPONIBLE` (este navegador no da IndexedDB) y `FALLO` (lo hay y
 * esta escritura no confirmó) **no se colapsan**: el primero no se arregla reintentando y el
 * segundo sí.
 *
 * @returns {Promise<{estado: string, n: number, motivo?: string}>}
 */
async function precargarAlbaranes() {
  let paquete;
  try {
    paquete = await apiRequest('/admin/precarga');
  } catch (e) {
    // Sin red no se puede precargar, y eso NO es «no había nada»: es que no se supo mirar.
    return { estado: NO_SE_PUDO, n: 0, motivo: (e && e.message) || 'no se pudo pedir el paquete' };
  }

  // El productor ya distingue «no se pudo» de «no había nada» (SCRUM-458). No se reinterpreta aquí:
  // colapsarlo en el cliente destruiría la distinción que el servidor se molestó en hacer.
  if (!paquete || paquete.estado !== 'LISTA') {
    return { estado: NO_SE_PUDO, n: 0, motivo: (paquete && paquete.motivo) || 'el servidor no pudo construir el paquete' };
  }

  const albaranes = Array.isArray(paquete.albaranes) ? paquete.albaranes : [];
  if (!albaranes.length) return { estado: NADA_QUE_PRECARGAR, n: 0 };

  let guardados = 0;
  let motivo;
  for (const a of albaranes) {
    const r = await guardarAlbaranPrecargado(a);
    if (r && r.estado === GUARDADO) guardados++;
    else if (!motivo) motivo = (r && (r.motivo || r.estado)) || 'la escritura no confirmó';
  }

  // 🔴 GUARDAR A MEDIAS ES «NO SE PUDO», no «precargué algunos». El profesional que lea «precargado»
  // y le falte justo el albarán que iba a firmar está peor que si no le hubiéramos dicho nada.
  if (guardados < albaranes.length) {
    return { estado: NO_SE_PUDO, n: guardados, motivo: motivo || 'no se guardaron todos' };
  }
  return { estado: PRECARGADO, n: guardados };
}

/**
 * Un albarán precargado por su `id`, o `null` si no está.
 *
 * ⚠️ Devuelve `{estado, albaran}` y no solo el albarán: «no está precargado» y «no se pudo mirar el
 * almacén» son cosas distintas, y quien pinte el aviso tiene que poder distinguirlas. Colapsarlas
 * en `null` es cómo se acaba diciendo «no está disponible» cuando en realidad sí lo estaba.
 */
async function leerAlbaranPrecargado(id) {
  const r = await leerAlbaranesPrecargados();
  if (r.estado !== GUARDADO) return { estado: r.estado, motivo: r.motivo, albaran: null };
  const albaran = (r.albaranes || []).find((a) => String(a.id) === String(id)) || null;
  return { estado: GUARDADO, albaran };
}

// Frontend vanilla, sin bundler: se publica en `window` como el resto del dashboard.
window.GUARDADO = GUARDADO;
window.NO_DISPONIBLE = NO_DISPONIBLE;
window.FALLO = FALLO;
window.ALBARANES_PRECARGADOS = ALBARANES_PRECARGADOS;
window.FIRMAS_PENDIENTES = FIRMAS_PENDIENTES;
window.NOMBRE_BD = NOMBRE_BD;
window.VERSION_BD = VERSION_BD;
window.TRAMOS = TRAMOS;
window.tramosQueFaltan = tramosQueFaltan;
window.abrirAlmacen = abrirAlmacen;
window.guardarFirmaPendiente = guardarFirmaPendiente;
window.leerFirmasPendientes = leerFirmasPendientes;
window.quitarFirmaPendiente = quitarFirmaPendiente;   // SCRUM-358 (H3 fase 2)
window.guardarAlbaranPrecargado = guardarAlbaranPrecargado;
window.leerAlbaranesPrecargados = leerAlbaranesPrecargados;
window.purgarDatosLocales = purgarDatosLocales;
// SCRUM-457 · el registro se publica para que el guard mida LA MISMA lista que usa el purgado. Dos
// copias son dos cosas que se separan, y la que se separa siempre es la que nadie ejecuta.
window.CLAVES_LOCALES = CLAVES_LOCALES;
// SCRUM-460 (H1 fase 3)
window.PRECARGADO = PRECARGADO;
window.NADA_QUE_PRECARGAR = NADA_QUE_PRECARGAR;
window.NO_SE_PUDO = NO_SE_PUDO;
window.precargarAlbaranes = precargarAlbaranes;
window.leerAlbaranPrecargado = leerAlbaranPrecargado;
