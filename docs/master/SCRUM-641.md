# SCRUM-641 · «name_duplicate» en la pantalla, y un 500 que era un 409

**Fecha:** 2-sep-2026 · **Carril:** producto · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `9ae6ec070d76da8fbad21d8d6209f2ffd609eab6` · 2026-09-02T03:09:44+01:00

**Tanda:** 4218 tests, 4139 pass, 0 fail, 79 skipped — medida sobre el árbol YA REBASADO.

> ⚠️ El ancla es la base contra la que se midió. Durante el trabajo `origin/main` avanzó dos veces,
> hasta `c3108665cbbcaf73269cb0c796e30898ac1de983` (PR #886, SCRUM-634 —mío, ya mergeado— y PR #889,
> SCRUM-640). Esta rama se rebasó encima sin reescribir nada empujado (no había nada empujado
> todavía) y la tanda se volvió a medir después: 4198 → 4218 son los 20 tests que trajo SCRUM-640,
> ninguno de aquí.

---

## 🔴 LA PREMISA DEL ENCARGO NO ES EXACTA, y hay que decirlo primero

El encargo pide que el `PUT` conteste 409 **«COMO YA HACEN LAS TRES RUTAS DE CREACIÓN»**, y añade
una parada: *«si al mirarlas descubres que las tres no coinciden entre sí, PARA y dilo»*.

**Medido: no coinciden. Sólo UNA de las tres devuelve 409.**

| ruta | qué es | qué hace con `P2002` |
|---|---|---|
| `POST /load-catalog` (`:31`) | **masiva** (dos bucles) | `:67` y `:119` — **se lo traga** y sigue: idempotencia de ONBOARD-2 |
| `POST /import` (`:186`) | **masiva** (CSV) | en el servicio (`products.service.ts:187`) — **se lo traga**: `skipped++`, y responde 200 |
| `POST /` (`:230`) | **una sola fila** | `:247` — **409 `name_duplicate`** |

Y un detalle del recuento: los tres `createProduct(` del fichero están en `:59`, `:111` y `:237`,
pero **los dos primeros son dos bucles de la MISMA ruta**. No son tres criterios en tres rutas.

### Por qué esto NO ha forzado la parada — y qué hacer si no estás de acuerdo

La parada existe para que no me invente un criterio cuando no hay uno que copiar. **Aquí no hay
nada que inventar:** la discrepancia es **masiva vs una sola fila**, las dos formas son correctas
en su sitio, y `PUT /:id` es inequívocamente de las segundas. Hay exactamente **una** ruta de una
sola fila y define el criterio sin ambigüedad.

Tanto es así que la línea que se ha añadido al `PUT` es **byte-idéntica** a la de `POST /`
(`:247` y `:279`) — lo destapó un ancla de reversión que dejó de ser única.

> **Si lees tu parada en el otro sentido —«no toques el PUT hasta decidirlo»— el commit del
> servidor se puede dejar caer solo.** Va en su propio commit y no lo necesita nada de lo demás.

### Y una corrección a mi propia cita de SCRUM-631

Escribí `productsView.js:331`. **Es `:332`** (`:331` es el `const data = await res.json()`). Y el
del camino de EDICIÓN —el de este ticket— es **`:343`**. La forma que describí era correcta; el
número estaba corrido uno.

---

## 🔢 EL CENSO, CON NÚMERO

El camino tiene **dos tramos**, y hay que contarlos por separado porque por separado no hacen daño:

| | sitios | ficheros |
|---|---:|---:|
| **A)** `new Error(data?.error…)` — el identificador **se vuelve** mensaje | **13** | 3 |
| **B)** un `.message` **pintado** en la interfaz | **26** | 7 |
| 🔴 **ficheros con LAS DOS MITADES** (el defecto entero) | | **2** |

Los dos: `productsView.js` (A×7, B×8) y `providersView.js` (A×4, B×5). El tercero de la columna A
es `invoiceDetailView.js` (`:523`, `:650`, con la forma `d.error || 'error'`), que **no** tiene la
mitad B: su código va a otro sitio.

**✅ Control positivo — y no es adorno:** antes de publicar ningún número, el barrido tiene que
encontrar **el caso que ya sabemos que existe**. Lo encuentra —`productsView.js:314`, con su línea
citada— y si no lo encontrara **aborta con código 2** en vez de imprimir un 0 que se leería igual
que «no hay ninguno». Además declara que ha mirado **77 ficheros y 32.358 líneas**.

---

## Lo construido

### ① El servidor: `PUT /:id` contesta 409

Dos líneas, copiadas de `POST /` y no inventadas: `catch (err: any)` y la rama del `P2002`. El
comentario dice explícitamente que las masivas **no** hacen esto y por qué.

### ② La pantalla: el identificador no llega

`mensajeDeErrorCatalogo(codigoOMensaje, respaldo)` traduce lo que dijo el servidor:

* `name_duplicate` → **`[PENDIENTE microcopy oficial] nombre ya en uso`**
* cualquier otro identificador (`forbidden`, `trial_expired`, `not_found`…) → **el respaldo en
  castellano que la llamada YA traía**, y el código sale por `console.warn`
* una frase de verdad → pasa intacta

Los **8** sitios que pintaban `e.message` en `productsView.js` pasan por él.

**El marcador va CON su palabra distintiva**, no solo. Es un control de varios lados —este caso
frente a todos los demás— y un marcador pelado borraría justo la distinción que el ticket viene a
dar. El texto definitivo no se ha escrito.

### ⚠️ El desvío del sitio, que merece quedar escrito

Lo puse primero en **`api.js`**, que es el sitio canónico de estos mapeos (`invoiceStatusMeta`,
`jobStatusMeta`, con su criterio escrito). La tanda lo tumbó:

```
not ok — SCRUM-405 · 🔴 ya NO queda marcador de microcopy en `api.js`
```

**`api.js` es zona SIN MARCADOR por decisión**, y relajar un guard estaba fuera de carril. Así que
el traductor se mudó a `productsView.js` — y acabó siendo **más honesto**: el texto sin aprobar lo
pinta esta pantalla, así que es esta la que entra en el censo de marcadores, que es donde miraría
quien busque «qué pantalla enseña texto sin firmar».

Y hay una **inversión deliberada** del criterio de `invoiceStatusMeta`, dicha en el código para que
no parezca descuido: allí lo desconocido «se ve» —cae al propio código— para que un estado sin
mapear no se disfrace del más inocente. Un aviso de error **no puede** hacer eso: enseñar el código
**es** el defecto que esto cierra.

### 📋 El censo de marcadores SUBE — declarado

`productsView.js` **entra con 1** en `CENSO` de `scrum402-marcador-no-se-pinta.test.mjs`, con su
motivo escrito. Y con la advertencia que es la lección de SCRUM-575 aplicada **antes** de que
muerda: el mapa tiene UNA entrada, así que **si el siguiente ticket añade otra reutilizando
`PV_MARCADOR_MICROCOPY`, el número NO se moverá** y entrará una superficie nueva en silencio. Quien
añada un código mapeado le pone SU constante.

`api.js` **no** entra: se revirtió byte a byte (`Buffer.compare === 0`).

---

## El control, en las dos direcciones

### ANTES — lo que veía el profesional

Medido ejecutando el camino real de la vista con la respuesta que da el servidor hoy:

```
lo que lleva el Error ................. "name_duplicate"
ANTES  · lo que recibía setAlert ...... "name_duplicate"
DESPUÉS· lo que recibe setAlert ....... "[PENDIENTE microcopy oficial] nombre ya en uso"
```

Y el **500**: el `catch` del `PUT` no tenía rama de `P2002`, así que cualquier choque caía al
`internal_error` de abajo. Se prueba quitándola otra vez (rojo ① más abajo), que hace al guard
nombrar `PUT /:id`.

> **🛑 Lo que NO he podido hacer, y no lo disfrazo:** provocar el 500 **contra un servidor vivo**.
> No tengo credencial de producción (regla 3) y la tanda gateada exige tomar el turno de staging.
> Lo de arriba es el camino del cliente ejecutado de verdad y el del servidor probado por
> inyección; **no es una petición HTTP real**, y quien quiera esa evidencia tiene que correrla.

### DESPUÉS — 409 y marcador

Los 8 tests en verde, y la línea del `PUT` idéntica a la de `POST /`.

### LOS ROJOS — tres, cada uno cayendo en un test distinto

| inyección | qué cae |
|---|---|
| ① se retira la rama `P2002` del `PUT` | «toda escritura de UNA FILA contesta 409» — **y nombra `PUT /:id`** |
| ②a un sitio vuelve a pintar `e.message` | «la vista ya no pinta `e.message` a pelo» |
| ②b el traductor deja de mapear `name_duplicate` | «el identificador NO llega a la pantalla» |

Reversión de las tres: `Buffer.compare === 0` y **0 CR en disco**.

### 🔴 Y LOS QUE PASAN EN LOS DOS LADOS — que es información, no descuido

Aplicando el criterio de SCRUM-639, aquí va **por qué** cada uno pasa en ambos:

* **Con el rojo ① puesto, los tests de la pantalla siguen verdes.** Correcto: las dos mitades son
  **independientes**. Si cayeran juntas, un solo arreglo apagaría los dos rojos y no sabríamos cuál
  arregló qué — que es exactamente por lo que el encargo las manda juntas pero separables.
* **Con el rojo ②b puesto, «un código SIN mapear cae al respaldo» sigue verde.** También correcto, y
  es el caso más fino: sin el mapeo, `name_duplicate` encaja en `PV_ES_IDENTIFICADOR` y cae al
  respaldo — **el identificador sigue sin llegar a la pantalla**. Lo que se pierde no es la
  protección, es la **distinción**: el profesional leería «Error actualizando.» y no sabría que el
  nombre está cogido. Por eso quien lo caza es el test 5, que mide la distinción, y no el 6.
* **«CONTROL NEGATIVO: una frase de verdad pasa intacta» pasa siempre.** Está para el rojo que
  NADIE inyectó: un traductor que devolviera siempre el respaldo pasaría los dos casos de arriba y
  se habría cargado todos los mensajes ya redactados de la pantalla.

### NEGATIVO — las masivas, exactamente como estaban

Un test propio comprueba que los **dos** bucles de `load-catalog` siguen tragándose el `P2002`
(`throw e`) y que la ruta **no** ha empezado a devolver 409; y que `POST /` sigue con el mismo
código. Si eso cambiara, recargar el catálogo del gremio pasaría de idempotente a fallar.

### El desnudado de comentarios, otra vez

Mi comentario en `products.routes.ts` nombra `P2002`, `409` y `name_duplicate`. **Un guard de texto
sin desnudar se cazaría a sí mismo** en la prosa que explica el arreglo — ya pasó en SCRUM-614 y
SCRUM-617. Hay suelo que comprueba las dos cosas: que el desnudado quita prosa (el comentario
desaparece) y que **no** se ha comido el código (las rutas siguen ahí, y quedan >40 % de los bytes).

---

## Lo que NO cubre

1. **`providersView.js` tiene el mismo defecto entero** (A×4, B×5) y no se toca: es otra pantalla y
   otro carril. Queda censada con número.
2. **`invoiceDetailView.js`** convierte `d.error` en mensaje en `:523` y `:650` con la forma
   `d.error || 'error'`. No pinta `.message`, así que no completa el camino; sin medir a dónde va.
3. **Un código de una sola palabra que TAMBIÉN sea una frase válida** (`error`, a secas) se trataría
   como identificador y caería al respaldo. En las rutas de productos no existe ninguno así
   —medidos los 12 códigos que emiten—, pero la regla es esa y conviene saberlo.
4. **Nada vigila que una vista NUEVA no vuelva a pintar `e.message`.** El test de este ticket mira
   `productsView.js` y nada más. Un guard sobre las 7 vistas de la columna B sería otro ticket.

---

## Ficheros

* `src/modules/products/app/routes/products.routes.ts` — el `PUT` captura `P2002` → 409, con el
  criterio copiado de `POST /` y el reparto masiva/una-fila explicado.
* `public/dashboard/js/productsView.js` — `mensajeDeErrorCatalogo` y los 8 sitios que pintaban.
* `tests/scrum641-nombre-cogido-sin-500.test.mjs` — **nuevo**, 8 tests, las dos mitades.
* `tests/scrum402-marcador-no-se-pinta.test.mjs` — el censo sube: `productsView.js: 1`, con motivo.
* `public/dashboard/js/api.js` — **NO aparece en el diff, y es correcto.** Se rematerializó en LF
  (1203 CR de disco quitados con `npm run cr:censo --limpiar`) mientras el traductor vivía ahí,
  porque el guard de SCRUM-533 mide **el disco** de los ficheros que la rama toca. Al mudarse el
  traductor, el fichero volvió a su contenido exacto: `Buffer.compare(disco, blob) === 0` y
  `git diff` vacío. La «M» que enseña `git status` es la caché de `stat`, no un cambio.

**Lo que NO se ha tocado:** `prisma/schema.prisma` y el `@@unique` (SCRUM-631 espera al fundador),
`lockActionForRole` y los permisos de SCRUM-614, `_navegador.mjs` y la marca de arranque
(SCRUM-642), y nada de fechas ni zonas horarias (SCRUM-643). Ningún guard relajado.

**Colisión conocida:** la rama `scrum-614-censo-rutas-sin-rol` (sin mergear) también toca
`products.routes.ts` — mete `requireRole('admin')` en `POST`/`PUT` y retira el `DELETE`. Los dos
cambios son **compatibles** (distinta línea, distinto propósito), pero el fichero conflictará al
mergear: se conservan los dos.

## HALLAZGOS FUERA DE ALCANCE

* Los puntos 1, 2 y 4 de arriba.
* **`api.js` tenía 1203 CR en disco** y cualquier rama que lo toque arrastra el rojo de SCRUM-533.
  Es el caso B de SCRUM-570 y el censo lo tiene contado (1.355 ficheros); no es de esta rama, pero
  el siguiente que edite `api.js` se lo encontrará igual.

---
---

# APÉNDICE · SCRUM-641 (2/2) · LA MICROCOPY, APROBADA

**Fecha:** 4-sep-2026 · **Carril:** producto · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `e87a939bd35a5bcaf77212e4c9e8401cd2288f50` · 2026-09-04T19:55:24Z

> El cuerpo de arriba cerró el ticket el 2-sep con el texto SIN aprobar, a propósito. Esto es lo
> que faltaba: el texto, y la caja que hacía falta para poder aprobarlo.

---

## EL TEXTO

> **«Ya tienes un producto con ese nombre.»**

✅ **APROBADO POR EL ASESOR el 4-sep-2026. PROVISIONAL a la espera de la firma del fundador.**

**Por qué éste y no otro** — las tres razones son del asesor y quedan escritas porque un texto sin
su motivo se reescribe en el siguiente ticket:

* **«Ya tienes» y no «ese nombre está en uso».** Le dice que el choque es con algo **suyo**. En un
  multi-tenant, quien lee «en uso» se pregunta de quién — y esa duda es peor que el error.
* **No lleva salida** («cambia el nombre»). Se lee con el campo del nombre delante, así que la
  salida es obvia y la frase sobraría. Precedente feo de la casa: un 409 que decía «no lo hemos
  duplicado» y acababa mandando a crearlo otra vez.
* **No menciona los desactivados**, aunque probablemente sean la causa frecuente. Eso es
  **SCRUM-631** y está esperando al fundador: no se explica algo que todavía no es verdad.

---

## 📐 LA CAJA, MEDIDA — y el número que se corrigió a sí mismo

Medida en el **DOM renderizado** (Playwright, Chromium de escritorio), sobre la maqueta real
(`.sidebar` + `.main` + `.view-container` + `.data-card` + `.alert.error` con su `margin:0 20px 0`),
sirviendo el `public/` del árbol. **El texto lo puso `window.mensajeDeErrorCatalogo`**, la función
del producto — no una copia en la página de medida.

### 🔴 EL PRIMER NÚMERO ERA MALO, Y LO DESMINTIÓ LA CAPTURA

La primera medida dijo **«1 línea a 390 px»**. La captura enseñaba **dos**. La causa, aislada con
control de reversión (quitar el relleno devuelve exactamente los valores de partida):

| a 390 px | ancho útil | líneas | alto |
|---|---:|---:|---:|
| sin barra de scroll | 294 px | 1 | 42,25 px |
| **con barra de scroll (15 px)** | **279 px** | **2** | **62,50 px** |

**El caso real es el de abajo:** la vista de productos lleva su tabla de catálogo debajo, así que
la página siempre scrollea. El texto viejo —`[PENDIENTE microcopy oficial] nombre ya en uso`—
cabía por **1,64 px** sin barra y **se pasaba 13,36 px** con ella, dejando «uso» solo en la
segunda línea.

### Los números con los que se aprobó

| | **929 px** | **390 px** | **320 px** |
|---|---:|---:|---:|
| `.main` | 681 px | 390 px | 320 px |
| caja del aviso | 591 × 42,25 | 309 × 62,50 *(con barra)* | 254 × 62,50 |
| **ancho ÚTIL** | **561** *(546 con barra)* | **279** *(294 sin barra)* | **224** |
| **capacidad, 1 línea** | **94 car.** | **45 car.** | **36 car.** |
| capacidad, 2 líneas | 173 car. | 93 car. | 74 car. |

**El texto aprobado son 37 caracteres:** entra en **una línea a 390 px con barra** (45 de
capacidad), a 929 px sobra el triple, y a 320 px —el más estrecho que soporta la casa
(SCRUM-469)— cae en dos líneas **sin que la página scrollee en horizontal**, comprobado.

**Calibración del medidor, y no es adorno:** el primer instrumento construía el `font` a mano y
daba 324,84 px para un texto que el navegador renderizaba en 292,36. Se sustituyó por un **clon
del nodo real** dentro del mismo padre, y el control positivo es que el ancho medido del texto de
hoy coincide con la línea realmente renderizada: **desvío 0,00 px**. Además, **control negativo
del contador de líneas**: un nodo de 60 palabras que tiene que dar más de una — dio 6 a 929 px y
10 a 390 px. Si diera 1, el «1 línea» del texto bueno no significaría nada.

**Los 8 respaldos ya escritos NO se tocan:** medidos los nueve textos que esta misma caja pinta
hoy, y **ninguno se sale** a 390 px. El más largo («Error cargando productos.») ocupa 155,84 de
279 px.

---

## Lo construido

### ① El texto entra, el marcador sale del camino

`PV_NOMBRE_DUPLICADO` sustituye a `PV_MARCADOR_MICROCOPY + ' nombre ya en uso'` en el mapa `M`.

### ② Y el mecanismo dice de TRES formas que esto es del asesor, no del fundador

* `PV_SIN_APROBAR = 1` — la ranura sin firma, declarada. Se queda aunque llegue a 0, por el motivo
  de `filtroClientes.js` y `quoteDireccionObra.js`: el día que el traductor gane un segundo texto,
  ese texto nace sin firma y el número tiene que subir.
* El registro es **éste**, en `docs/master/`.
* Un guard nuevo comprueba que **NO existe `docs/microcopy/…641…`**. Ese directorio es el registro
  del FUNDADOR y `constaAprobado()` lo barre (SCRUM-726): la firma del asesor allí **pasaría por
  la suya**. Copiado del guard de S1 en SCRUM-607.

### 🔴 EL MARCADOR NO DESAPARECE DEL FICHERO, y hay que decir por qué

`PV_MARCADOR_MICROCOPY` se conserva como **respaldo de último recurso**, para una llamada que no
traiga respaldo en castellano. Hoy las ocho lo traen, así que **no es alcanzable**; se conserva
porque una llamada nueva que lo olvide tiene que enseñar que falta un texto y no una cadena vacía
(`.alert:empty` no se pinta: el error desaparecería en silencio).

**Consecuencia medida, y es la diferencia con SCRUM-582 y SCRUM-607:** aquéllos **borraron** su
entrada del censo porque no les quedaba ningún literal con marca. Aquí **sí queda uno**, y
`censoActual()` cuenta **literales, no pintados** — así que `productsView.js` **sigue en el censo
de SCRUM-402 con 1** y su entrada **no se borra**. Comprobado con el número delante: borrarla
habría puesto la tanda roja. El comentario del censo se actualiza de «CUENTA 1 Y PINTA 1» a
**«CUENTA 1, PINTA 0»**. Criterio **copiado** del gemelo `providersView.js` (SCRUM-644), que ya
convive con un texto aprobado en el mapa y su marcador de último recurso — no inventado.

---

## Los rojos, probados POR EL MECANISMO

| inyección | qué cae, y con qué mensaje |
|---|---|
| ① el texto vuelve a llevar marcador | «`PV_NOMBRE_DUPLICADO` ha vuelto a llevar marcador» |
| ② `PV_SIN_APROBAR` pasa a 2 | «el contador dice 2 y el traductor estrena 1 texto sin firma» |
| ③ se crea `docs/microcopy/…SCRUM-641….md` | «se leería como la firma del fundador» |

Las tres revertidas y comprobadas: `git status` vacío y **CR = 0 en disco**, contado por bytes con
node. Nota de instrumento: contar con `grep -c` en Git Bash **miente** —normaliza y devuelve un
falso positivo de más de mil CR sobre ficheros que tienen cero—; el conteo por bytes coincide con
el guard de SCRUM-533, que es el árbitro.

**CONTROL NEGATIVO del guard nuevo:** un registro de **otro** ticket en `docs/microcopy/`
(`…SCRUM-999….md`) **no lo tumba** — verde con él puesto. El guard distingue por número de ticket,
no por «hay algo en ese directorio».

### 🔴 EL QUE PASA EN LOS DOS LADOS, que es información y no descuido

Con el rojo ① puesto, **«el identificador NO llega a la pantalla» sigue verde**. Es correcto: ese
test compara el traductor con `PV_NOMBRE_DUPLICADO`, o sea mide la **coherencia** entre lo que
pinta el camino y lo que dice la constante — y con el marcador dentro de la constante siguen
coincidiendo. Quien caza el marcador es el test de microcopy, que mira el **literal**. Si cayeran
los dos, un solo arreglo apagaría ambos y no sabríamos cuál arregló qué.

---

## Lo que NO cubre

1. **Medido en Chromium de escritorio.** La barra de 15 px es la clásica; en un móvil real es
   superpuesta y no roba ancho — allí el útil sería 294 y el texto entraría con más aire. **No se
   ha medido en un móvil real.**
2. **La página de medida reproduce la maqueta, no es la vista cargada con datos reales** (haría
   falta auth y API). Los anchos de `.main` y `.data-card` sí salen del CSS real servido del árbol.
3. **No se sirvió el fichero de la fuente Inter:** se resolvió con la pila del CSS real. Si en
   producción Inter carga de otro origen, los anchos podrían moverse ligeramente.
4. **Sigue sin firmar el fundador.** Lo dice `PV_SIN_APROBAR = 1`.

## HALLAZGOS FUERA DE ALCANCE

* `providersView.js` (SCRUM-644) tiene el mismo texto sin aprobar —`name_duplicate` con marcador—
  y la misma caja. Cuando el fundador firme éste, aquél sigue esperando: son dos pantallas.

## Ficheros

* `public/dashboard/js/productsView.js` — `PV_NOMBRE_DUPLICADO`, `PV_SIN_APROBAR` y el mapa.
* `tests/scrum641-nombre-cogido-sin-500.test.mjs` — el control de microcopy (texto sin marcador,
  contador, y `docs/microcopy/` sin registro de este ticket). De 8 tests a 9.
* `tests/scrum402-marcador-no-se-pinta.test.mjs` — el comentario del censo: de PINTA 1 a PINTA 0.
