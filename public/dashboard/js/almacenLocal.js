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
 *   · los dos almacenes con `clear()`, uno a uno — no `deleteDatabase`, que se lleva por delante
 *     cualquier almacén que otro ticket añada a esta misma base sin enterarse;
 *   · las cachés con el prefijo `yaqu-`, no `caches.keys()` entero.
 *
 * Purgar dos veces seguidas no revienta: `clear()` sobre un almacén vacío es válido, y una caché
 * que ya no está simplemente no se borra.
 */
async function purgarDatosLocales() {
  const resultado = { estado: GUARDADO, almacenes: [], caches: [], motivo: undefined };

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
  if (enAlmacen.estado !== GUARDADO) {
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
window.guardarAlbaranPrecargado = guardarAlbaranPrecargado;
window.leerAlbaranesPrecargados = leerAlbaranesPrecargados;
window.purgarDatosLocales = purgarDatosLocales;
