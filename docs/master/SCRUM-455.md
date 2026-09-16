# SCRUM-455 · H1 fase 1 — el almacén local y su purgado

**Medido contra:** `origin/main` = `2e12c2f784615db647a5f35d18ebfeafe6f69c07` · 2026-08-10T20:09:04Z

**10-ago-2026** · sesión 1 · sin gate, corre en `npm test`

Un fontanero firma un albarán en un sótano, el producto le dice que está guardado, y no lo está
—porque la escritura local falló y nadie lo comprobó—. Se va de la obra tranquilo y se entera tres
semanas después, discutiendo con el cliente.

## PASO 0

* **`docs/master/SCRUM-455.md` no existía en `main`.**
* **La premisa se sostiene: IndexedDB es CERO en el producto.** Contado con `git grep -c` sobre
  `origin/main` de `indexeddb|onupgradeneeded|objectStore|IDBKeyRange`: **10 ficheros**, y las
  **3 apariciones fuera de `docs/`** son PROSA en comentarios —`api.js:235`,
  `scrum358-alta-idempotente.test.mjs:10`, `scrum360-entorno-instalada.test.mjs:8`—, ninguna es
  código. Verificadas una a una.
* **Y comprobado que nadie construyó encima de la nada**, porque sus documentos SÍ existen y eso
  invita a suponerlo: `SCRUM-356.md` es *«H2 — informe, cero construcción»* y `SCRUM-358.md`
  construyó la **mitad de servidor** del alta idempotente, declarando *«❌ NO cubre: la cola en
  IndexedDB»*. La dependencia real estaba pendiente.
* **ENTRADA: no hay pantalla, y es correcto.** Esta fase no pinta nada.
* **MECANISMO: no existe.** Es la única pieza del bloque H que había que construir de cero.

## PASO 0.5 · el banco, antes de escribir una línea de almacén

Node no trae IndexedDB. **Primero se miró si el árbol ya lo resolvía** (la lección de SCRUM-450):
`tests/_censo-almacenamiento-publico.mjs` existe y es un censo AST de `public/`, pero cubre
`localStorage`, `sessionStorage` y `document.cookie` — **no IndexedDB**. No había nada.

Se usa **`fake-indexeddb@6.2.5`**, autorizado por el fundador el 10-ago (regla 36). Condiciones
cumplidas y comprobadas antes de instalar: `devDependencies`, **versión fijada** (`--save-exact`),
lockfile en el mismo PR, **cero dependencias transitivas**, Apache-2.0, y **ningún ciclo de
instalación** (`preinstall`/`install`/`postinstall` ausentes; el `prepare: husky` que trae el
paquete no se ejecuta al instalar desde el registro). Los avisos de *install scripts* que salen en
la consola son de Prisma y son preexistentes.

**Y no sale de `tests/`**, con guard propio: un recorrido de `public/` y `src/` que falla si la
palabra aparece, con suelo de ≥50 ficheros vistos.

## Lo construido

### `public/dashboard/js/almacenLocal.js`

**Dos almacenes concretos, no una capa genérica.** No hay `Store<T>`: una abstracción que nadie ha
pedido es el defecto de forma que ya costó `exportView.js`.

| Almacén | `keyPath` | Por qué ése |
|---|---|---|
| `albaranesPrecargados` | `id` | el identificador del albarán en la API, que no se traduce |
| `firmasPendientes` | `claveIdempotencia` | la que decidió SCRUM-358 y que el alta del servidor ya acepta |

El `keyPath` de la cola **no es estilo**: una firma sin `claveIdempotencia` **no entra** —IndexedDB
la rechaza—, y una firma sin clave es un duplicado esperando a ocurrir en cuanto la cola reintente.
El resto del contenido no se valida a propósito: qué campos lleva una firma en cola lo decide H3, y
adelantarlo sería inventar.

### 🔴 El suelo: tres resultados, no un booleano

| | Qué significa | Reintentar |
|---|---|---|
| `GUARDADO` | **la transacción confirmó**. El único que autoriza a decir que está. | — |
| `NO_DISPONIBLE` | este navegador no da almacén: navegación privada, permiso denegado | no arregla nada |
| `FALLO` | el almacén está, **esta** escritura no confirmó: cuota, transacción abortada | puede tener sentido |

**`peticion.onsuccess` dice «la operación se ejecutó»; sólo `tx.oncomplete` dice «el dato está en
disco».** Entre las dos hay una transacción que todavía puede abortar, y ahí es donde el producto
acaba mintiendo. Colapsar los dos últimos en un booleano es la lección de SCRUM-360: da un recuento
tranquilo y falso.

### La versión del esquema, decidida hoy con el almacén vacío

**Subir `VERSION_BD` sin escribir su tramo hace fallar la apertura ruidosamente.** Es incómodo a
propósito: la alternativa cómoda —recrear los almacenes al subir de versión— es una línea más corta
y **borra la cola de firmas sin decir nada**. Quedarse sin almacén se nota el mismo día y no
destruye nada, porque `firmasPendientes` sigue en disco esperando a que alguien escriba el tramo.

Y la regla que va con la decisión —**ningún tramo futuro puede borrar ni recrear
`firmasPendientes`**— no se queda en un comentario: tiene guard AST que detecta
`deleteObjectStore`/`deleteDatabase` y cae nombrando la línea. Escribirla sin mecanismo habría sido
prohibición sin mecanismo, la familia que este repo lleva semanas desmontando.

### El purgado, desde el primer día

**El logout de hoy no purga nada**: `public/dashboard/js/app.js:456-459` era un POST a
`/auth/logout` y una redirección. H0 tenía razón.

Entre añadir almacenamiento y purgarlo hay una ventana en la que los datos de los clientes de un
profesional se quedan en un móvil que se pierde, se vende o se comparte en la furgoneta **después**
de cerrar sesión. Art. 32 RGPD: medida exigible. **El desalojo automático del navegador no es un
mecanismo de borrado alegable** — no está bajo nuestro control, no tiene plazo y no deja constancia.

Se borra **lo nuestro por su nombre**: los dos almacenes con `clear()` uno a uno —no
`deleteDatabase`, que se llevaría cualquier almacén que otro ticket añada a esta misma base— y las
cachés con prefijo `yaqu-`, no `caches.keys()` entero. El vaciado **también espera a
`tx.oncomplete`**: decir que se purgó sin que confirme es el mismo defecto con las consecuencias del
RGPD.

**El purgado va ANTES del POST**, y el orden no es indiferente: es local y no depende de la red,
mientras que el POST puede colgarse minutos en un sótano. Si el pro mata la pestaña mientras la
petición espera, sus datos ya se han ido. Al revés se quedarían. Y **no bloquea la salida**: cerrar
sesión tiene que funcionar siempre, también sin almacén.

## Verificación

15 tests en `tests/scrum455-almacen-local.test.mjs`. **Ejercitados**, no leídos: el banco monta el
dashboard entero —los mismos scripts que carga el navegador— así que el test de cerrar sesión llama
a `logout()` **de verdad**, la de `app.js`, no al purgado por separado.

### Rojo por el mecanismo, con post-condición en disco

| Mutación | Cae | Y sólo ése |
|---|---|---|
| resolver en `peticion.onsuccess` en vez de `tx.oncomplete` | **EL CORAZÓN** — `actual: 'GUARDADO'` | ✅ |
| el purgado deja de filtrar por prefijo | control negativo del purgado | ✅ |
| `logout()` deja de llamar al purgado | cerrar sesión deja datos | ✅ |
| un tramo que hace `deleteObjectStore(FIRMAS_PENDIENTES)` | tramos **y** destrucción de almacén | ✅ (2, ambos correctos) |

El mensaje del primero, que es el que importa: *«SE ESTÁ DANDO POR GUARDADO ALGO SIN CONFIRMAR. La
operación tuvo éxito pero la transacción abortó: el dato NO está en disco.»*

### El escenario que no se puede pedir desde fuera

`indexedDBQueAbortaTrasEscribir` envuelve un IndexedDB real y, en cuanto una escritura dispara su
`success`, aborta la transacción. El `success` llega igual —se registra con `addEventListener`, así
que no compite con el `onsuccess` que asigne el código— y la transacción acaba en `abort`. Lleva
**testigo**: si el escenario no ocurrió, el test lo dice en vez de pasar por no haberse dado.

> ⚠️ **Dos tropiezos del banco, anotados porque los dos daban un resultado creíble y falso:**
>
> ① **No se puede decidir por `readyState` cuándo envolver la base.** Durante `onupgradeneeded` ya
> vale `'done'`, así que el envoltorio —que no tiene `createObjectStore`— sustituía a la base justo
> donde se crean los almacenes, y el upgrade abortaba con un «request was aborted» que parecía del
> producto y era del banco.
>
> ② **El testigo del abort se contaba en el evento, y el evento llega un tick tarde.** Bajo la
> mutación, el código ya había resuelto `GUARDADO` para entonces: el test **caía por el motivo
> equivocado** («el escenario no ocurrió») en vez de por el defecto real. Un rojo raro es sospecha
> sobre el escáner, no sobre el código — y aquí lo era. Contado en el momento de llamar a `abort()`,
> que es determinista, el mensaje pasó a ser el correcto.

### Control negativo

Cachés que **no** son nuestras (`workbox-precache-ajena`, `otra-cosa`) sobreviven al purgado; purgar
dos veces seguidas no revienta; y sin IndexedDB **la caché se purga igual**, porque el purgado no
puede colgar del almacén (en navegación privada se cerraría sesión dejando las páginas cacheadas).

## Lo que NO se ha construido, y por qué

* **No se precarga nada.** Qué se precarga y cuándo es SCRUM-357 fase 2; aquí sólo se construye
  dónde va a caber.
* **Ni orden, ni reintentos, ni drenado de la cola.** Es H3 (SCRUM-358).
* **Ni un texto que pueda ver un profesional.** Los tres estados son microcopy aprobada en
  SCRUM-356 y se consumen allí (regla 30).
* **No se acuña la clave de idempotencia.** El almacén la exige; quien encola la trae. Acuñarla es
  de H3.
* **`prisma/schema.prisma`, el camino de emisión y la estrategia de runtime del service worker: sin
  tocar.**

> `public/sw.js` sí cambia, en **una línea**: la entrada del fichero nuevo en el `SHELL`. Es lo que
> el guard de SCRUM-274 exige en los dos sentidos —añadir un `<script src>` sin añadirlo al SHELL
> deja la primera visita sin cobertura sin esa pieza, y el guard lo caza—. La estrategia de runtime
> no se ha tocado.

## Huecos que se declaran

* **`fake-indexeddb` sigue siendo un DOBLE.** Demuestra que **nuestro** código usa IndexedDB según
  el estándar; **no** que un iPhone se comporte así. **No quedan cubiertos**: el desalojo de WebKit a
  los 7 días sin abrir la aplicación, la cuota agotada en un móvil real, ni la navegación privada de
  Safari (donde IndexedDB puede estar y fallar de otra manera). Eso es H7 y la matriz humana de
  `docs/QA_MASTER.md`.
* **El fallo del purgado no se ve desde ninguna parte.** `logout()` recoge el resultado y lo
  descarta, porque esta fase no tiene superficie donde decirlo. Si el purgado falla, el profesional
  sale sin enterarse. Es de H2 (SCRUM-356), pero conviene que conste que hoy hay un resultado que
  nadie mira.
* **`onblocked` se trata como fallo de apertura.** Si el pro tiene dos pestañas del dashboard
  abiertas y una futura subida de versión queda bloqueada, se reporta `NO_DISPONIBLE`. Es correcto
  para el suelo —no se dice que guardó— pero no se ha ejercitado ese escenario.
* **`clear()` vacía; no sobrescribe.** El borrado es el de IndexedDB, no un borrado seguro a nivel
  de disco. Para lo que exige el art. 32 es suficiente; se anota por no dejarlo implícito.

## Tests

* `tests/scrum455-almacen-local.test.mjs` — 15 tests
* `tests/_banco-almacen-local.mjs` — el banco (no es fichero de test)
