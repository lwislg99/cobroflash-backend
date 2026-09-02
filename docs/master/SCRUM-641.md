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
